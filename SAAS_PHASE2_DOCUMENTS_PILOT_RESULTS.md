# Phase 2.20 — Documents Pilot Results

> Reads-first documents pilot results.
> Companion to `SAAS_PHASE2_DOCUMENTS_AUDIT.md` and
> `SAAS_PHASE2_DOCUMENTS_SCOPE_SPLIT.md`.

---

## 1. What changed

| Surface | Change |
|---------|--------|
| `src/documents/documents.service.ts` | constructor injects `PilotPrismaAccessor`; legacy `prisma` renamed `legacyPrisma`; pilot-aware `prisma` getter + `scope()` helper |
| 9 read sites | spread `scope.tenantWhere()` into where clause; annotated `phase220-pilot-scope` |
| 6 catalog sites | annotated `phase220-global` (DocumentType, DocumentTypePermission) |
| 32 mutation / helper / audit / download sites | rerouted to `legacyPrisma`; annotated `phase220-excluded-mutation` / `phase220-excluded-helper` / `phase220-excluded-download` / `phase220-audit-log` |
| `src/documents/documents.module.ts` | adds `FeatureFlagsModule`, `TenantPrismaService`, `PilotPrismaAccessor` |
| `scripts/scan-annotations.ts` | six new tags scoped to `src/documents/` |
| `scripts/saas/phase2/__fixture__/phase220-documents-seed.sql` | 2 document types + 1 system user + 4 documents (2 per tenant) |
| `scripts/saas/phase2/documents-equivalence.ts` | new equivalence harness (10 cases) |
| `scripts/saas/phase2/documents-isolation.ts` | new isolation harness (9 cases including source-level meta-assertion) |
| `package.json` | new scripts `saas:phase2-documents-equivalence` / `…-isolation` |

## 2. What did not change

- No production behaviour change while flags are off.
- No mutation/upload/download narrowing (deferred to Phase 2.21+).
- No storage key change.
- No DocumentType / DocumentTypePermission schema change.
- No new feature flag.

## 3. Production default

| Flag | Default | This PR |
|------|---------|---------|
| `TENANT_PRISMA_PILOT_ENABLED` | `false` | unchanged |
| `TENANT_PRISMA_PILOT_MODULES` | unset | unchanged |
| `MULTI_TENANT_ENABLED` | `false` | unchanged |

With defaults, `getPilotScope(this.pilot, 'documents').tenantWhere()`
returns `{}` — every read query is byte-identical to pre-2.20.

## 4. Pilot activation

```
TENANT_PRISMA_PILOT_ENABLED=true
TENANT_PRISMA_PILOT_MODULES=documents       # or empty (allow-all)
NODE_ENV=staging                            # SAFE_CLONE / SAFE_STAGING classifier
TenantContext.attach({ id: ... })           # ALS frame
```

When all four are true, `tenantWhere()` returns `{ tenantId }` and
the read queries narrow.

## 5. Equivalence harness — 10/10 PASS

`saas:phase2-documents-equivalence` covers:

1. legacy: pilot OFF reports `pilotActive=false`
2. pilot: pilot ON + documents allow-list ⇒ `pilotActive=true`
3. `findAll`: pilot total <= legacy total
4. `findOne`: legacy + pilot resolve same id
5. error path: NotFoundException for missing id in both modes
6. `findByEntity`: pilot count <= legacy count
7. `getExpiringDocuments`: pilot count <= legacy count
8. `readDocumentBytes` metadata lookup succeeds in both modes
9. `checkDocTypePermission`: global catalog identical
10. response shape preserved

## 6. Isolation harness — 9/9 PASS

`saas:phase2-documents-isolation` covers:

1. pilot ON, tenant A: `findAll` returns only tenant A docs
2. pilot ON, tenant A: `findOne(tenantB-id)` raises NotFoundException
3. pilot ON, tenant A: `findByEntity` on tenant B's employee returns 0
4. pilot ON, tenant A: `getExpiringDocuments` excludes tenant B
5. pilot ON, tenant A: **`readDocumentBytes(tenantB-id)` raises NotFoundException — no storage byte fetch issued**
6. pilot ON: `checkDocTypePermission` (global catalog) returns boolean
7. concurrent ALS frames isolated
8. pilot OFF: legacy reads include both tenants
9. **source-level meta-assertion**: every mutation method
   (`create`, `update`, `verify`, `renew`, `remove`,
   `upsertDocTypePermission`, `createBulkDownloadArchive`,
   `checkAndAutoCompleteStage`) sources `legacyPrisma`

## 7. File-storage warning

The Phase 2.20 narrowing on `readDocumentBytes` is metadata-only:
the `findFirst` lookup is tenant-scoped. The `fetchDocumentBuffer`
storage fetch operates on the URL the metadata returned. Since the
metadata cannot return a foreign tenant's row in pilot mode, the
storage fetch can never reach a foreign file. **This property is
verified by isolation case 5.**

`createBulkDownloadArchive(ids[])` has NOT been narrowed: it is a
list endpoint that loops over caller-supplied ids and downloads
each. Phase 2.22 will add a tenant pre-filter on the id list
before any storage fetch.

## 8. Read/write split warning

The reads-first split deliberately leaves these mutation paths
unchanged:

- `create` (upload + transactional insert): cross-tenant entity
  validation must run BEFORE storage upload to avoid orphan files.
- `update`, `verify`, `renew`, `remove`: gated by `findOne`
  pre-check (which IS tenant-scoped in this phase), but the by-id
  mutation site is still legacy. Phase 2.21 will land the
  reads-then-writes pattern from finance 2.17.
- `upsertDocTypePermission`: catalog mutation. Per-tenant catalog
  is a Phase 3 product change.

## 9. Pattern reusability

The pilot pattern from finance 2.16/2.17/2.17.1 is fully reusable:

- Constructor injection of `PilotPrismaAccessor`.
- `private get prisma()` returns `pilot.client()`.
- `private scope()` returns `getPilotScope(this.pilot, '<module>')`.
- Read sites spread `scope.tenantWhere()`.
- Mutation/storage sites stay on `legacyPrisma` with explicit
  exclusion tags.
- Source-level meta-assertion in the isolation harness keeps
  reviewers honest.

The documents module fit the pattern with no surprises beyond the
catalog (`DocumentType*`) decision (treat as global until Phase 3).

## 10. Rollback runbook

```sh
# To halt the documents pilot:
export TENANT_PRISMA_PILOT_MODULES=  # remove 'documents'

# To halt the framework entirely:
export TENANT_PRISMA_PILOT_ENABLED=false
```

No DB state introduced; rollback is configuration only.

## 11. Next recommended module

The pattern is now proven on `roles` (2.6), `employee-work-history`
(2.7), `compliance` (2.8), `job-ads` (2.9), `notifications`
(2.10), `recycle-bin` (2.11), `finance` (2.16/2.17/2.17.1/2.18/
2.19), and `documents` (2.20). The natural next modules are:

- `vehicles` (47 Prisma sites; Phase 2 inventory flagged this as a
  high-risk module — already has `agencyId` on rows so reads-first
  should be similar to documents).
- `workflow` (35 Prisma sites; system-template + clone is the
  hard part; reads-first should land first).
- `applicants` (large module touching many lifecycle flows).
- Documents Phase 2.21 (mutation paths) — do this BEFORE moving to
  another module if the operator wants finance-grade mutation
  coverage on documents too.

## 12. Blockers before documents write/upload/download refactor

- `create` upload path: needs cross-entity tenant validation BEFORE
  storage upload to avoid orphan files. Plan documented in scope
  split §3.
- `createBulkDownloadArchive(ids[])` needs a tenant pre-filter on
  the id list. Plan documented in scope split §4.
- Per-tenant DocumentType catalog (if product wants it) needs a
  schema change; not blocking the next module pilot.
- Notification side effects already handled by Phase 2.15 fanout
  writers when their flags are on.

## 13. Real-DB execution evidence

Same SAFE_CLONE used by Phase 2.16/2.17/2.17.1/2.18/2.19
(`postgresql://…@127.0.0.1:5432/saas_phase1_fixture`). Total
finance + documents harness cases:

| Harness | Cases | Result |
|---|---:|:---:|
| `saas:phase2-finance-equivalence` | 9/9 | PASS |
| `saas:phase2-finance-isolation` | 7/7 | PASS |
| `saas:phase2-finance-mutation-equivalence` | 9/9 | PASS |
| `saas:phase2-finance-mutation-isolation` | 16/16 | PASS |
| `saas:phase2-documents-equivalence` | 10/10 | PASS |
| `saas:phase2-documents-isolation` | 9/9 | PASS |

**60/60 cases PASS** on real Postgres 16.
