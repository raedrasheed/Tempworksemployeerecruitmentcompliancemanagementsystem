# Phase 2.10 — Notifications Equivalence

Generated: 2026-05-09T18:48:04.905Z
Environment: SAFE_CLONE (localhost + fixture pattern (db=saas_phase1_fixture))
Tenant A: `11111111-1111-1111-1111-111111111111` · user: `04d09f60-1882-480d-bc03-2ae1d7eb1794`

- Cases passed: **11** / 11
- Cases failed: 0

| # | Case | Result | Detail |
|--:|------|:------:|--------|
| 1 | legacy: pilot OFF reports pilotActive=false | PASS | TENANT_PRISMA_PILOT_ENABLED=false |
| 2 | pilot: ON + module allow-list ⇒ pilotActive=true | PASS | pilot ON, env=SAFE_CLONE |
| 3 | getUserNotifications: pilot total <= legacy total (filtered) | PASS | legacy=7 pilot=6 |
| 4 | getUserNotifications: pilot excludes NULL-tenant legacy row | PASS | pilotIds=6 ids |
| 5 | getUserNotifications: legacy includes NULL-tenant legacy row | PASS | legacyIds.includes legacy=true |
| 6 | getUnreadCount: pilot <= legacy | PASS | legacy=4 pilot=3 |
| 7 | wasHighBalanceAlertRecentlySent: legacy true (any tenant), pilot true (tenant A row exists) | PASS | legacy=true pilot=true |
| 8 | markAsRead(missing-id): pilot raises NotFoundException; legacy raises Prisma error | PASS | legacy=PrismaClientKnownRequestError pilot=NotFoundException |
| 9 | getOrCreatePreferences: returns identical preferences id (per-user global record) | PASS | legacy=0d6820ab-affe-43d2-b84b-57209551d07c pilot=0d6820ab-affe-43d2-b84b-57209551d07c |
| 10 | markAllAsRead pilot ON: tenant A unread → 0; tenant B unread unchanged | PASS | A: 3→0; B: 3→3 |
| 11 | response shape preserved ({ data: [...], total: number }) | PASS | arrays + numeric total in both modes |