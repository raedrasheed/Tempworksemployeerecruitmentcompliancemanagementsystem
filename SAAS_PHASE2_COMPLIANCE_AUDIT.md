# Phase 2.8 — Compliance Module Audit

> Pre-refactor audit of `src/compliance`. Second tenant-scoped pilot.

---

## 1. Files in module

| File | Lines | Role |
|------|------|------|
| `compliance.module.ts` | 11 | Nest module |
| `compliance.controller.ts` | 70 | HTTP surface (dashboard, alerts CRUD-light, employee summary, generator) |
| `compliance.service.ts` | 184 | business logic |
| `dto/update-alert.dto.ts` | (small) | input shape |

Total: ~265 lines. Comparable in size to `employee-work-history`.

## 2. Prisma call sites (pre-refactor)

23 direct `this.prisma.*` call sites:

| Method | Calls |
|---|---|
| `getDashboard` | 10 (4× alert count, 4× document count, 1× groupBy, 1× findMany) |
| `getAlerts` | 2 (`findMany`, `count`) |
| `updateAlert` | 2 (`update`, `auditLog.create`) |
| `getEmployeeCompliance` | 5 (employee, documents, workPermits, visas, alerts) |
| `getExpiringDocuments` | 1 |
| `generateAlerts` | 3 (document.findMany, alert.findFirst, alert.create) |

The `auditLog.create` is intentionally kept on `legacyPrisma` post-refactor.

## 3. Models used

- `ComplianceAlert` — primary tenant-scoped target. Phase 2.3 denorm.
- `Document` — read for expiry counts. Phase 2.3 denorm.
- `Employee` — read-only for the per-employee summary endpoint.
- `WorkPermit` — read for the per-employee summary. Phase 2.3 denorm.
- `Visa` — read for the per-employee summary. Phase 2.3 denorm.
- `DocumentType` — read-only catalog (joined inline).
- `User` — read-only via `resolvedBy` include.
- `AuditLog` — write-only side effect, GLOBAL.

## 4. Tenant ownership path

```
ComplianceAlert.tenantId  (Phase 2.3 denorm)
  → naturally derived from entityType+entityId via Employee/Applicant.tenantId
Document.tenantId         (Phase 2.3 denorm)
WorkPermit.tenantId       (Phase 2.3 denorm)
Visa.tenantId             (Phase 2.3 denorm)
Employee.tenantId         (Phase 1)
```

Every read path can be tenant-scoped by adding a `tenantId = $ctx`
predicate on the primary model. The pilot does this via
`getPilotScope(this.pilot, 'compliance').tenantWhere()`.

## 5. Use of `tenantId`

Pre-refactor: not consulted. Post-refactor (pilot active): every
read/aggregate/count is filtered by the active tenant; every create
persists `tenantId = ctx.id`.

## 6. Read paths

| Method | Models touched | Aggregates? |
|---|---|---|
| `getDashboard` | ComplianceAlert × 4, Document × 4 | yes (count + groupBy) |
| `getAlerts` | ComplianceAlert | count + paginated findMany |
| `getEmployeeCompliance` | Employee, Document, WorkPermit, Visa, ComplianceAlert | no — pure read |
| `getExpiringDocuments` | Document | no |

## 7. Mutation paths

| Method | Mutation | Tenant constraint (pilot mode) |
|---|---|---|
| `updateAlert` | `complianceAlert.update(by id, data)` | pre-checked by `findFirst` with `tenantId` filter; cross-tenant ⇒ 404 |
| `generateAlerts` | `complianceAlert.create` per matching document | persists `tenantId` from active context |

Note: `generateAlerts` is the only path where the create's `tenantId`
is derived from the active context. In production this endpoint is
typically run by a scheduled job that should attach a tenant context
before invocation; the pilot warns (via inactive scope reason) when
ALS lacks a tenant.

## 8. Aggregation/count paths

`getDashboard` runs eight `count()` queries plus one `groupBy`. All
are routed through the accessor and filtered by `scope.tenantWhere()`.

## 9. Permissions

Permissions are enforced at the controller via the standard guards.
The pilot does NOT change auth, RBAC, or HTTP status codes. A
cross-tenant alert id presents as `NotFoundException` (404) to match
the report engine and EWH pilot contracts.

## 10. Current risks (pre-refactor)

- `updateAlert(id, ...)` accepts any id — without the pilot, a caller
  with a guess could theoretically resolve an alert in another tenant.
  The pilot closes this hole.
- `getDashboard` aggregates across all tenants. Pre-pilot, the dashboard
  is system-wide; post-pilot, it is tenant-scoped. This is the
  intentional behaviour change *only when the pilot flag is on AND the
  module allow-list includes `compliance` AND a tenant is in ALS*.
  Production default (flag off) preserves system-wide behaviour.
- `generateAlerts` writes new alerts without `tenantId` today. Post-
  pilot it persists `tenantId` from the active context — closer to the
  Phase 2.3 denorm contract.

## 11. Refactor plan (executed in this PR)

1. Inject `PilotPrismaAccessor`; rename `prisma` → `legacyPrisma` and
   add `private get prisma()` returning `pilot.client()`.
2. Add `private scope() = getPilotScope(this.pilot, 'compliance')`.
3. Spread `scope.tenantWhere()` into every read/aggregate/count `where`;
   spread `scope.tenantData()` into every create `data`.
4. Pre-check + mutate-by-id pattern in `updateAlert`. Cross-tenant ⇒
   `NotFoundException`. Legacy mode keeps the original P2025 path so
   error semantics match.
5. Annotate every retained `this.prisma.*` site with
   `// @tenant-reviewed: phase28-pilot-scope`.
6. Add `phase28-compliance-extension.sql` to materialise the columns
   the staging fixture lacks (compliance_alerts, document_types,
   documents, work_permits, visas, employees firstName/lastName).
7. Build `compliance-equivalence.ts` (12 cases) and
   `compliance-isolation.ts` (7 cases).

Acceptance: legacy behaviour unchanged when pilot flag is off OR
module not in allow-list; tenant-safe behaviour proven when scope is
active.

---

# Phase 2.37 reaffirmation addendum

Compliance was the **second** module ever piloted (Phase 2.8). The
read paths are already routed through `PilotPrismaAccessor` and tagged
`phase28-pilot-scope`. Phase 2.37 is the formal reads-first audit
+ harness reaffirmation.

## A. Per-method classification (current state)

| Method | Type | Phase 2.37 status |
|---|---|---|
| `getDashboard()` | READ | INCLUDED — `phase28-pilot-scope` (10 narrowed sites) |
| `getAlerts(pagination, status?, severity?)` | READ | INCLUDED — `phase28-pilot-scope` |
| `getEmployeeCompliance(employeeId)` | READ | INCLUDED — parent-employee + per-row `tenantWhere()` |
| `getExpiringDocuments(days)` | READ | INCLUDED — `phase28-pilot-scope` |
| `updateAlert(id, dto, userId?)` | WRITE | INCLUDED_WITH_GUARD — pre-check via `findFirst({ id, ...tenantWhere() })`; cross-tenant id raises 404. Audit on `legacyPrisma` (`phase28-audit-log`). |
| `generateAlerts()` | BACKGROUND-LIKE WRITE | INCLUDED — scan filters by `tenantWhere()`; create spreads `tenantData()`. |

## B. Models touched + tenancy

`ComplianceAlert.tenantId` (Phase 2.3), `Document.tenantId`
(Phase 2.20), `Employee.tenantId` (Phase 2.33), `WorkPermit.tenantId`,
`Visa.tenantId`. Every read query and every mutation pre-check
spreads `scope.tenantWhere()`.

## C. Global / system call sites

None. Compliance has no public/global read endpoints; every read is
tenant-gated.

## D. Background jobs

`generateAlerts()` requires an ALS tenant frame to operate
tenant-scoped. The controller path requires authenticated user
context. A future scheduled-job refactor (Phase 2.38+) must
explicitly attach an ALS frame per tenant when invoking
`generateAlerts()`.

## E. Notification side effects

`ComplianceService` does not emit notifications today. Notification
fan-out is handled by `notifications`.

## F. Phase 2.37 scope

- **Audit confirmation** of every read site as tenant-gated.
- **Fixture fix**: `phase28-compliance-extension.sql` updated to
  stamp `updatedAt = now()` on the seed inserts (a later schema
  migration made the column NOT NULL).
- **Doc updates**: `SAAS_PHASE2_COMPLIANCE_PILOT_RESULTS.md`,
  Phase 2 strategy + inventory.

## G. What is explicitly excluded

- Audit emission routing through `TenantAuditLogService` — Phase 2.38+.
- Scheduled background-scan ALS frame management — Phase 2.38+.
- Alert-generation cross-module entity validation — both Documents
  and Alerts already carry `tenantId`, so the cross-module risk is
  already mitigated.
- Notification fan-out — out of scope.

---

# Phase 2.39 addendum — tenant fan-out dispatch

The compliance service now exposes a single supported entry point
for any background scheduler:

`dispatchComplianceAlertGenerationForTenants()` — defaults refuse;
when both `TENANT_JOB_FANOUT_ENABLED=true` AND the compliance pilot
is active, enumerates ACTIVE tenants and calls
`generateAlertsForTenant(tenantId)` per tenant. Per-tenant fault
isolation; source-level meta-assertion that raw `generateAlerts()`
is not called.

Tag: `phase239-tenant-job-dispatch`.

Harness: `compliance-tenant-job-dispatch` — 9/9 PASS.

No scheduler is wired in this phase.
