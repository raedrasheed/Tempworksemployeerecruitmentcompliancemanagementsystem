# Phase 2.35 — Agencies Scope Split

> What ships in Phase 2.35 vs. what waits for Phase 2.36+.

---

## 1. Scope summary

| Area | Phase | This PR? |
|------|------|----------|
| `findAll` / `findOne` | **2.35** | YES — `tenantWhere()` spread with `OR isSystem` |
| `getUsers` / `getEmployees` / `getStats` (parent-gated reads) | **2.35** | YES |
| `listPermissionOverrides` (parent-gated read) | **2.35** | YES |
| `listPublic()` (public agency dropdown) | **2.35** (global by design) | KEEP global |
| Agency CRUD (`create`, `update`, `remove`) | 2.36+ | NO |
| `uploadLogo` (storage) | 2.36+ | NO |
| `setPermissionOverride` / `removePermissionOverride` | 2.36+ | NO |
| `setManager` | 2.36+ | NO |
| Audit-log emissions inside mutation paths | 2.36+ | NO (kept on `legacyPrisma`) |
| System-agency semantics (`isSystem` as a platform vs tenant marker) | Phase 3 | NO |
| Parent/child agency restructuring | Phase 3 | NO |
| Default-agency / per-tenant single primary | Phase 3 | NO |

## 2. Phase 2.35 — Read path refactor (this PR)

What lands:
- `AgenciesService` constructor injects `PilotPrismaAccessor`.
- `private get prisma()` returns `pilot.client()`.
- `private scope()` returns `getPilotScope(this.pilot, 'agencies')`.
- Read sites spread `tenantWhere()` (OR `isSystem: true`) into the
  `where` clause; `findOne` migrates `findUnique` → `findFirst`.
- All non-piloted call sites tagged `phase235-excluded-mutation`,
  `phase235-excluded-storage`, or `phase235-global`.
- External-actor agency-scope filter preserved exactly.

What does NOT land:
- No mutation behaviour change.
- No new feature flag.
- No schema change.
- No storage-key / signed-URL / ACL change.
- No system-agency semantics change.
- No parent/child agency restructuring.

## 3. Phase 2.36+ — Mutation refactor (FUTURE)

The mutation pilot will need:
- `findAgencyOrFail(id)` — pilot-aware tenant pre-check (mirror of
  applicants 2.29 / employees 2.34).
- `scope.tenantData()` spread on `Agency.create` (depends on ALS
  frame availability for System Admin paths).
- Pre-check switch on `update` / `remove` (currently use the
  Phase 2.35 tenant-scoped `findOne`).
- `uploadLogo` storage-guard (mirror applicants 2.31 / employees 2.34).
- Permission-override and manager-set mutations gated by
  tenant-scoped `findOne` parent.

## 4. Phase 3 — System-agency + restructuring (FUTURE)

See `SAAS_PHASE2_AGENCIES_SYSTEM_AGENCY_DECISION.md`. The Phase 2.35
read predicate **always** includes system agencies
(`OR isSystem: true`). Whether a system agency should be a
platform-only entity (with no `tenantId`) is a Phase 3 product
decision.

## 5. Guard-rails enforced by this PR

- Source-level meta-assertion in the isolation harness: every
  excluded mutation site sources `legacyPrisma`.
- All `legacyPrisma.*` mutation sites carry
  `phase235-excluded-mutation` (or `…-storage` / `…-global`).
- The fixture seeds two tenants × multiple agencies so reads can be
  exercised with cross-tenant collision shapes.
