# Phase 2.2 — Tenant Context Smoke Test

Generated: 2026-05-09T16:17:55.329Z

- Total cases: 7
- Passed: **7**
- Failed: 0

| # | Case | Result | Detail |
|--:|------|:------:|--------|
| 1 | flags off → no-op resolver | PASS | method=none, tenant=null |
| 2 | staging flags on + valid header → resolves from header | PASS | method=header, tenant=11111111-1111-1111-1111-111111111111 |
| 3 | production flags on → middleware refuses with error | PASS | MULTI_TENANT_ENABLED=true is refused outside staging. Set the flag to false OR move the database to a staging-classified |
| 4 | tenant-safe builder requires a valid tenantId | PASS | rejected empty tenantId |
| 5 | disabled report source fails closed | PASS | documents status=DISABLED, reason=Phase 2.3 — `documents.tenantId` denorm not yet backfilled. |
| 6 | ready source builder emits tenant=$1 first | PASS | sql=""e"."tenantId" = $1 AND "e"."deletedAt" IS NULL…", params[0]=11111111-1111-1111-1111-111111111111 |
| 7 | two parallel ALS frames do not bleed | PASS | seen=["22222222-2222-2222-2222-222222222222","11111111-1111-1111-1111-111111111111"] |
