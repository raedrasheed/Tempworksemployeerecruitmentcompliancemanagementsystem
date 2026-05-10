# Phase 2.14 — Notifications Scheduler Harness

Generated: 2026-05-10T01:33:49.048Z
Environment: SAFE_CLONE (localhost + fixture pattern (db=saas_phase1_fixture))

- Cases passed: **9** / 9
- Cases failed: 0

| # | Case | Result | Detail |
|--:|------|:------:|--------|
| 1 | flags OFF: scheduler invokes legacy runAllChecks (not tenant-aware) | PASS | legacy=true tenantAware=false |
| 2 | flags ON in SAFE_CLONE: scheduler invokes runAllChecksTenantAware | PASS | legacy=false tenantAware=true |
| 3 | planner: 1 ACTIVE non-system selected; 1 system + 1 inactive skipped | PASS | selected=11111111-1111-1111-1111-111111111111 skipped={"system-tenant":1,"inactive":1} |
| 4 | runForTenant: ALS frame carries tenantId (smoke for fanout-tenant entry) | PASS | seen=[{"tenantFromAls":"11111111-1111-1111-1111-111111111111"}] |
| 5 | tenant-aware ON: notifyUploaderAndRoles without ALS tenant raises MissingTenantContextError | PASS | threw=true isMissing=true |
| 6 | tenant-aware ON: notifyUsersByRoles without ALS tenant raises MissingTenantContextError | PASS | threw=true isMissing=true |
| 7 | flags OFF: notifyUsersByRoles does NOT raise the new MissingTenantContextError | PASS | raisedMissing=false (other errors are unrelated to this case) |
| 8 | flags ON outside staging: scheduler stays on legacy path (env classifier refuses tenant-aware) | PASS | legacy=true tenantAware=false |
| 9 | cron timing constant unchanged (6-hour interval) | PASS | source contains 6 * 60 * 60 * 1000: true |