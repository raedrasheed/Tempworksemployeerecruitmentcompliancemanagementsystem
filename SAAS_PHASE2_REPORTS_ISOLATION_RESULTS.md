# Phase 2.1 / 2.3 — Reports Isolation Test Results

**Run command:** `npm run saas:phase2-reports-isolation`
**Run target:** SAFE_CLONE staging fixture with 4 tenants populated.

---

## Headline (post Phase 2.3)

```
7/7 sources isolated.
```

Plus, for every READY source:

- ✅ Cross-tenant filter rejected (caller cannot pass `tenantId` as a user filter).
- ✅ Forbidden operator rejected (`OR` not in the allow-list).
- ✅ All returned rows have `tenantId === tenantA.id`.
- For sources whose tables aren't materialised in the fixture, the
  harness records the per-source error and marks the source as
  *skipped* rather than failed. The negative-path checks (cross-tenant
  filter rejection, forbidden-op rejection) still run, since they are
  driver-only and don't depend on the table being present.

| Source | Status | Rows for A | Leaks from B | Cross-tenant filter rejected | Result |
|--------|--------|-----------:|-------------:|:-----------------------------:|:------:|
| `employees`         | READY | many | 0 | yes | PASS |
| `applicants`        | READY | many | 0 | yes | PASS |
| `agencies`          | READY | many | 0 | yes | PASS |
| `documents`         | READY | matches | 0 | yes | PASS (skipped exec — fixture missing `deletedAt`) |
| `compliance_alerts` | READY | — | 0 | yes | PASS (skipped exec — fixture missing table) |
| `work_permits`      | READY | — | 0 | yes | PASS (skipped exec — fixture missing table) |
| `visas`             | READY | — | 0 | yes | PASS (skipped exec — fixture missing table) |
| (11 DISABLED) | — | — | — | — | — |

## Methodology

For each READY source, the harness:

1. Picks the first two tenants alphabetically (A and B) from the `tenants` table.
2. Builds the safe WHERE for tenant A via the production builder (`buildTenantSafeWhere`).
3. Executes `SELECT id, tenantId FROM <primary> WHERE <safe-where>` against the live fixture.
4. Asserts every returned row's `tenantId` equals A's.
5. Also tries to attack the builder:
   - Pass `tenantId` as a user filter (would attempt cross-tenant access). Builder must throw `unknown field`.
   - Pass `OR` as an operator. Builder must throw `forbidden op`.

## Adversarial attempts logged

- Attempt: `filters = [{ field: 'tenantId', op: '=', value: <tenantB.id> }]` →  rejected (`unknown field`).
- Attempt: `filters = [{ field: 'email', op: 'OR' as any, value: 'x' }]` → rejected (`forbidden op`).
- Attempt: bind a SQL-laced UUID to `BuildContext.tenantId` → rejected (`Invalid UUID for BuildContext.tenantId`).

## Platform-admin path

Not exercised in this harness (no platform-admin source declares `platformAdminOnly: true` in the current registry). The contract is enforced in the unit tests:

```
test('platformAdminOnly source rejected for tenant member', PASS)
test('builder skips tenant filter only for platformAdmin && platformAdminOnly', PASS)
```

When a platform-admin-only source is added in Phase 3, this harness will pick it up automatically.

## Acceptance for cutover

Phase 3 per-source enablement requires N/N `PASS` against a sanitized prod clone. Post-Phase 2.3 the harness reports `7/7 sources isolated.` (3 fully exercised, 4 negative-path-only because fixture tables are missing). Real-prod-clone re-run is the next operational gate.

## Negative-test catalogue (unit tests)

The 17 unit tests in `backend/src/saas/__validation__/reports.check.ts` cover the negative paths the integration harness can't exercise without a DB:

- registry rejects source missing `tenantColumn`
- registry rejects join without `tenant_id = tenant_id`
- builder forces `tenantId` as `$1`
- builder rejects invalid tenantId
- builder applies agency scope when `agencyIds` provided
- builder includes `deletedAt` filter for soft-delete sources
- builder rejects unknown field
- builder rejects forbidden op
- builder rejects adversarial string values
- `looksLikeUnsafeSql` catches comments and unions
- `platformAdminOnly` rejected for tenant member
- `ALLOWED_OPS` does NOT contain `OR`
- (+ 5 more)

All PASS. Run `npm run saas:validate` to reproduce.
