# Phase 2.1 — Reports Isolation Test

Generated: 2026-05-09T15:45:14.830Z
Tenant A: `11111111-1111-1111-1111-111111111111` (Acme HR)
Tenant B: `44444444-4444-4444-4444-444444444444` (Empty Co)

- Sources passed: **3** / 3
- Sources failed: 0
- Sources skipped (disabled): 15

| Source | Status | Rows for A | Leaks from B | Cross-tenant filter rejected | Result |
|--------|--------|-----------:|-------------:|:-----------------------------:|:------:|
| `employees` | READY | 16 | 0 | yes | PASS |
| `applicants` | READY | 41 | 0 | yes | PASS |
| `agencies` | READY | 1 | 0 | yes | PASS |
| `documents` | DISABLED | — | — | — | — |
| `compliance_alerts` | DISABLED | — | — | — | — |
| `work_permits` | DISABLED | — | — | — | — |
| `visas` | DISABLED | — | — | — | — |
| `document_types` | DISABLED | — | — | — | — |
| `employees_documents` | DISABLED | — | — | — | — |
| `employees_work_permits` | DISABLED | — | — | — | — |
| `employees_compliance` | DISABLED | — | — | — | — |
| `applicants_documents` | DISABLED | — | — | — | — |
| `employees_agencies` | DISABLED | — | — | — | — |
| `applicants_compliance` | DISABLED | — | — | — | — |
| `documents_with_type` | DISABLED | — | — | — | — |
| `employees_visas` | DISABLED | — | — | — | — |
| `applicants_visas` | DISABLED | — | — | — | — |
| `employees_documents_type` | DISABLED | — | — | — | — |

## Notes
- **documents**: source disabled in safe mode
- **compliance_alerts**: source disabled in safe mode
- **work_permits**: source disabled in safe mode
- **visas**: source disabled in safe mode
- **document_types**: source disabled in safe mode
- **employees_documents**: source disabled in safe mode
- **employees_work_permits**: source disabled in safe mode
- **employees_compliance**: source disabled in safe mode
- **applicants_documents**: source disabled in safe mode
- **employees_agencies**: source disabled in safe mode
- **applicants_compliance**: source disabled in safe mode
- **documents_with_type**: source disabled in safe mode
- **employees_visas**: source disabled in safe mode
- **applicants_visas**: source disabled in safe mode
- **employees_documents_type**: source disabled in safe mode