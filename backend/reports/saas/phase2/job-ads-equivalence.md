# Phase 2.9 — Job Ads Equivalence

Generated: 2026-05-09T18:29:02.352Z
Environment: SAFE_CLONE (localhost + fixture pattern (db=saas_phase1_fixture))
Tenant A: `11111111-1111-1111-1111-111111111111` · slug: `engineer-acme` · id: `00000000-0000-0000-0000-0000000a0001`

- Cases passed: **13** / 13
- Cases failed: 0

| # | Case | Result | Detail |
|--:|------|:------:|--------|
| 1 | legacy: pilot OFF reports pilotActive=false | PASS | TENANT_PRISMA_PILOT_ENABLED=false |
| 2 | pilot: pilot ON + module allow-list ⇒ pilotActive=true | PASS | pilot ON, env=SAFE_CLONE |
| 3 | findAll: pilot total < legacy total (cross-tenant rows filtered) | PASS | legacy=8 pilot=2 |
| 4 | findPublished: pilot total <= legacy total | PASS | legacy=7 pilot=1 |
| 5 | findBySlug(tenantA-slug): both modes resolve the same id | PASS | legacy=00000000-0000-0000-0000-0000000a0001 pilot=00000000-0000-0000-0000-0000000a0001 |
| 6 | findOne(tenantA-id): both modes resolve to tenantA id | PASS | legacy=00000000-0000-0000-0000-0000000a0001 pilot=00000000-0000-0000-0000-0000000a0001 |
| 7 | error path: NotFoundException for missing id in both modes | PASS | legacy=NotFoundException pilot=NotFoundException |
| 8 | create legacy: tenantId is NULL | PASS | legacy.tenantId=null |
| 9 | create pilot: tenantId is set to active tenant | PASS | pilot.tenantId=11111111-1111-1111-1111-111111111111 tenantA=11111111-1111-1111-1111-111111111111 |
| 10 | create slug: legacy + pilot both got a non-empty slug | PASS | legacy=rehearsal-job-mod1vd pilot=rehearsal-job-1ubh2v |
| 11 | update reflects new title in BOTH modes | PASS | legacy=rehearsal-job-mod1vd-updated pilot=rehearsal-job-1ubh2v-updated |
| 12 | remove sets deletedAt in BOTH modes (soft delete) | PASS | legacy=set pilot=set |
| 13 | response shape preserved (PaginatedResponse<JobAd>) | PASS | legacy=true pilot=true |