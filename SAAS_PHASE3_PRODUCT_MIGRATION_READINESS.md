# SaaS Phase 3.0 — Product Migration Readiness

Entry point for Phase 3 product-level SaaS migrations. Phase 3.0
establishes the safety nets (duplicate detection, audit docs,
PlatformAdmin design) that the destructive migrations of Phase 3.1+
depend on.

## What this phase delivers

1. **Read-only duplicate detection** —
   `backend/scripts/saas/phase3/uniqueness-duplicate-report.ts` /
   `npm run saas:phase300-uniqueness-duplicate-report`. Wraps every
   query in `BEGIN READ ONLY`; contains no `INSERT/UPDATE/DELETE` SQL.
2. **Readiness harness** —
   `backend/scripts/saas/phase3/product-migration-readiness.ts` /
   `npm run saas:phase300-product-migration-readiness`. Seeds
   synthetic duplicates in the staging fixture (temporarily lifting
   global UNIQUE constraints so the seed can land), runs the
   read-only report against them, asserts the detector classifies
   them correctly, then deletes the seed rows and restores the
   constraints. Net effect: zero rows changed.
3. **Uniqueness audit** —
   `SAAS_PHASE3_UNIQUENESS_AUDIT.md` lists current vs. desired
   constraints with a four-stage migration order.
4. **PlatformAdmin foundation** —
   `SAAS_PHASE3_PLATFORM_ADMIN_FOUNDATION.md` documents how
   `Agency.isSystem` will be retired in favour of the already-present
   `PlatformAdmin` model.

## What this phase does NOT do

- Add any unique constraint.
- Touch login / session / auth.
- Backfill `PlatformAdmin` rows in production.
- Drop `Agency.isSystem`.
- Modify production data.
- Add any destructive migration.

## Validation

| Check                                | Result |
| ------------------------------------ | ------ |
| `nest build`                         | clean |
| `npx prisma validate`                | clean |
| `npm run saas:schema-lint`           | 0 issues |
| `npm run saas:scan:annotations`      | 0 findings |
| `saas:phase300-uniqueness-duplicate-report` | 0 blocking duplicates (fixture) |
| `saas:phase300-product-migration-readiness` | 13/13 PASS |
| `saas:phase263-workflow-config-isolation` | 19/19 PASS |
| `saas:phase262-pipeline-mutation-isolation` | 17/17 PASS |
| `saas:phase261-pipeline-isolation`   | 12/12 PASS |
| `saas:phase261-pipeline-equivalence` | 12/12 PASS |

Cumulative regression count: **837/837 PASS** (824 from Phase 2.63 + 13
new readiness cases).

## Rollback

Phase 3.0 makes no schema or data changes. Rollback = revert docs and
scripts.

## Production behaviour

Unchanged. No feature flag is flipped. Legacy `Agency.isSystem` paths
remain authoritative.

## Recommended next phase

**Phase 3.1 — Tenant backfill completion.** Re-run the duplicate
report against staging clones of production data. Backfill any
`tenantId IS NULL` rows on `Employee` and `Applicant`. Then plan
Phase 3.2 cleanup of the same-tenant duplicate set surfaced by the
report.
