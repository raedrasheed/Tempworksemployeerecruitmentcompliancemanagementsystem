# Phase 2.29 — Applicants Mutation Equivalence

Generated: 2026-05-10T12:02:15.258Z
Environment: SAFE_CLONE (localhost + fixture pattern (db=saas_phase1_fixture))
Tenant A: `11111111-1111-1111-1111-111111111111`

- Cases passed: **10** / 10
- Cases failed: 0

| # | Case | Result | Detail |
|--:|------|:------:|--------|
| 1 | create response shape preserved | PASS | legacy.id=130c4200-bd21-41d5-943f-d14ef0662756 pilot.id=db9cf339-00a4-41e1-9c24-46a7bf34223b |
| 2 | create legacy: tenantId NULL | PASS | tid=null |
| 3 | create pilot: tenantId=A | PASS | tid=11111111-1111-1111-1111-111111111111 |
| 4 | update (legacy) mutates phone | PASS | phone=+legacy |
| 5 | update (pilot) mutates phone | PASS | phone=+pilot |
| 6 | updateStatus (pilot) mutates status | PASS | status=SCREENING |
| 7 | pilot remove: deletedAt set | PASS | deletedAt=set |
| 8 | validation: NotFoundException for missing applicant id in both modes | PASS | legacy=NotFoundException pilot=NotFoundException |
| 9 | bulk filter (pilot): tenant B id silently dropped; tenant A id processed | PASS | results=1 bIncluded=false |
| 10 | requestDelete (pilot) creates request for tenant A applicant | PASS | id=179a3aa4-bb38-41fa-a12b-136fff98044d |