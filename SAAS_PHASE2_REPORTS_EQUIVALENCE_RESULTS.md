# Phase 2.1 / 2.3 — Reports Read-Equivalence Results

**Run command:** `npm run saas:phase2-reports-equivalence`
**Run target:** SAFE_CLONE staging fixture (`saas_phase1_fixture` on 127.0.0.1).
**Tenant under test:** the first tenant alphabetically in `tenants`.

---

## Headline (post Phase 2.3)

```
3/7 sources equivalent (0 delta, 4 errors)
```

The 4 "errors" are fixture gaps, not behaviour drift:
- `documents` — fixture's `documents` table predates the production schema
  and is missing `deletedAt`. Production has the column.
- `compliance_alerts`, `work_permits`, `visas` — tables not materialised in
  the fixture. Production has them.

For sources whose tables exist in the fixture, legacy and safe paths
return identical row sets.

| Source | Status | Legacy n | Safe n | Equal | onlyLegacy | onlySafe | Notes |
|--------|--------|---------:|-------:|:-----:|-----------:|---------:|-------|
| `employees`        | READY    | matches | matches | yes | 0 | 0 | |
| `applicants`       | READY    | matches | matches | yes | 0 | 0 | |
| `agencies`         | READY    | matches | matches | yes | 0 | 0 | |
| `documents`        | READY    | — | — | — | — | — | fixture missing `deletedAt`; production OK |
| `compliance_alerts`| READY    | — | — | — | — | — | fixture missing table |
| `work_permits`     | READY    | — | — | — | — | — | fixture missing table |
| `visas`            | READY    | — | — | — | — | — | fixture missing table |
| (11 DISABLED) | — | — | — | — | — | — | engine refuses, as designed |

(For exact row counts, see the live `backend/reports/saas/phase2/reports-read-equivalence.{json,md}`. The equivalence file is regenerated each run.)

## Methodology

For each READY source:

1. **Legacy SQL** — selects all matching ids using the legacy WHERE shape (`deletedAt IS NULL`, plus an explicit `tenantId = $tenant` filter wrapped around it so the comparison is fair). Without that wrapper, the legacy query would include other tenants' rows and the diff would be enormous and uninformative.
2. **Safe SQL** — generated via the new builder: `<primaryAlias>.tenantId = $1 [AND <agencyId> IN (...)] [AND deletedAt IS NULL]`.
3. Both queries return only the `id` column.
4. Set comparison; the report records `onlyLegacy`, `onlySafe`, `setEqual`.

## Tenant under test

`11111111-1111-1111-1111-111111111111` (Acme HR — derived deterministically from the fixture).

## Notes

- The harness runs against the fixture: small data volumes; results are not load-test-grade. They confirm correctness.
- For real production data on a SAFE_CLONE replica: row counts will be orders of magnitude higher; the same `0 delta, 0 errors` outcome is the acceptance gate per source.

## How to extend

- `--source <key>` to run a single source.
- `--tenant <uuid>` to scope to a specific tenant.
- `--agency <uuid>` to add the agency-scope filter.

```sh
npm run saas:phase2-reports-equivalence -- --source employees --tenant <uuid>
```

## Acceptance for cutover

Phase 3 (per-source flag flip) requires read-equivalence to be **0 delta, 0 errors** for that source on a sanitized prod clone. Current results meet that bar for the 3 fixture-present READY sources (`employees`, `applicants`, `agencies`). The 4 newly-READY Phase 2.3 sources (`documents`, `compliance_alerts`, `work_permits`, `visas`) require a re-run on a prod-shaped clone to clear the fixture-gap errors.

Real-prod-clone re-run is the next operational gate (TKT-P2-01 in the Phase 2 implementation plan).
