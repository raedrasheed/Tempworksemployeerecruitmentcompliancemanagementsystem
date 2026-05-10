# Phase 2.28 — Applicants Pilot Results

> Reads-first applicants pilot results.
> Companion to `SAAS_PHASE2_APPLICANTS_AUDIT.md` and
> `SAAS_PHASE2_APPLICANTS_SCOPE_SPLIT.md`.

---

## 1. What changed

| Surface | Change |
|---------|--------|
| `src/applicants/applicants.service.ts` | constructor injects `PilotPrismaAccessor`; `prisma`→`legacyPrisma` rename; pilot-aware `prisma` getter + `scope()` helper + new `findApplicantOrFail` private gate |
| `findAll` / `findOne` | `where.tenantId` spread; `findOne` migrated `findUnique`→`findFirst` |
| `getFinancialProfile` / `getAgencyHistory` | parent-gated by Phase 2.28's tenant-scoped `findOne` (no change to inner query — relation is via `applicantId`) |
| `getDeleteRequests` | `applicant: { tenantId }` relation filter (CandidateDeleteRequest has no tenantId column) |
| `exportCsv` / `exportExcel` | `where.tenantId` spread on by-id paths; default path delegates to `findAll` (already narrowed) |
| Mutation sites (~37) | rerouted to `legacyPrisma` with `phase228-excluded-mutation` |
| Email duplicate-check, raw SQL identifier generators, StageTemplate / SystemSetting reads | `phase228-global` |
| Audit log writes | `phase228-audit-log` |
| `src/applicants/applicants.module.ts` | adds `FeatureFlagsModule`, `TenantPrismaService`, `PilotPrismaAccessor` |
| `scripts/scan-annotations.ts` | 5 new tags scoped to `src/applicants/` |
| `scripts/saas/phase2/__fixture__/phase228-applicants-seed.sql` | 1 additional applicant per tenant + financial profile + agency history (idempotent) |
| `scripts/saas/phase2/applicants-equivalence.ts` | new equivalence harness (12 cases) |
| `scripts/saas/phase2/applicants-isolation.ts` | new isolation harness (10 cases incl. source-level meta-assertion) |
| `package.json` | new scripts `saas:phase2-applicants-equivalence` / `…-isolation` |

## 2. What did not change

- No production behaviour change while flags are off.
- No mutation/lifecycle/conversion narrowing (deferred to Phase 2.29+).
- No `Applicant.email @unique` change (per-tenant uniqueness is Phase 3 product).
- No external-actor agency-filter behaviour change (`isExternalActor` agency scope still applies; pilot tenant predicate is **additive**).
- No new feature flag.

## 3. Pilot activation

```
TENANT_PRISMA_PILOT_ENABLED=true
TENANT_PRISMA_PILOT_MODULES=applicants
NODE_ENV=staging
TenantContext.attach({ id: ... })
```

## 4. Equivalence harness — 12/12 PASS

Covers: pilot active flag, findAll total reduction, findOne resolution parity, NotFoundException for missing id, tier filter, status filter, search filter, getFinancialProfile presence, getAgencyHistory rows, getDeleteRequests reduction, response shape preserved.

## 5. Isolation harness — 10/10 PASS

Covers: findAll tenant A only, findOne cross-tenant 404, agencyId=tenantB filter returns 0 from tenant A, search "B-" doesn't leak tenant B, getFinancialProfile cross-tenant 404 (parent gate), getAgencyHistory cross-tenant 404 (parent gate), getDeleteRequests excludes tenant B, concurrent ALS frames isolated, pilot OFF returns union, source-level meta-assertion of all Phase 2.28 patterns.

## 6. Lessons learned

- **External-actor agency filter is preserved**. The pilot tenant predicate is additive: `where.tenantId AND where.agencyId` (when both apply). Phase 2.28 does not change agency-scope semantics.
- **`CandidateDeleteRequest` has no `tenantId` column** — narrowed via `applicant: { tenantId }` relation filter (same pattern as `EmployeeStage` in workflow).
- **`Applicant.email @unique` stays globally unique** — same shape as `Vehicle.registrationNumber`. Per-tenant uniqueness is a Phase 3 schema change.
- **Cross-module conversion paths** (`convertToEmployee` writes to Document/FinancialRecord/Employee) stay legacy. The mutation pilot will need explicit cross-module entity validation.

## 7. Read/write split warning

The reads-first split deliberately leaves these paths unchanged:
- Applicant CRUD (`create`, `update`, `remove`)
- Lifecycle: `updateStatus`, `approveApplicant`, `rejectApplicant`, `setCurrentStage`
- Conversion: `convertLeadToCandidate`, `convertToEmployee`
- Agency: `reassignAgency`, financial profile upsert
- Bulk: `bulkAction`
- Public: `publicSubmit`
- Photo: `uploadPhoto`
- Delete request flow

Phase 2.29+ will land the mutation pilot following the documents 2.21 / vehicles 2.24 / workflow 2.27 pattern.

## 8. Pattern reusability

The pattern now applies to **five end-to-end-or-reads-first modules**: finance, documents, vehicles, workflow, applicants. The applicants module added one new wrinkle (external-actor agency filter preserved alongside pilot scope) — the existing pattern composes cleanly.

## 9. Rollback runbook

```sh
export TENANT_PRISMA_PILOT_MODULES=  # remove 'applicants'
# OR
export TENANT_PRISMA_PILOT_ENABLED=false
```

No DB state introduced; rollback is configuration only.

## 10. Real-DB execution evidence

Cumulative cases on real Postgres 16:

| Module | Cases |
|---|---:|
| Finance | 41 |
| Documents | 52 |
| Vehicles | 65 |
| Workflow | 44 |
| Applicants (NEW) | 22 |
| **Total** | **224/224** |

## 10.1 Phase 2.29 — Mutation pilot delta

Phase 2.29 extends the applicants pilot to mutations. The
applicants module now joins finance, documents, vehicles, and
workflow as the **fifth** end-to-end module proven on real DB
across reads + writes.

New helpers:
- `findAgencyOrFail(id)` — pilot-aware agency tenant gate.
- `findApplicantOrFail(id)` already exists from Phase 2.28.

Per-method changes:
- `create`: spreads `scope.tenantData()` on the new row. Tag `phase229-pilot-scope`.
- `update`, `remove`, `updateStatus`, `setCurrentStage`,
  `approveApplicant`, `rejectApplicant`, `upsertFinancialProfile`,
  `convertLeadToCandidate`, `reassignAgency`, `requestDelete`:
  rely on the Phase 2.28 tenant-scoped `findOne` pre-check; by-id
  mutation sites retagged `phase229-pilot-scope-precheck`.
- `convertLeadToCandidate` / `reassignAgency`: NEW
  `findAgencyOrFail` for target agency.
- `convertToEmployee`: parent applicant gate via `findOne` + NEW
  spread `scope.tenantData()` on the `employee.create.data`. The
  cross-module `document.updateMany` and `financialRecord.updateMany`
  filter by `entityType + entityId` which the gated applicant
  guarantees is tenant A. **Conversion semantics UNCHANGED.**
- `bulkAction`: NEW pre-filter — `applicant.findMany({ id: { in }, ...t })`
  before the per-id loop. Foreign ids silently dropped. Tag
  `phase229-bulk-filter`. Response shape preserved (`processed`
  reports the original input length; `results` reflects only
  processed ids).
- `reviewDeleteRequest`: NEW pre-check via parent applicant
  relation filter (`candidateDeleteRequest.findFirst({ id, applicant: { tenantId } })`).

Deferred:
- `publicSubmit` — DEFERRED_PUBLIC_ENTRY (no ALS frame today; needs product input).
- `uploadPhoto` — DEFERRED_HIGH_RISK (storage upload precedes tenant gate; Phase 2.30+ storage-guard).

New harnesses (real-DB SAFE_CLONE):
- `applicants-mutation-equivalence` (10 cases): create shape +
  tenantId NULL/set, update / updateStatus / soft-delete parity,
  validation parity, bulk filter behavior, requestDelete creates
  request.
- `applicants-mutation-isolation` (11 cases): cross-tenant
  rejections for update / updateStatus / remove / setCurrentStage /
  approveApplicant / reassignAgency / requestDelete; agency gate
  rejects cross-tenant target; bulk filter silently drops B ids;
  legacy mode unchanged; source-level meta-assertion.

Real-DB results: **21/21 mutation cases PASS** + 22/22 read cases
PASS = **43/43 applicants** total. Cumulative finance + documents
+ vehicles + workflow + applicants: **245/245** on real Postgres 16.

Conversion semantics, agency-scope behavior, email uniqueness,
and identifier generation are all unchanged.

## 11. Next recommended module

- **Phase 2.29 — Applicants mutation pilot** (recommended; mirrors finance/documents/vehicles/workflow precedent of completing one module before starting another).
- Cross-module audit-log tenancy phase.

## 12. Blockers before applicant write/conversion refactor

- `Applicant.email @unique` global uniqueness — Phase 3 product question for per-tenant.
- `convertToEmployee` cross-module writes (Document / FinancialRecord / Employee) need explicit cross-module entity validation.
- `publicSubmit` runs without an ALS tenant frame — needs explicit handling (document as deferred or pin to a default tenant).
- `bulkAction` operates on multiple ids; mutation pilot must filter the id list by tenant before any mutation (mirror documents 2.22 download-guard pattern).
