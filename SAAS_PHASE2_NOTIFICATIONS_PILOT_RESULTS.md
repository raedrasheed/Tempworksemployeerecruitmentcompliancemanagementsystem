# Phase 2.10 — Notifications Pilot Results

> Fourth tenant-scoped pilot. First to deliberately split a single
> service into "in scope" (read paths) and "explicitly excluded"
> (scheduler / fanout). Proves the pattern handles partial refactors
> cleanly.

---

## 1. Headline

```
build:                                            ✅
prisma validate:                                  ✅
saas:validate (6 suites):                         ✅
saas:schema-lint:                                  ✅
saas:phase2-notifications-equivalence:            11/11 cases PASS
saas:phase2-notifications-isolation:               8/8  cases PASS
saas:phase2-job-ads-equivalence (regression):     13/13 cases PASS
saas:phase2-job-ads-isolation   (regression):      9/9  cases PASS
saas:phase2-compliance-equivalence (regression):  12/12 cases PASS
saas:phase2-compliance-isolation  (regression):    7/7  cases PASS
saas:phase2-ewh-equivalence       (regression):   12/12 cases PASS
saas:phase2-ewh-isolation         (regression):    8/8  cases PASS
saas:scan:                                        759 unreviewed (down from 786)
saas:scan:raw-sql:                                baseline unchanged
production defaults:                              all OFF
```

## 2. What was tested

### Equivalence (11/11 PASS)

- Pilot active state under flag combinations.
- `getUserNotifications`: pilot total ≤ legacy; pilot excludes the
  NULL-tenant legacy row; legacy includes it.
- `getUnreadCount`: pilot ≤ legacy.
- `wasHighBalanceAlertRecentlySent`: legacy and pilot both find a
  recent alert (each in its own scope).
- `markAsRead(missing-id)`: pilot raises `NotFoundException`; legacy
  raises Prisma error — both reject as expected.
- `getOrCreatePreferences`: returns identical preferences id in both
  modes (per-user global record kept on legacyPrisma).
- `markAllAsRead` pilot ON: tenant A unread → 0; tenant B unread
  unchanged.
- Response shape preserved (`{ data, total }`).

### Isolation (8/8 PASS)

- Pilot ON tenant A: `getUserNotifications` returns ONLY tenant A.
- `getUnreadCount` excludes tenant B + NULL-tenant rows.
- `markAsRead(B-id)` rejected; `isRead` unchanged.
- `markAllAsRead` does NOT mutate tenant B rows (count before == count after).
- Concurrent ALS frames: T_A no B-rows, T_B no A-rows.
- Pilot OFF: legacy includes NULL-tenant legacy row.
- `TENANT_PRISMA_PILOT_MODULES=nothing` ⇒ legacy union (notifications opt-out).
- **Meta-assertion (case 8):** all four scheduler `check*` methods
  source `legacyPrisma.user.findMany` — proving the scheduler/
  background paths are untouched by Phase 2.10.

## 3. Lessons learned

1. **Partial refactors are explicit.** Annotating background sites
   with `phase210-excluded-background` and routing them via
   `legacyPrisma` makes the scope split self-documenting in code as
   well as in the docs. The scanner's strict mode can later target the
   `phase211-pilot-scope` annotation specifically.
2. **Public-facing read endpoints follow the same shape.** Just like
   the job-ads public listing, the notifications endpoints work
   identically with no ALS tenant — the spread is `{}` and the path
   stays legacy. There's a small footprint in pilot mode for users
   that DO have a tenant.
3. **Per-user global records are a third class.** `NotificationPreference`
   has neither tenantId nor a meaningful tenant-equivalent ownership
   chain. The right call was to keep it on `legacyPrisma` (annotated
   `phase210-global`) — adding a tenant filter would silently break
   existing per-user preferences.
4. **Source-level meta-assertions catch refactor drift.** The
   isolation harness's case 8 reads the service file and asserts
   the scheduler methods still use `legacyPrisma`. A future PR that
   accidentally moves them to `this.prisma` (which would silently
   tenant-scope a global iteration) fails this assertion immediately.
5. **markAsRead was a contract bug pre-pilot.** It accepted any id
   without checking ownership. The pilot's tenant-scoped pre-check
   closes the cross-tenant hole; legacy mode preserves the Prisma
   P2025 path so observable behaviour with the flag off is unchanged.

## 4. Background-job warnings

The scheduler / notification-creation paths intentionally remain
global. Operators should know:

- Cron-driven `check*` methods iterate `User` across all tenants.
  Adding a tenant to ALS at the cron caller without also updating
  these methods would mean a single cron tick services only one
  tenant.
- `notifyUploaderAndRoles` / `notifyUsersByRoles` look up users by
  role across all tenants. Until Phase 2.11+ adds caller-side tenant
  passing, these will fanout cross-tenant if a multi-tenant role
  mapping exists.
- `Notification.tenantId` is set to NULL by these creators today (the
  pilot does not change them). Phase 2.11+ will populate it from the
  job context.

## 5. Whether the pattern remains reusable

**Yes.** The Phase 2.7/2.8/2.9 pattern (`PilotPrismaAccessor` +
`getPilotScope(pilot, moduleName)` + spreads) handles a partial-scope
module without modification. New ingredients in Phase 2.10 are:

- `phase210-excluded-background` annotation (precedent for future
  partial refactors).
- Source-level meta-assertion in the isolation harness (cheap,
  refactor-robust).
- `legacyPrisma`-routed per-user global model (precedent for
  user-scoped catalogs / preferences).

## 6. Next recommended module

`src/recycle-bin` — small, read-mostly, tenant-scoped, no scheduler
involvement. Good for the fifth pilot.

Backups:
- Splitting `src/vehicles` into reads-first.
- `src/finance` read paths only (writes / reconciliation deferred).

## 7. Blockers before scheduler refactor

1. **Job-context framework:** background workers need a way to
   attach a tenant to ALS at cron-tick time. Today there's none.
   Phase 2.11 must ship this primitive first.
2. **Per-tenant cron sequencer:** the cron orchestrator must iterate
   tenants and run `runAllChecks` per tenant. Without this, moving
   `check*` to the pilot is unsafe.
3. **Caller-side tenant passing for `notify*`:** every caller of
   `notifyUploaderAndRoles` / `notifyUsersByRoles` must pass the
   originating tenant explicitly. That's a wide audit (documents,
   finance, applicants, workflow, …).
4. **Telemetry:** before flipping the scheduler to pilot mode,
   per-tenant per-tick metrics need to be in place to debug missed
   notifications.

## 8. Production behaviour change status

**Unchanged.** With `TENANT_PRISMA_PILOT_ENABLED=false` (default),
`getPilotScope()` returns inactive, the read-path spreads are no-ops,
and the explicitly-excluded background paths continue to use
`legacyPrisma` directly. Every legacy SQL is byte-for-byte identical
to before this PR. The scheduler runs unchanged.
