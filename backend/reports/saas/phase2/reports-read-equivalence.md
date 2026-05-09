# Phase 2.1 — Reports Read-Equivalence

Generated: 2026-05-09T16:46:38.135Z
Tenant: `11111111-1111-1111-1111-111111111111`

- Total sources: 18
- READY: 7 (DISABLED: 11)
- Equivalent (legacy ≡ safe): **3**
- With deltas: 0
- Errors: 4

| Source | Status | Legacy n | Safe n | Equal | onlyLegacy | onlySafe | Notes |
|--------|--------|---------:|-------:|:-----:|-----------:|---------:|-------|
| `employees` | READY | 16 | 16 | yes | 0 | 0 | |
| `applicants` | READY | 41 | 41 | yes | 0 | 0 | |
| `agencies` | READY | 1 | 1 | yes | 0 | 0 | |
| `documents` | READY | — | — | — | — | — | error: column doc.deletedAt does not exist |
| `compliance_alerts` | READY | — | — | — | — | — | error: relation "compliance_alerts" does not exist |
| `work_permits` | READY | — | — | — | — | — | error: relation "work_permits" does not exist |
| `visas` | READY | — | — | — | — | — | error: relation "visas" does not exist |
| `document_types` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |
| `employees_documents` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |
| `employees_work_permits` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |
| `employees_compliance` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |
| `applicants_documents` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |
| `employees_agencies` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |
| `applicants_compliance` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |
| `documents_with_type` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |
| `employees_visas` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |
| `applicants_visas` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |
| `employees_documents_type` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |