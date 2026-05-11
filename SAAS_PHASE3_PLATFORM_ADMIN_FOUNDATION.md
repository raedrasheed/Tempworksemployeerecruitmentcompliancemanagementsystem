# SaaS Phase 3.0 — PlatformAdmin Foundation

## Current state

Two overloaded flags signal platform-level authority today:

- `Agency.isSystem` (boolean): users attached to the `isSystem=true`
  agency bypass tenancy scoping and see global data; users on any other
  agency are scoped to that agency.
- `Role.isSystem` (boolean): marks a role as a "system" template that
  must not be edited by tenant admins.

These are tangled: they cover three different concerns (tenant-scope
bypass, role-template protection, platform support tooling) with a
single binary flag at the wrong level.

## Existing model already in place

The schema already declares a `PlatformAdmin` model (added during
Phase 2) but it is **not wired into the authorization path yet**:

```prisma
enum PlatformAdminLevel { SUPPORT OPERATOR SUPER }

model PlatformAdmin {
  id        String             @id @default(uuid())
  userId    String             @unique
  level     PlatformAdminLevel @default(SUPPORT)
  grantedBy String?
  grantedAt DateTime           @default(now())
  @@map("platform_admins")
}
```

The accompanying `PlatformAuditLog` model is also present and emits
platform-level mutations.

This is sufficient as the data carrier. Phase 3.0's task is to
**document** the migration strategy from `Agency.isSystem` to
`PlatformAdmin`, not to flip auth code today.

## Migration strategy

### Stage 1 (Phase 3.0 — this phase)
- Inspect schema. Confirm `PlatformAdmin` already exists.
- Document mapping rules. No data writes.

### Stage 2 (Phase 3.5)
- Add a guarded backfill script:
  for each user with `agency.isSystem = true`, create a
  `PlatformAdmin{userId, level: SUPER, grantedBy: 'phase3-backfill'}`
  row if one does not exist.
- Idempotent; dry-run first. Gate behind `PLATFORM_ADMIN_BACKFILL_APPLY=true`
  + classifyRuntimeEnv() SAFE check (same two-flag pattern used by
  Phase 2 audit-retention applies).

### Stage 3 (Phase 3.6)
- Add an `IsPlatformAdminGuard` (or extend the existing tenant guard)
  that reads `PlatformAdmin` and stamps `req.user.platformAdminLevel`.
- Keep `Agency.isSystem` as a fallback signal (both checked, OR-ed).

### Stage 4 (Phase 3.7)
- Switch all admin-only endpoints from `agency.isSystem` to
  `req.user.platformAdminLevel`. Bake.

### Stage 5 (Phase 3.8)
- Drop `Agency.isSystem` (destructive migration). Only after all
  authorization paths have been migrated for at least one release.

## Mapping rules

| Today                          | Phase 3 PlatformAdmin equivalent                 |
| ------------------------------ | ------------------------------------------------ |
| user attached to `isSystem` agency | `PlatformAdmin{userId, level: SUPER}`         |
| Tempworks support staff        | `PlatformAdmin{userId, level: OPERATOR}`         |
| Read-only support              | `PlatformAdmin{userId, level: SUPPORT}`          |
| Tenant admin                   | (unchanged — tenant membership + role)           |
| Agency manager                 | (unchanged — agency-level role)                  |

`Role.isSystem` remains an orthogonal concept (role template lock) and
is NOT replaced by `PlatformAdmin`.

## Risks

- **Auth regression** — switching guards is the single largest risk.
  Mitigation: dual-read window (Stage 3) where both `Agency.isSystem`
  and `PlatformAdmin` are checked, so a missed backfill row does not
  lock anyone out.
- **Backfill miss** — staging clone must be validated by listing
  every user with `agency.isSystem = true` and confirming a
  corresponding `PlatformAdmin` row after backfill.
- **Audit trail** — every `PlatformAdmin` grant emits a
  `PlatformAuditLog` row already; no change needed there.

## Out of scope (this phase)

- Adding `PlatformAdmin` rows.
- Wiring `PlatformAdmin` into any guard.
- Dropping `Agency.isSystem` or `Role.isSystem`.
- Login/session changes.

---

## Phase 3.1 addendum

Read-only PlatformAdmin readiness report added
(`saas:phase310-platform-admin-readiness-report`). Confirms the
`platform_admins` table is in place and surfaces the population that
would be backfilled in Phase 3.5 (and any orphan / multi-agency
conflicts to triage first).
