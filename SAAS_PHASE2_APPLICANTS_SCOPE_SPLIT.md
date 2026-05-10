# Phase 2.28 — Applicants Scope Split

> What ships in Phase 2.28 vs. what waits for Phase 2.29+.

---

## 1. Scope summary

| Area | Phase | This PR? |
|------|------|----------|
| `findAll` / `findOne` | **2.28** | YES — narrowed via tenantWhere() + existing external-actor agency filter |
| `getFinancialProfile` / `getAgencyHistory` (parent-gated reads) | **2.28** | YES — NEW `findApplicantOrFail` parent gate |
| `getDeleteRequests` (candidate-of-tenant relation filter) | **2.28** | YES |
| `exportCsv` / `exportExcel` | **2.28** | YES |
| Applicant CRUD (`create`, `update`, `remove`) | 2.29+ | NO |
| Lead-to-candidate conversion | 2.29+ | NO |
| Candidate-to-employee conversion (transactional, multi-table) | 2.29+ | NO |
| Status flows (`updateStatus`, `approveApplicant`, `rejectApplicant`) | 2.29+ | NO |
| Workflow stage assignment (`setCurrentStage`) | 2.29+ | NO |
| Agency reassignment (`reassignAgency`) | 2.29+ | NO |
| Financial profile upsert | 2.29+ | NO |
| `bulkAction` | 2.29+ | NO |
| Photo upload (`uploadPhoto`) | 2.30+ (storage) | NO |
| Public submit (`publicSubmit`) + email notifications | 2.29+ | NO |
| `requestDelete` / `reviewDeleteRequest` | 2.29+ | NO |
| Email global uniqueness | Phase 3 product | NO |

## 2. Phase 2.28 — Read path refactor (THIS PR)

What lands:
- `ApplicantsService` constructor injects `PilotPrismaAccessor`.
- `private get prisma()` returns `pilot.client()`.
- `private scope()` returns `getPilotScope(this.pilot, 'applicants')`.
- New private helper `findApplicantOrFail(id)` — pilot-aware tenant pre-check used by `getFinancialProfile` and `getAgencyHistory`.
- Read sites spread `scope.tenantWhere()` into the `where` clause; `findOne` migrates `findUnique` → `findFirst`.
- All mutation sites (every `create*`/`update*`/`delete*`/`convert*`/`approve*`/`reject*`/`setCurrentStage`/`reassignAgency`/`upsertFinancialProfile`/`bulkAction`/`requestDelete`/`reviewDeleteRequest`) routed through `legacyPrisma` with `phase228-excluded-mutation`.
- All `auditLog.create` sites tagged `phase228-audit-log`.
- Raw SQL identifier generators tagged `phase228-global`.

What does NOT land:
- No mutation behaviour change.
- No new feature flag.
- No schema change.
- No email-uniqueness change.
- No external-actor agency-filter behaviour change.

## 2.1 Phase 2.29 update — mutation pilot shipped

Phase 2.29 closes the applicants reads-then-writes split. See
`SAAS_PHASE2_APPLICANTS_MUTATION_AUDIT.md` and
`SAAS_PHASE2_APPLICANTS_MUTATION_SCOPE_DECISION.md`.

- New `findAgencyOrFail` helper (tenant-scoped via pilot client).
- `create` writes `tenantId` via `scope.tenantData()`.
- `update` / `remove` / `updateStatus` / `setCurrentStage` /
  `approveApplicant` / `rejectApplicant` / `upsertFinancialProfile` /
  `convertLeadToCandidate` / `reassignAgency` / `requestDelete`
  rely on the Phase 2.28 tenant-scoped `findOne` pre-check.
- `convertLeadToCandidate` / `reassignAgency` add target-agency
  gate via `findAgencyOrFail`.
- `convertToEmployee` parent gate via `findOne` + `tenantData`
  spread on `employee.create`.
- `bulkAction` pre-filters cross-tenant ids via
  `applicant.findMany({ id: { in }, ...t })`.
- `reviewDeleteRequest` pre-check via parent applicant relation
  filter.
- `publicSubmit` DEFERRED_PUBLIC_ENTRY; `uploadPhoto`
  DEFERRED_HIGH_RISK.

## 3. Phase 2.30+ — Public + storage refactor (FUTURE)

The applicants module has the largest mutation surface piloted so far. The mutation pilot will need:
- `findApplicantOrFail` parent gate (already added in 2.28) used by every mutation that takes an applicant id.
- `scope.tenantData()` spread on `applicant.create` (in `create`, `publicSubmit`).
- Cross-module entity validation in `convertToEmployee` (Document/FinancialRecord/Employee target tenant must equal active tenant).
- Pre-check switches on `update`/`updateStatus`/`remove` etc. (currently use `findUnique({ id })`).

## 4. Phase 2.30+ — Storage refactor (FUTURE)

`uploadPhoto` runs `storage.uploadFile` BEFORE `applicant.update({ photoUrl })`. Phase 2.30 will mirror documents 2.21 storage-guard.

## 5. Email uniqueness — UNCHANGED

`Applicant.email @unique`. Two tenants cannot register the same email. Per-tenant uniqueness needs Phase 3 schema migration. Phase 2.28 does NOT change this.

## 6. Agency-scope behaviour — UNCHANGED

`findAll`/`findOne` already filter by `agencyId` for external actors. Phase 2.28 keeps this behaviour exactly; the pilot tenant predicate is additive (`tenantId AND agencyId` when both apply).

## 7. Guard-rails enforced by this PR

- Source-level meta-assertion in the isolation harness: every mutation method sources `legacyPrisma`.
- All `legacyPrisma.*` mutation sites carry `phase228-excluded-mutation`.
- All `auditLog.create` sites carry `phase228-audit-log`.
- The fixture seeds two tenants × multiple applicants so reads can be exercised with cross-tenant collision shapes.

## 8. Operator checklist for Phase 2.29

- [ ] Read this scope-split document.
- [ ] Re-run `saas:phase2-applicants-equivalence` and `…-isolation`.
- [ ] Add a new harness `saas:phase2-applicants-mutation-equivalence`.
- [ ] Update the `phase228-excluded-mutation` annotations to `phase229-pilot-scope` once mutation paths engage the pilot.
