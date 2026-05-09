# Phase 1 — Dry-Run Tenant Backfill Result

- **Mode:** `dry-run`
- **Status:** **ROLLED_BACK**
- **Database:** `postgres://postgres@127.0.0.1/saas_phase1_fixture?sslmode=disable`
- **Started:** 2026-05-09T13:28:12.401Z
- **Duration:** 62 ms

## Pre-flight summary

| Check | Count |
|-------|-------|
| duplicate emails | 0 |
| NULL-agency users | 1 |
| employee email collisions | 0 |
| employee code collisions | 1 |

## Projection

| Agency | Tenant Slug | Conflicts |
|--------|-------------|-----------|
| Acme HR | `acme-hr` | — |
| Globex Co. | `globex-co` | — |
| Initech | `initech` | — |
| Empty Co | `empty-co` | — |

## Writes (rolled back unless --apply)

- tenants: **4**
- defaultAgencies: **4**
- memberships: **11**
- agencyMemberships: **11**
- membershipRoles: **11**
- membershipPermissionOverrides: **0**
- platformAdmins: **2**
- quarantineRows: **1**
- tenantIdAssignments: {"applicants":72,"employees":29,"vehicles":2}

## Verification

| Check | OK | Detail |
|-------|----|--------|
| tenants.count | PASS | {"actual":4,"expected":4} |
| users.with-agency-have-membership | PASS | {"count":0} |
| users.no-agency.handled | PASS | {"count":0} |
| applicants.tenantId-populated | PASS | {"stillNull":0} |
| employees.tenantId-populated | PASS | {"stillNull":0} |

## Notes

- This script does NOT touch identifier_sequences (TKT-P1-05).
- This script does NOT migrate Document/FinancialRecord tenantId (Phase 2).
- Re-running this script in --apply mode is idempotent due to the agency_split_progress checkpoint.
- Roll back any --apply by restoring from the pre-migration snapshot — the original `agencies` rows are deleted.
