# Phase 2.47 — Attendance Pilot Results

> Reads-first TenantPrisma pilot for `src/attendance` plus mutation
> parent-gate. Default-off; configuration-only rollback.

## Module status

| Aspect | Status |
|---|---|
| Read paths under pilot | 2/2 (`listEmployeesWithStats`, `getEmployeeAttendance`) |
| Mutation parent gate | 4 sites (`upsertRecord`, `bulkApply`, `updateRecord`, `deleteRecord`) |
| Excel export | deferred (`phase247-attendance-deferred-export`) |
| Audit emission | unchanged (`legacyPrisma.auditLog.create`) |
| Locked-period table | unchanged (intentionally global) |
| Schema migration | none |
| Production behaviour change with flags off | none |

## Harness results — confirmed against `saas_phase1_fixture` (Phase 2.47B)

```
[attendance-equivalence] 12/12 PASS
[attendance-isolation]   12/12 PASS
```

## Cumulative regression chain — confirmed real-DB

Phase 2.47 adds 24 cases to the cumulative chain:
**527/527 PASS** (was 503/503 after Phase 2.46).

Sentinels re-run green:
- notifications-internal-scan-dedup 13/13
- notifications-dedup 12/12
- compliance-scheduler-health 12/12
- compliance-notification-coupling 12/12
- notifications-equivalence 11/11
- notifications-isolation 10/10
- compliance-equivalence + compliance-isolation
- audit-log-tenancy 8/8
- agencies-mutation-isolation 9/9
- employees-mutation-isolation 12/12
- applicants-mutation-isolation 11/11
- finance-mutation-isolation 16/16
- documents-mutation-isolation 9/9
- vehicles-isolation 10/10
- workflow-mutation-isolation 11/11

## Rollback

```sh
TENANT_PRISMA_PILOT_ENABLED=false
# OR
TENANT_PRISMA_PILOT_MODULES=nothing
```

No data, no schema migration introduced.

## Recommended next phase

- **2.48 — Attendance mutation pilot**: route `AttendanceRecord.create`
  / `upsert` writes through a tenant-stamping helper, route audit
  emission through `TenantAuditLogService`, and apply tenant
  predicate to the Excel export queries.
