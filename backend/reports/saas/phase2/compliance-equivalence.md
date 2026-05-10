# Phase 2.8 — Compliance Equivalence

Generated: 2026-05-10T01:35:25.574Z
Environment: SAFE_CLONE (localhost + fixture pattern (db=saas_phase1_fixture))
Tenant A: `11111111-1111-1111-1111-111111111111` · employee: `f2cae0af-4df6-46ea-8689-3c0576681de2`

- Cases passed: **12** / 12
- Cases failed: 0

| # | Case | Result | Detail |
|--:|------|:------:|--------|
| 1 | allow-list: unset env ⇒ all modules allowed | PASS | isModuleAllowed returns true for both |
| 2 | allow-list: ="compliance" allows compliance, denies others | PASS | compliance=true, ewh=false |
| 3 | allow-list: comma-separated allows both modules | PASS | both true |
| 4 | allow-list: =nothing ⇒ scope inactive even with flag on | PASS | module "compliance" not in TENANT_PRISMA_PILOT_MODULES |
| 5 | getDashboard: legacy totalAlerts ≥ pilot totalAlerts (pilot filtered) | PASS | legacy=7 pilot=3 |
| 6 | getDashboard: pilot summary excludes NULL-tenant + tenant B | PASS | pilot.totalAlerts=3 (expected 3 for tenant A) |
| 7 | getAlerts: pilot total < legacy total (other tenants filtered) | PASS | legacy=7 pilot=3 |
| 8 | getAlerts(status=OPEN): both modes count only OPEN status | PASS | legacy open=6/7 pilot open=3/3 |
| 9 | getEmployeeCompliance: response shape preserved | PASS | legacy.docs=2 pilot.docs=2 |
| 10 | getEmployeeCompliance: pilot openAlerts only counts tenant A | PASS | legacy=3 pilot=2 |
| 11 | getExpiringDocuments: pilot result subset of legacy result | PASS | legacy=0 pilot=0 |
| 12 | response shape preserved (summary/docs/alertsByStatus/recentAlerts keys present) | PASS | summary keys numeric in both |