# Recon A — User Identity

- **Mode:** `dry-run`
- **Status:** **BLOCKER**
- **Database:** `postgres://postgres@127.0.0.1/saas_phase1_fixture?sslmode=disable`
- **Started:** 2026-05-09T14:03:35.937Z
- **Duration:** 34 ms

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
| `user.no-agency` | no | assign-tenant | platform-admin | deactivate | {"id":"f2508de8-3c9f-43c8-bf36-5a315cc5d1d3","email":"orphan@nowhere.test","status":"ACTIVE"} |
| `user.platform-admin-candidate` | no | platform-admin:SUPER (downgrade post-cutover) | {"id":"1b60732d-64a2-4dca-be9b-b8a70c828682","email":"admin1@tempworks.test"} |
| `user.platform-admin-candidate` | no | platform-admin:SUPER (downgrade post-cutover) | {"id":"5d860dcc-d7c7-4b2f-975e-754ffe33aa86","email":"admin2@tempworks.test"} |
| `user.soft-deleted-skipped` | no | skip-from-membership-backfill | {"count":1} |

## Notes
- No user rows are modified by this script. Apply mode only inserts proposals into saas_reconciliation_queue.
- Ops drains the queue with the queue-cli (TKT-P1-07) before backfill runs.
