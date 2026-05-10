# Phase 2.33 — employees equivalence

**12/12 PASS**

- PASS — 1. pilot active when flag ON + module allowed — {"active":true,"reason":"pilot ON, env=SAFE_CLONE"}
- PASS — 2. legacy findAll: union across tenants — total=2
- PASS — 3. pilot findAll(A): total reduced from legacy union — legacy=2 pilotA=1
- PASS — 4. findOne resolves tenant A id under pilot A — id=eeeeeeea
- PASS — 5. findOne raises NotFound for missing id — NotFound
- PASS — 6. status filter narrowed by tenantId — count=1
- PASS — 7. search filter does not leak tenant B — count=0
- PASS — 8. agency filter respects tenantId — count=1
- PASS — 9. getDocuments returns array — count=5
- PASS — 10. getCompliance shape preserved (documents+alerts) — docs=5 alerts=0
- PASS — 11. listAgencyAccess parent-gated returns array — count=0
- PASS — 12. response shape preserved — data,meta
