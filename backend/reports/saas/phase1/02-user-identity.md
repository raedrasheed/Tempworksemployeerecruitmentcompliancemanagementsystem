# Audit B — User Identity

- **Status:** BLOCKER
- **Started:** 2026-05-09T13:10:56.024Z
- **Duration:** 34 ms

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
  [{"id":"02b9ac7f-6d9f-4fff-85bf-2c53044d2082","email":"admin1@tempworks.test"},{"id":"13db82c0-5c19-468d-8135-944f75c5dc49","email":"admin2@tempworks.test"}]
  ```

## Notes
- Pre-flight contract: users.duplicate-email and users.null-email MUST be 0 before backfill.
- NULL agencyId users require manual disposition (assign, deactivate, or platform-admin).
