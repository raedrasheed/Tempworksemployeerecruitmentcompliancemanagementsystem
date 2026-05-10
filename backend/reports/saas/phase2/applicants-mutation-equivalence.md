# Phase 2.29 — Applicants Mutation Equivalence

Generated: 2026-05-10T11:03:32.460Z
Environment: SAFE_CLONE (localhost + fixture pattern (db=saas_phase1_fixture))
Tenant A: `11111111-1111-1111-1111-111111111111`

- Cases passed: **10** / 10
- Cases failed: 0

| # | Case | Result | Detail |
|--:|------|:------:|--------|
| 1 | create response shape preserved | PASS | legacy.id=4b0c8e72-1499-4511-bd4e-874ab1f13595 pilot.id=84c9c6c4-b129-4357-b984-5aa5157e8901 |
| 2 | create legacy: tenantId NULL | PASS | tid=null |
| 3 | create pilot: tenantId=A | PASS | tid=11111111-1111-1111-1111-111111111111 |
| 4 | update (legacy) mutates phone | PASS | phone=+legacy |
| 5 | update (pilot) mutates phone | PASS | phone=+pilot |
| 6 | updateStatus (pilot) mutates status | PASS | status=SCREENING |
| 7 | pilot remove: deletedAt set | PASS | deletedAt=set |
| 8 | validation: NotFoundException for missing applicant id in both modes | PASS | legacy=NotFoundException pilot=NotFoundException |
| 9 | bulk filter (pilot): tenant B id silently dropped; tenant A id processed | PASS | results=1 bIncluded=false |
| 10 | requestDelete (pilot) creates request for tenant A applicant | PASS | id=45ab21b1-f257-455d-bc8f-27ec57dc606d |