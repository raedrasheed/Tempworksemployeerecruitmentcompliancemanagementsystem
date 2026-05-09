# Phase 2.1 — Reports Source Status Dashboard

**Live at:** `backend/src/saas/reports/runtime/report-sources.ts`
**Auto-generated machine view:** `backend/reports/saas/phase2/reports-source-validation.{json,md}`.

> Counts at the head of this file are accurate for commit a6859da onward.
> Re-run `npm run saas:phase2-reports-status` (alias of `…-reports-validate`) to refresh.

| Status | Count |
|---|---:|
| READY | **3** |
| DISABLED | 15 |

---

## Per-source

| Key | Status | Reason | tenantColumn | agencyColumn | Test coverage | Owner |
|---|---|---|---|---|---|---|
| `employees`        | **READY**    | Direct `employees.tenantId` from Phase 1 backfill           | `tenantId` | `agencyId` | isolation + equivalence (PASS) | reports |
| `applicants`       | **READY**    | Direct `applicants.tenantId`                                | `tenantId` | `agencyId` | isolation + equivalence (PASS) | reports |
| `agencies`         | **READY**    | `agencies.tenantId`; self-scope via `id`                    | `tenantId` | `id`       | isolation + equivalence (PASS) | reports |
| `documents`        | DISABLED     | Phase 2.3 — `documents.tenantId` denorm not yet backfilled  | (pending)  | (n/a)      | — | reports |
| `compliance_alerts`| DISABLED     | Phase 2.3 — `compliance_alerts.tenantId` denorm pending     | (pending)  | (n/a)      | — | reports |
| `work_permits`     | DISABLED     | Phase 2.3 — entity-keyed via Employee; awaits denorm        | (pending)  | (n/a)      | — | reports |
| `visas`            | DISABLED     | Phase 2.3 — entity-keyed; awaits denorm                     | (pending)  | (n/a)      | — | reports |
| `document_types`   | DISABLED     | Phase 2.3 — catalog `tenantId IS NULL` semantics open       | (pending)  | (n/a)      | — | product+reports |
| `employees_documents`        | DISABLED | Phase 2.3 — joined `documents.tenantId` not backfilled  | — | — | — | reports |
| `employees_work_permits`     | DISABLED | Phase 2.3 — joined `work_permits.tenantId` not backfilled| — | — | — | reports |
| `employees_compliance`       | DISABLED | Phase 2.3 — joined `compliance_alerts.tenantId` pending | — | — | — | reports |
| `applicants_documents`       | DISABLED | Phase 2.3 — same shape as employees_documents           | — | — | — | reports |
| `employees_agencies`         | DISABLED | Phase 2.3 — both sides need Wave A landed first         | — | — | — | reports |
| `applicants_compliance`      | DISABLED | Phase 2.3 — joined compliance_alerts not backfilled     | — | — | — | reports |
| `documents_with_type`        | DISABLED | Phase 2.3 — catalog join rules pending product sign-off  | — | — | — | product+reports |
| `employees_visas`            | DISABLED | Phase 2.3 — joined visas.tenantId not backfilled        | — | — | — | reports |
| `applicants_visas`           | DISABLED | Phase 2.3 — joined visas.tenantId not backfilled        | — | — | — | reports |
| `employees_documents_type`   | DISABLED | Phase 2.3 — depends on documents + document_types       | — | — | — | reports |

## Known behaviour differences (READY sources only)

Read-equivalence run on the staging fixture (commit `a6859da`):

```
3/3 sources equivalent (0 delta, 0 errors)
```

The legacy code path's WHERE excludes soft-deleted rows; the new path applies the same filter via `softDelete: true` on the registry entry. No delta detected when both queries are scoped to the same tenant.

## Cutover order (re-stated from `SAAS_PHASE2_REPORTS_SOURCE_MAPPING.md`)

| Wave | Sources | Trigger |
|---|---|---|
| **Wave A (this PR)** | `employees`, `applicants`, `agencies` | Phase 1 backfill on staging |
| Wave B | `documents`, `compliance_alerts`, `work_permits`, `visas`, `document_types` | Phase 2.3 entity-keyed denorm lands |
| Wave C | `employees_*`, `applicants_*`, `documents_with_type` | Wave A + B done |
| Wave D | `employees_documents_type` | Wave C |

## Source-level Done definition

A source moves from **DISABLED** → **READY** when:

1. The primary table has `tenantId` populated for every active row (verified by `verify-tenant-backfill.ts`).
2. Every join in the new `tenantAwareJoins` list contains `<aliasA>.tenant_id = <aliasB>.tenant_id`.
3. The registry's `assertAllValid()` passes.
4. The per-source isolation test passes.
5. The per-source read-equivalence diff is empty (or all deltas explained).
6. Code-owner sign-off recorded in the migration PR.
