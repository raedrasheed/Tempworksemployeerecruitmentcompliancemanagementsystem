# Phase 2.61 — Pipeline Pilot Results

> Reads-first TenantPrisma pilot for `src/pipeline`. Default-off;
> configuration-only rollback.

## Module status

| Aspect | Status |
|---|---|
| Read paths under pilot | 3 assignment-keyed (`getWorkflowCandidates`, `getWorkflowBoardView`, `getWorkflowStats`) |
| Workflow CONFIG (Workflow/Stage CRUD reads) | unchanged (global by design — no `tenantId` column) |
| Mutation parent gates | deferred (`phase261-pipeline-mutation-deferred`) |
| Stage transition flow | deferred (`phase261-pipeline-transition-deferred`) |
| Audit emission | unchanged — still `legacyPrisma.auditLog.create` (`phase261-pipeline-audit-log`) |
| Export | none today (`phase261-pipeline-export-deferred` reserved) |
| Schema migration | none |
| Production behaviour change with flags off | none |

## Harness results

```
[pipeline-equivalence] 12/12 PASS
[pipeline-isolation]   12/12 PASS
```

Cumulative regression chain:

Phase 2.61 adds 24 cases on top of Phase 2.60:
**788/788 PASS** (was 764/764 after 2.60).

## Rollback

```sh
TENANT_PRISMA_PILOT_ENABLED=false
# OR
TENANT_PRISMA_PILOT_MODULES=nothing
```

No data rollback required.

## Recommended next phase

**2.62 — Pipeline mutation + transition pilot.** Stamp `tenantId`
on `CandidateWorkflowAssignment.create` and
`EmployeeWorkflowAssignment.create`; add parent gates for
`advanceToStage`, `approveStage`, `flagStage`, `assignCandidate`,
`assignEmployee`; route the 14 `auditLog.create` sites through
`TenantAuditLogService.write`. Workflow / Stage CRUD remains
global until product approves a schema migration to add
`Workflow.tenantId`.
