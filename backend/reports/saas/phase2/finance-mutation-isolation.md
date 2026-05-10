# Phase 2.17 — Finance Mutation Isolation

Generated: 2026-05-10T06:22:28.354Z
Environment: SAFE_CLONE (localhost + fixture pattern (db=saas_phase1_fixture))
Tenants: A=`11111111-1111-1111-1111-111111111111` B=`22222222-2222-2222-2222-222222222222`

- Cases passed: **10** / 10
- Cases failed: 0

| # | Case | Result | Detail |
|--:|------|:------:|--------|
| 1 | pilot ON, tenant A: create persists tenantId=A | PASS | tenantId=11111111-1111-1111-1111-111111111111 expected=11111111-1111-1111-1111-111111111111 |
| 2 | pilot ON, tenant A: update on tenant B record rejected, description unchanged | PASS | before="Training B1" after="Training B1" |
| 3 | pilot ON, tenant A: remove on tenant B record rejected, deletedAt unchanged | PASS | deletedAt=null |
| 4 | pilot ON, tenant A: updateStatus on tenant B record rejected, status unchanged | PASS | before=PENDING after=PENDING |
| 5 | pilot ON, tenant A: addAttachment on tenant B record rejected (no upload performed) | PASS | NotFoundException |
| 6 | pilot ON, tenant A: removeDeduction on tenant B deduction rejected, child row preserved | PASS | child preserved=true |
| 7 | pilot ON, tenant A: getTotals on tenant B entity returns 0 records (mutations did not pollute) | PASS | count=0 disbursed=0 |
| 8 | pilot ON, tenant A: create with tenant-B entityId raises NotFoundException; no row inserted (Phase 2.17.1 helper guard) | PASS | err=NotFoundException before=3 after=3 |
| 9 | pilot ON, tenant A: update scrubs smuggled entityType/entityId/applicantId (defensive) | PASS | before={"entityType":"EMPLOYEE","entityId":"eeeeeeea-aaaa-aaaa-aaaa-aaaaaaaaaaaa","applicantId":null} after={"entityType":"EMPLOYEE","entityId":"eeeeeeea-aaaa-aaaa-aaaa-aaaaaaaaaaaa","applicantId":null} |
| 10 | pilot OFF: legacy update on tenant B record still succeeds (tenant gate disengages) | PASS | mutated as expected |