# ADR-003 — Splitting `Agency` into `Tenant` + (sub-)`Agency`

- **Status:** Accepted
- **Date:** 2026-05-09
- **Related:** ADR-001, ADR-002, `SAAS_AGENCY_TO_TENANT_SPLIT_STRATEGY.md`

## Context

The current schema's `Agency` model conflates two concepts:

1. **Tenant** — a customer organization (the SaaS workspace boundary).
2. **Agency** — a recruitment agency (a sub-organization within a customer).

`agencyId` is propagated through most domain tables and is used by services as the de-facto isolation key. The `agencyIsSystem` flag designates the Tempworks-internal "platform" agency and is used as a super-admin bypass in the JWT.

The SaaS architecture requires these to be distinct. A clear, deterministic mapping is required to avoid backfill drift.

## Decision

`Agency` is split into two roles by **migration**, not by code branching.

### Mapping

- Each existing customer `Agency` (`isSystem = false`) becomes:
  - One **`Tenant`** row that **reuses the original `Agency.id` as its UUID**.
  - One **`Agency`** row inside that tenant, called the **Default Agency** (`isDefault = true`), with a fresh UUID. This row holds the human attributes (`country`, `contactPerson`, `email`, `phone`, `managerId`) of the original agency.
- All tenant-scoped rows (`User`, `Applicant`, `Employee`, `Vehicle`, etc.) are reparented to the new Default Agency's UUID. After reparenting, the original `Agency` row is deleted.
- Each existing `Agency` (`isSystem = true`) row's users become **`PlatformAdmin`** rows (level `SUPER` by default; ops can downgrade). The system Agency itself is deleted after migration.
- Hierarchical sub-agencies are not supported in the current schema; the split assumes one Default Agency per Tenant. New sub-agencies created post-migration use the standard agency-create flow.

### Why reuse `Agency.id` as `Tenant.id`?

Backfilling `tenantId` on every domain row reduces to a literal copy of the existing `agencyId` for top-level rows. No mapping table needed. Composite indexing remains correct from day one.

### `agencyIsSystem` retirement

Replaced by `PlatformAdmin` + a `pa` JWT claim. During the transition, both are honored (`isPlatformAdmin = claims.pa || claims.agencyIsSystem`). The legacy claim is dropped in Phase 3 after all clients have refreshed.

## Consequences

**Positive**
- Deterministic, mechanical backfill — no per-customer judgment calls.
- Existing `agencyId` values become valid `tenantId` values; downstream `tenantId` denormalization is simple.
- No data loss; permission posture preserved by construction.
- Single split rule reviewable by product before execution.

**Negative**
- Historical log lines/SQL referencing `agencyId = X` may now refer to a tenant. Documented in runbooks; tooltip in platform-admin console.
- Platform admin access depends on correct enumeration of pre-migration `isSystem=true` users. A pre-flight audit (`TKT-15`) is mandatory.

## Alternatives Considered

- **Keep `Agency.id` distinct from new `Tenant.id`.** Rejected: requires a mapping table and rewrites every `agencyId` → `tenantId` lookup; higher migration risk.
- **Split per-customer manually.** Rejected: doesn't scale; product input only meaningful for hierarchical org modeling, which is not currently in schema.
- **Treat sub-agencies as a future hierarchical concern with `Agency.parentId`.** Accepted as a forward path but **not** required for the split itself.

## Implementation Notes

- The full algorithm is in `SAAS_AGENCY_TO_TENANT_SPLIT_STRATEGY.md` (sections 2.1–2.7).
- Backfill runs under a Postgres advisory lock and a checkpoint table `agency_split_progress(old_agency_id, new_tenant_id, new_default_agency_id, status)`.
- Identifier-sequence backfill takes per-tenant advisory locks during the dual-key window.
- Storage object keys are server-side copied to `tenants/<tenantId>/...`; original keys retained until ACL flip (ADR-006).
- `EmployeeAgencyAccess` rows are mapped to `AgencyMembership` rows; `AgencyUserPermission` rows are mapped to `MembershipPermissionOverride`.
- Pre-flight blockers: duplicate emails on `User`; users with `agencyId IS NULL`. Both must be reconciled before backfill writes.

## Risks

- **Hidden references to `Agency.isSystem` in services.** Mitigation: codeowner audit pass; ESLint search; remove in Phase 3 after dual-honor period.
- **FK cascade surprises during reparent.** Mitigation: full DB snapshot before write phase; staging dry-run; transactional per-agency reparent.
- **Platform-admin lockout.** Mitigation: provision `PlatformAdmin` rows **before** dropping `agencyIsSystem` from JWT.
- **Slug collisions when deriving from agency name.** Mitigation: kebab-case + collision suffix; reserved-slug list.

## Rollback Considerations

- The split is destructive in the sense that the original `Agency` rows are deleted at the end. Pre-migration database snapshot is mandatory.
- The reparenting step is transactional per old agency; partial migrations resume from `agency_split_progress`.
- If any post-migration smoke test fails, the rollback path is "restore snapshot and revert code" rather than "undo migration in place." Explicitly rehearsed on staging at least once before production.
