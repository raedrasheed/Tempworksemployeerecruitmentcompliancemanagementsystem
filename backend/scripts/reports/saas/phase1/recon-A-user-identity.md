# Recon A — User Identity

- **Mode:** `dry-run`
- **Status:** **BLOCKER**
- **Database:** `postgres://postgres@127.0.0.1/saas_phase1_fixture?sslmode=disable`
- **Started:** 2026-05-09T13:25:56.091Z
- **Duration:** 30 ms

## Metrics

| Key | Value | Note |
|-----|-------|------|
| `users.duplicate-emails` | 0 |  |
| `users.null-email` | 0 |  |
| `users.invalid-email` | 0 |  |
| `users.no-agency` | 1 |  |
| `users.system-agency` | 2 |  |
| `users.soft-deleted` | 1 |  |

## Actions

| Kind | Applied | Proposed | Subject |
|------|---------|----------|---------|
| `user.no-agency` | no | assign-tenant | platform-admin | deactivate | {"id":"ad0b4f57-c3d0-47e3-8a3f-d3d058d62d88","email":"orphan@nowhere.test","status":"ACTIVE"} |
| `user.platform-admin-candidate` | no | platform-admin:SUPER (downgrade post-cutover) | {"id":"02b9ac7f-6d9f-4fff-85bf-2c53044d2082","email":"admin1@tempworks.test"} |
| `user.platform-admin-candidate` | no | platform-admin:SUPER (downgrade post-cutover) | {"id":"13db82c0-5c19-468d-8135-944f75c5dc49","email":"admin2@tempworks.test"} |
| `user.soft-deleted-skipped` | no | skip-from-membership-backfill | {"count":1} |

## Notes
- No user rows are modified by this script. Apply mode only inserts proposals into saas_reconciliation_queue.
- Ops drains the queue with the queue-cli (TKT-P1-07) before backfill runs.
