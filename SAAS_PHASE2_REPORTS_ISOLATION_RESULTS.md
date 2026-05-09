# Phase 2.1 — Reports Isolation Test Results

**Run command:** `npm run saas:phase2-reports-isolation`
**Run target:** SAFE_CLONE staging fixture with 4 tenants populated.

---

## Headline

```
3/3 sources isolated.
```

Plus, for every READY source:

- ✅ Cross-tenant filter rejected (caller cannot pass `tenantId` as a user filter).
- ✅ Forbidden operator rejected (`OR` not in the allow-list).
- ✅ All returned rows have `tenantId === tenantA.id`.

| Source | Status | Rows for A | Leaks from B | Cross-tenant filter rejected | Result |
|--------|--------|-----------:|-------------:|:-----------------------------:|:------:|
| `employees`  | READY    | many | 0 | yes | PASS |
| `applicants` | READY    | many | 0 | yes | PASS |
| `agencies`   | READY    | many | 0 | yes | PASS |
| (15 DISABLED) | — | — | — | — | — |

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

Phase 3 per-source enablement requires `3/3` (or N/N on the active READY set) `PASS` against a sanitized prod clone. Current results meet that bar for the 3 READY sources on the staging fixture. Real-prod-clone re-run is the next operational gate.

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
