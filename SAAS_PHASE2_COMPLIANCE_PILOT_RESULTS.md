# Phase 2.8 — Compliance Pilot Results

> Second tenant-scoped pilot. Reuses Phase 2.7's pattern verbatim plus
> the new module allow-list. Proves the architecture is reusable.

---

## 1. Headline

```
build:                                           ✅
prisma validate:                                 ✅
saas:validate (6 suites):                        ✅
saas:schema-lint:                                 ✅
saas:phase2-compliance-equivalence:              12/12 cases PASS
saas:phase2-compliance-isolation:                 7/7  cases PASS
saas:phase2-ewh-equivalence (regression):        12/12 cases PASS
saas:phase2-ewh-isolation (regression):           8/8  cases PASS
saas:phase2-tenantprisma-pilot-equivalence:      13/13 cases PASS
saas:phase2-tenantprisma-pilot-isolation:         9/9  cases PASS
saas:scan:                                       795 unreviewed (down from 817)
saas:scan:raw-sql:                               baseline unchanged
production defaults:                             all OFF
```

## 2. What was tested

### Equivalence (12/12 PASS)

- Module allow-list helper: unset env ⇒ all modules allowed; explicit
  list ⇒ only listed modules allowed; `=nothing` ⇒ scope inactive
  even when the flag is on.
- `getDashboard.summary.totalAlerts`: legacy ≥ pilot, pilot equals
  exactly tenant A's seeded count (3).
- `getAlerts(pagination)`: pilot total < legacy total when there are
  cross-tenant rows; pilot total > 0.
- `getAlerts(status='OPEN')`: status filter respected in both modes.
- `getEmployeeCompliance`: response shape preserved; pilot openAlerts
  ≤ legacy openAlerts.
- `getExpiringDocuments`: pilot result is a subset of legacy result.
- Top-level keys `summary / documents / alertsByStatus / recentAlerts`
  present and correctly typed in both modes.

### Isolation (7/7 PASS)

- Pilot ON, tenant A: `getAlerts()` returns only tenant A rows; tenant
  B and NULL-tenant ids excluded.
- `getDashboard.summary.totalAlerts === 3` (tenant A's seeded count).
- `recentAlerts` contain no tenant B ids.
- `updateAlert(tenantB-id)` raises NotFound; the target row's `status`
  is unchanged (no mutation reaches the DB).
- Concurrent ALS frames: T_A no B-rows, T_B no A-rows.
- Pilot OFF: legacy reads include tenant B + NULL-tenant rows (no
  filter) — confirms legacy path is untouched.
- `TENANT_PRISMA_PILOT_MODULES=nothing` ⇒ compliance scope inactive
  even with flag on, returning legacy union.

## 3. Module allow-list

`TENANT_PRISMA_PILOT_MODULES` env var (added in Phase 2.8):

| Value | Behaviour |
|------|-----------|
| (unset) | every module allowed (Phase 2.7 default) |
| `""` | every module allowed (treated as unset) |
| `compliance` | only `compliance` engages the pilot |
| `employee-work-history,compliance` | both modules engage the pilot |
| `nothing` | no module engages the pilot — fast disable without unsetting `TENANT_PRISMA_PILOT_ENABLED` |

`getPilotScope(pilot, moduleName)` consults the allow-list. If
`moduleName` is provided AND the module isn't in the list, the scope
is inactive with reason `"module \"<name>\" not in TENANT_PRISMA_PILOT_MODULES"`.

The Phase 2.7 EWH service was updated to pass `'employee-work-history'`
to `getPilotScope`, so the new gating applies to both pilots. Phase
2.7 harness still passes 12/12 + 8/8.

## 4. Lessons learned

1. **Allow-list is cheap but valuable.** Operators can disable any
   single pilot module instantly without unsetting the global flag.
   Useful when one module misbehaves on a staging clone — keep the
   flag on for the others, set `TENANT_PRISMA_PILOT_MODULES=` to a
   subset, and redeploy.
2. **Aggregations are the same shape.** `count`, `groupBy`, and
   `findMany` all accept `where: { ...t }` the same way. Spreading is
   uniform across the eight count queries in `getDashboard`.
3. **Pre-check + mutate-by-id keeps error semantics stable.** Legacy
   `updateAlert` raises `P2025` from Prisma when the id is missing;
   pilot mode raises `NotFoundException` when the id is in another
   tenant. Both are 404-equivalents to the controller. The harness
   verified both produce no-mutation behaviour.
4. **Catalog joins (DocumentType) keep working.** The `include` paths
   that join `documentType` need no scope change — DocumentType is
   global and the FK lookup carries no tenant equality.
5. **Audit logs stay legacy.** Same as Phase 2.7 — audit writes use
   `legacyPrisma.auditLog.create` so they never block on pilot context.
6. **Fixture extension is wider than EWH's.** The compliance pilot
   exercises five tables (compliance_alerts, document_types, documents,
   work_permits, visas) plus extra columns on employees. The fixture
   extension is bigger because the staging fixture pre-dates many of
   the schema columns. Production has these already.

## 5. Whether the pattern is reusable: yes

The combination of `PilotPrismaAccessor` + `getPilotScope(pilot, moduleName)`
+ `TENANT_PRISMA_PILOT_MODULES` allow-list is reusable for any future
tenant-scoped module. Each new module:

1. Adds `PilotPrismaAccessor` to its module providers + imports
   `FeatureFlagsModule`.
2. Refactors its service: inject pilot, add `private get prisma()` +
   `private scope()`, spread `scope.tenantWhere()` / `scope.tenantData()`.
3. Adds a per-module equivalence + isolation harness.
4. Annotates each `this.prisma.*` site with
   `// @tenant-reviewed: phaseXX-pilot-scope`.

No new flag. No new accessor. The scope helper is generic.

## 6. Risks before next module

- **`getDashboard` becomes tenant-scoped under pilot.** Operators who
  rely on the dashboard for cross-tenant overviews need a separate
  platform-admin endpoint. Phase 2.8 does NOT add one — flag-off
  behaviour is unchanged. Phase 3 should specify the cross-tenant
  view explicitly (likely via `platformAdminOnly: true` on a future
  platform-admin source).
- **`generateAlerts` background job** must attach a tenant context
  when running in pilot mode. Today no scheduled job is wired up; if
  one is added, it MUST use `withRequestContext` + `TenantContext.attach`
  before calling `generateAlerts`, otherwise the scope will be inactive
  and tenantId will be persisted as NULL.
- **`include: { document: { include: { documentType: true } } }`** uses
  Prisma joins. Those don't (yet) carry a tenant filter on the joined
  side. For now we accept this because:
  - `document.tenantId` is set for any pilot-created row, AND
  - the parent (`complianceAlert`) is tenant-filtered, AND
  - the joined `Document` row's tenant is implied by the FK
    (alert.tenantId = document.tenantId by construction).
  Phase 3 may want to enforce this invariant at the DB level (RLS).

## 7. Next recommended module

`src/job-ads` — single-table CRUD, low mutation rate, no file/storage
interactions. Has its own `tenantId` column (denormalised in Phase 2.3
or to be added). Or split `src/vehicles` reads-first if jobs ads is
already otherwise blocked.

## 8. Production behaviour change status

**Unchanged.** With `TENANT_PRISMA_PILOT_ENABLED=false` (default),
`getPilotScope()` returns inactive and the spreads are no-ops. Every
legacy SQL is byte-for-byte the same as before this PR. Module allow-
list is irrelevant when the global flag is off.
