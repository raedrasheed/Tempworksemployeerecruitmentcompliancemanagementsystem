# Audit B — User Identity

- **Status:** BLOCKER
- **Started:** 2026-05-09T14:02:33.560Z
- **Duration:** 32 ms

## Metrics

| Key | Value | Note |
|-----|-------|------|
| `users.total` | 14 |  |
| `users.soft-deleted` | 1 |  |
| `users.null-email` | 0 |  |
| `users.duplicate-emails` | 0 |  |
| `users.no-agency` | 1 |  |
| `users.system-agency` | 2 |  |
| `tenant_memberships.preexisting` | 0 |  |
| `users.status-counts` | [{"status":"ACTIVE","n":13},{"status":"INACTIVE","n":1}] |  |

## Findings

- **[BLOCKER]** `user.no-agency` — 1 users have NULL agencyId. Each must be reconciled (delete, assign, or platform-admin).
- **[INFO]** `user.platform-admin-candidates` — 2 users belong to the system agency. They become PlatformAdmin rows.
  ```json
  [{"id":"1b60732d-64a2-4dca-be9b-b8a70c828682","email":"admin1@tempworks.test"},{"id":"5d860dcc-d7c7-4b2f-975e-754ffe33aa86","email":"admin2@tempworks.test"}]
  ```

## Notes
- Pre-flight contract: users.duplicate-email and users.null-email MUST be 0 before backfill.
- NULL agencyId users require manual disposition (assign, deactivate, or platform-admin).
