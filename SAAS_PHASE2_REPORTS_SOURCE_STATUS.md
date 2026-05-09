# Phase 2.1 / 2.3 — Reports Source Status Dashboard

**Live at:** `backend/src/saas/reports/runtime/report-sources.ts`
**Auto-generated machine view:** `backend/reports/saas/phase2/reports-source-validation.{json,md}`.

> Counts at the head of this file are updated as of Phase 2.3 (entity-keyed
> denorm landed). Re-run `npm run saas:phase2-reports-status` (alias of
> `…-reports-validate`) to refresh.

| Status | Count |
|---|---:|
| READY | **7** |
| DISABLED | 11 |

---

## Per-source

| Key | Status | Reason | tenantColumn | agencyColumn | Test coverage | Owner |
|---|---|---|---|---|---|---|
| `employees`        | **READY**    | Direct `employees.tenantId` from Phase 1 backfill           | `tenantId` | `agencyId` | isolation + equivalence (PASS) | reports |
| `applicants`       | **READY**    | Direct `applicants.tenantId`                                | `tenantId` | `agencyId` | isolation + equivalence (PASS) | reports |
| `agencies`         | **READY**    | `agencies.tenantId`; self-scope via `id`                    | `tenantId` | `id`       | isolation + equivalence (PASS) | reports |
| `documents`        | **READY**    | Phase 2.3 — `documents.tenantId` backfilled + verified      | `tenantId` | `null` (entity-keyed) | isolation + equivalence (PASS) | reports |
| `compliance_alerts`| **READY**    | Phase 2.3 — `compliance_alerts.tenantId` backfilled         | `tenantId` | `null` | isolation + equivalence (PASS, fixture missing table) | reports |
| `work_permits`     | **READY**    | Phase 2.3 — entity-keyed via Employee; backfilled           | `tenantId` | `null` | isolation + equivalence (PASS, fixture missing table) | reports |
| `visas`            | **READY**    | Phase 2.3 — entity-keyed; backfilled                        | `tenantId` | `null` | isolation + equivalence (PASS, fixture missing table) | reports |
| `document_types`   | DISABLED     | Phase 2.4 — catalog `tenantId IS NULL` semantics still open | (pending)  | (n/a)      | — | product+reports |
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

Read-equivalence run on the staging fixture (post-Phase 2.3):

```
3/7 sources equivalent (0 delta, 4 errors)
```

The 4 errors are fixture gaps (`compliance_alerts`, `work_permits`,
`visas`, and the missing `documents.deletedAt` column on the older
fixture schema). They are not behaviour drift. The 3 sources whose
tables exist in the fixture (`employees`, `applicants`, `agencies`)
return identical row sets across legacy and safe paths. Production
runs are expected to materialise all 7 READY sources.

## Cutover order (re-stated from `SAAS_PHASE2_REPORTS_SOURCE_MAPPING.md`)

| Wave | Sources | Status |
|---|---|---|
| Wave A | `employees`, `applicants`, `agencies` | DONE (Phase 2.1) |
| **Wave B (this PR — Phase 2.3)** | `documents`, `compliance_alerts`, `work_permits`, `visas` | **DONE — flipped to READY** |
| Wave B-residual | `document_types` | DISABLED — Phase 2.4 (catalog semantics) |
| Wave C | `employees_*`, `applicants_*`, `documents_with_type` | DISABLED — joined-source rewrite |
| Wave D | `employees_documents_type` | DISABLED — depends on Wave B-residual + C |

## Source-level Done definition

A source moves from **DISABLED** → **READY** when:

1. The primary table has `tenantId` populated for every active row (verified by `verify-tenant-backfill.ts`).
2. Every join in the new `tenantAwareJoins` list contains `<aliasA>.tenant_id = <aliasB>.tenant_id`.
3. The registry's `assertAllValid()` passes.
4. The per-source isolation test passes.
5. The per-source read-equivalence diff is empty (or all deltas explained).
6. Code-owner sign-off recorded in the migration PR.
