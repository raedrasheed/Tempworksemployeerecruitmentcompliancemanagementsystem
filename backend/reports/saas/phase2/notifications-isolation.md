# Phase 2.10 — Notifications Isolation

Generated: 2026-05-10T01:36:39.828Z
Environment: SAFE_CLONE (localhost + fixture pattern (db=saas_phase1_fixture))
Tenants: A=`11111111-1111-1111-1111-111111111111` B=`22222222-2222-2222-2222-222222222222`
Users: A=`04d09f60-1882-480d-bc03-2ae1d7eb1794` B=`2417d276-bb4f-44c4-941e-8b7650c16086`

- Cases passed: **8** / 8
- Cases failed: 0

| # | Case | Result | Detail |
|--:|------|:------:|--------|
| 1 | pilot ON, tenant A user: list returns ONLY tenant A rows | PASS | ids=6; noB=true; noNull=true |
| 2 | pilot ON, tenant A user: unread count excludes tenant B + NULL-tenant | PASS | userA tenantA unread=3; userB tenantB unread=3 (excluded) |
| 3 | pilot ON, tenant A: markAsRead(B-id) rejected; row.isRead unchanged | PASS | before.isRead=false after.isRead=false |
| 4 | pilot ON, tenant A: markAllAsRead does NOT mutate tenant B rows | PASS | B unread before=3 after=3 |
| 5 | concurrent ALS frames isolated (T_A no B-rows; T_B no A-rows) | PASS | seenA=6; seenB=4; aNoB=true; bNoA=true |
| 6 | pilot OFF: legacy includes NULL-tenant legacy row | PASS | ids=7; includesNull=true |
| 7 | allow-list =nothing ⇒ legacy union (notifications opt-out) | PASS | ids=7; includesNull=true |
| 8 | scheduler/background paths use legacyPrisma (untouched by Phase 2.10) | PASS | 4 check* methods source legacyPrisma.user.findMany: true |