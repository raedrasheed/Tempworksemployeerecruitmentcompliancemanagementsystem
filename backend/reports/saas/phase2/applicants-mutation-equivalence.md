# Phase 2.29 — Applicants Mutation Equivalence

Generated: 2026-05-10T11:38:37.874Z
Environment: SAFE_CLONE (localhost + fixture pattern (db=saas_phase1_fixture))
Tenant A: `11111111-1111-1111-1111-111111111111`

- Cases passed: **10** / 10
- Cases failed: 0

| # | Case | Result | Detail |
|--:|------|:------:|--------|
| 1 | create response shape preserved | PASS | legacy.id=a7d49d5e-ecdc-456a-8ebc-34ceee8b0ce6 pilot.id=0218cc3e-cc1c-4d88-a35b-e6d779b4bae7 |
| 2 | create legacy: tenantId NULL | PASS | tid=null |
| 3 | create pilot: tenantId=A | PASS | tid=11111111-1111-1111-1111-111111111111 |
| 4 | update (legacy) mutates phone | PASS | phone=+legacy |
| 5 | update (pilot) mutates phone | PASS | phone=+pilot |
| 6 | updateStatus (pilot) mutates status | PASS | status=SCREENING |
| 7 | pilot remove: deletedAt set | PASS | deletedAt=set |
| 8 | validation: NotFoundException for missing applicant id in both modes | PASS | legacy=NotFoundException pilot=NotFoundException |
| 9 | bulk filter (pilot): tenant B id silently dropped; tenant A id processed | PASS | results=1 bIncluded=false |
| 10 | requestDelete (pilot) creates request for tenant A applicant | PASS | id=bf921f50-93ba-43f4-8dd9-795fb04e9ee9 |