# Phase 2.16 — Finance Pilot Results

> Reads-first finance pilot results.
> Companion to `SAAS_PHASE2_FINANCE_AUDIT.md` and
> `SAAS_PHASE2_FINANCE_SCOPE_SPLIT.md`.

---

## 1. What changed

| Surface | Change |
|---------|--------|
| `src/finance/finance.service.ts` | constructor injects `PilotPrismaAccessor`; legacy `prisma` renamed `legacyPrisma`; pilot-aware `prisma` getter + `scope()` helper |
| 9 read sites | spread `scope.tenantWhere()` into where clause; annotated `phase216-pilot-scope` |
| 2 read sites | annotated `phase216-global` (catalog) / `phase216-audit-log` |
| 23 mutation / helper sites | rerouted to `legacyPrisma`; annotated `phase216-excluded-mutation` / `phase216-helper-read` / `phase216-global` / `phase216-audit-log` |
| `src/finance/finance.module.ts` | adds `FeatureFlagsModule`, `TenantPrismaService`, `PilotPrismaAccessor` |
| `scripts/scan-annotations.ts` | five new tags scoped to `src/finance/` |
| `scripts/saas/phase2/__fixture__/phase216-finance-extension.sql` | additive fixture: two tenants × two finance records each |
| `scripts/saas/phase2/finance-equivalence.ts` | new equivalence harness |
| `scripts/saas/phase2/finance-isolation.ts` | new isolation harness with source-level meta-assertion |
| `package.json` | new scripts `saas:phase2-finance-equivalence` and `saas:phase2-finance-isolation` |

## 2. What did not change

- No production behaviour change while flags are off.
- No mutation path narrowing (deferred to Phase 2.17).
- No schema change.
- No new feature flag.

## 3. Production default

| Flag | Default | This PR |
|------|---------|---------|
| `TENANT_PRISMA_PILOT_ENABLED` | `false` | unchanged |
| `TENANT_PRISMA_PILOT_MODULES` | unset | unchanged |
| `MULTI_TENANT_ENABLED` | `false` | unchanged |

With defaults, `getPilotScope(this.pilot, 'finance').tenantWhere()`
returns `{}` — every read query is byte-identical to pre-2.16.

## 4. Pilot activation

The pilot scope activates on:

```
TENANT_PRISMA_PILOT_ENABLED=true
TENANT_PRISMA_PILOT_MODULES=finance       # or empty (allow-all)
NODE_ENV=staging                          # SAFE_CLONE / SAFE_STAGING classifier
TenantContext.attach({ id: ... })         # ALS frame holds a tenant
```

When all four are true, `tenantWhere()` returns `{ tenantId }` and
the read queries narrow.

## 5. Equivalence harness

`saas:phase2-finance-equivalence` covers:

1. legacy: pilot OFF reports `pilotActive=false`
2. pilot: pilot ON + finance allow-list ⇒ `pilotActive=true`
3. `findAll`: pilot total <= legacy total (tenant filter applies)
4. `findOne`: legacy + pilot resolve the same tenant A record id
5. error path: NotFoundException for missing id in both modes
6. `getTotals`: legacy + pilot return same per-entity sum
7. `listTransactionTypes`: global catalog identical
8. `getHistory`: pilot resolves the same record id (tenant pre-check)
9. response shape preserved (PaginatedResponse<FinancialRecord>)

## 6. Isolation harness

`saas:phase2-finance-isolation` covers:

1. pilot ON, tenant A: `findAll` returns only tenant A rows
2. pilot ON, tenant A: `findOne(tenantB-id)` raises NotFoundException
3. pilot ON, tenant A: `getHistory(tenantB-id)` raises NotFoundException
4. pilot ON, tenant A: `getTotals` on tenant B's entity returns 0
5. concurrent ALS frames isolated (T_A no B-rows; T_B no A-rows)
6. pilot OFF: legacy returns the union of A+B records
7. **source-level meta-assertion**: every mutation method
   (`create`, `update`, `remove`, `updateStatus`,
   `addDeduction`, `removeDeduction`, `addAttachment`,
   `removeAttachment`) sources `legacyPrisma` and must keep doing
   so until the Phase 2.17 mutation pilot lands

## 7. Rollback runbook

```sh
# To halt the finance pilot specifically:
export TENANT_PRISMA_PILOT_MODULES=  # remove 'finance' from the list

# To halt the pilot framework entirely:
export TENANT_PRISMA_PILOT_ENABLED=false
```

No DB state introduced; rollback is configuration only. The Phase
2.16 read narrowing is a same-process spread that collapses to
`{}` when the scope is inactive.

## 8. Next steps — Phase 2.17

The mutation paths (`create`, `update`, `remove`, `updateStatus`,
`addDeduction`, `removeDeduction`, `addAttachment`,
`removeAttachment`) are the natural follow-up. Each needs:

- a tenant pre-check on the id (`findFirst` with `tenantWhere`)
- `tenantData()` spread on `create.data`
- a cross-tenant entity reassignment guard on `update`

The isolation harness's case 7 will fail the moment any mutation
method moves to `this.prisma` without the surrounding pre-check,
which is the desired guard during 2.17 development.
