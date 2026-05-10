# Phase 2.47 — Attendance Module Audit + Reads-First Pilot

> Audit + reads-first TenantPrisma pilot split for `src/attendance`.
> Default-off; configuration-only rollback; no schema migration.

---

## 1. Module surface

```
backend/src/attendance/
├── attendance.controller.ts   (145 LoC, 11 endpoints)
├── attendance.service.ts      (1278 LoC pre-2.47 / now ~1300)
├── attendance.module.ts
└── dto/attendance.dto.ts
```

## 2. Scope map

### A. Read paths — IN PILOT (Phase 2.47)
| Endpoint | Service method | Tag |
|---|---|---|
| `GET /attendance/employees` | `listEmployeesWithStats` | `phase247-attendance-pilot-scope` |
| `GET /attendance/employees/:id` | `getEmployeeAttendance` | `phase247-attendance-pilot-scope` |

### B. Mutation paths — gated parent only (writes stay on `legacyPrisma`)
| Endpoint | Service method | Tag |
|---|---|---|
| `POST /attendance` | `upsertRecord` | `phase247-attendance-mutation-scope` |
| `POST /attendance/bulk` | `bulkUpsert` | `phase247-attendance-mutation-scope` |
| `POST /attendance/bulk-apply` | `bulkApply` | `phase247-attendance-mutation-scope` |
| `PATCH /attendance/:id` | `updateRecord` | `phase247-attendance-mutation-scope` |
| `DELETE /attendance/:id` | `deleteRecord` | `phase247-attendance-mutation-scope` |

The mutation parent gate (`findEmployeeForMutationOrFail`,
`findRecordForMutationOrFail`) loads the parent through
`pilot.client()` with `scope().tenantWhere()`. With the flag off
`tenantWhere()` returns `{}` so the lookup reduces to plain by-id —
byte-identical to pre-2.47. With the pilot active a cross-tenant id
raises `NotFoundException` BEFORE the legacy mutation runs.

### C. Excluded / deferred
| Path | Reason | Tag |
|---|---|---|
| `GET /attendance/locked-periods`, `POST /attendance/locked-periods`, `DELETE /attendance/locked-periods/:id` | `AttendanceLockedPeriod` is intentionally global — no `tenantId` per schema comment ("Intentionally global for MVP (not per-employee) so one payroll run seals the whole month at once"). | `phase247-attendance-mutation-scope` (annotation only) |
| `GET /attendance/export/excel` | Export bundles many tenants of data; deferring to a later phase that can also stream / paginate. | `phase247-attendance-deferred-export` |
| Audit log emission via `legacyPrisma.auditLog.create` | Routing through `TenantAuditLogService` deferred to the mutation-pilot phase (parity with the Phase 2.33/2.34 split). | `phase247-attendance-audit-log` |

## 3. Tenant join strategy

`AttendanceRecord.tenantId` is **already denormalised** as a nullable
column (Phase 2.3 entity-keyed denorm — see `prisma/schema.prisma:1564`):

```prisma
model AttendanceRecord {
  ...
  // Phase 2.3 entity-keyed denorm.
  tenantId   String?
  @@index([tenantId])
  @@index([tenantId, date])
}
```

Therefore the pilot does **not** need to join through `Employee` — it
applies `tenantWhere() === { tenantId }` directly to both the parent
`Employee` lookup and the child `AttendanceRecord` query. Both
gates are in place because:
- Filtering only the parent leaves the door open to child rows whose
  `tenantId` mismatches (defence-in-depth).
- Filtering only the child would still leak parent metadata.

NULL-tenant legacy `AttendanceRecord` rows are **excluded** in pilot
mode (the equality predicate `tenantId = <active>` is exclusive of
NULL). With the flag off they remain visible (legacy union).

## 4. Production behaviour change

**None.** With `TENANT_PRISMA_PILOT_ENABLED=false` (default):
- `pilot.client()` returns the legacy `PrismaService`.
- `scope()` is inactive ⇒ `tenantWhere()` returns `{}`.
- All read paths reduce to the original `where` clauses.
- All mutation parent gates reduce to the original by-id lookup.
- `legacyPrisma.notification.create`, `auditLog.create`, lock-period,
  export-excel paths are byte-identical to pre-2.47.

## 5. Equivalence — 12/12 PASS

```
[attendance-equivalence] 12/12 PASS
```

1. pilot disabled returns legacy list shape (`data` + `meta` keys)
2. pilot disabled count matches legacy union (≥ 2 employees)
3. pilot enabled response shape preserved
4. pilot enabled list ⊂ legacy union
5. date-range filter equivalent (legacy ≥ pilot, both > 0)
6. employee filter works for same-tenant employee under pilot
7. pagination shape preserved (`page=1, limit=1`)
8. mutation shape preserved (`upsert` returns `id + employee`)
9. allow-list unset ⇒ all modules allowed
10. allow-list `attendance` allows attendance, denies others
11. allow-list comma-separated allows both
12. allow-list `nothing` ⇒ scope inactive (legacy reading restored)

## 6. Isolation — 12/12 PASS

```
[attendance-isolation] 12/12 PASS
```

1. tenant A list returns only tenant A employees
2. tenant A `getEmployeeAttendance` for tenant B employee raises `NotFound`
3. tenant A reads do NOT see NULL-tenant legacy attendance row
4. tenant A summary counts only tenant A records
5. tenant A date-range list excludes tenant B
6. employee filter rejects tenant B employee (NotFound)
7. tenant A `updateRecord` on tenant B record id raises `NotFound` (no mutation)
8. tenant B row unchanged after rejected mutation
9. create under tenant A returns id + employee (tenant A linkage via existing denorm)
10. tenant A `bulkApply` for tenant B employee raises `NotFound`
11. concurrent ALS frames remain isolated
12. allow-list `nothing` ⇒ NULL-tenant row visible (legacy union)

## 7. Rollback runbook

```sh
TENANT_PRISMA_PILOT_ENABLED=false           # disables pilot probe
# OR
TENANT_PRISMA_PILOT_MODULES=nothing         # disables attendance pilot only
# OR remove "attendance" from the allow-list and keep other modules.
```

No data, no schema migration introduced. Configuration-only rollback.

## 8. Remaining blockers / next phase

- **Mutation phase**: stamp `tenantId` on `AttendanceRecord.create` /
  `upsert` from ALS frame instead of relying on the existing entity-
  keyed denorm trigger. Route audit emission through
  `TenantAuditLogService`.
- **Excel export phase**: stream + paginate; apply tenant predicate
  to `employee.findMany` and `attendanceRecord.findMany` inside the
  pilot client.
- **Locked period scoping**: today global; a future product phase may
  introduce per-tenant locks (requires schema change).
