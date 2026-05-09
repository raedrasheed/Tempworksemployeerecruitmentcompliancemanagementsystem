# Phase 2 — Prisma Runtime Refactor Strategy

> Goal: replace **793 direct `prisma.<model>.<op>`** call sites with `tenantPrisma.client.<model>.<op>` across 28 modules, **without changing observable behaviour** until `TENANT_PRISMA_ENFORCEMENT=true` flips per-environment.

---

## 1. Migration model

Each call site goes through one of three transitions:

```
A.  prisma.x.findMany(...)             →  tenantPrisma.client.x.findMany(...)
B.  prisma.x.findUnique({ email })    →  tenantPrisma.client.x.findFirst({ email })  // tenant injected
C.  prisma.$queryRaw`...`             →  source registry (reports) OR tenantPrisma.withTenant(tx => tx.$queryRaw`...`)
```

Type **A** is mechanical (~85% of sites). Type **B** appears wherever a previously global unique key (e.g. `Employee.email`) becomes tenant-scoped (`@@unique([tenantId, email])`). Type **C** is rare (17 sites) and routes through the reports refactor (ADR-007).

## 2. Module-by-module order

Per `SAAS_PHASE2_RUNTIME_REFACTOR_INVENTORY.md` §9:

| Wave | Modules | Effort |
|---|---|---|
| 2.0 (this PR) | scaffolding only | ½ week |
| 2.1 | `reports` (P0, raw SQL) | 2 weeks |
| 2.2 | `notifications` (P0, scheduler) | 1 week |
| 2.3 | entity-keyed: `documents`, `finance`, `compliance` | 1 week |
| 2.4 | domain: `applicants`, `employees`, `pipeline`, `vehicles`, `workflow` | 2 weeks |
| 2.5 | utility: `recycle-bin`, `users`, `roles`, `agencies`, `attendance`, etc. | 1 week |
| 2.6 | RLS audit-mode + `TENANT_PRISMA_ENFORCEMENT=true` per env | ½ week + 7-day observation |
| 2.7 | RLS `FORCE` per-table | ½ week + per-table observation |

## 3. Codemod strategy

**No automated codemod is shipped.** The replacement is module-by-module, by code-owner, with every PR touching one bounded context.

Why: an automated `prisma. → tenantPrisma.client.` rewrite would be:

- correct in 95% of cases,
- subtly wrong in the remaining 5% (interactive transactions, places that rely on `findUnique(email)`, raw SQL),
- and visually impossible to review per call site.

Instead each module PR includes:

1. The mechanical rewrite (find-and-replace within a single module folder).
2. Any required `findUnique → findFirst` adjustments where the unique constraint is becoming tenant-scoped.
3. The new `applyAgencyScope(where, 'agencyId', ctx)` helper invocation on every list/read endpoint that targets an agency-scoped model.
4. A two-tenant isolation test for that module.
5. A read-equivalence test (§5).

## 4. Scanner strictness phases

The advisory scanner (`saas:scan` + `saas:scan:raw-sql`) tightens over phases:

| Phase | `saas:scan` | `saas:scan:raw-sql` | CI gate |
|-------|-------------|---------------------|---------|
| 0 (current) | report-only | report-only | none |
| 2.0 (this PR) | report-only | report-only | none |
| 2.1 | strict for `backend/src/reports/` | strict for `backend/src/reports/` | only `reports` module fails on regression |
| 2.4 (after entity-keyed + domain modules) | strict for `documents`, `applicants`, `employees`, `pipeline`, `notifications`, `reports` | strict on the same allow-list | gates per-module |
| 2.6 | strict everywhere | strict everywhere | full repo gate |
| Phase 3 | the legacy `prisma` import is forbidden outside `infra/prisma/*` and explicitly reviewed sites | same | hard gate |

## 5. Read-equivalence testing (the safety net)

For every module migration, a "before / after" test against the SAFE_CLONE staging fixture:

```
1. Capture: list 50 representative queries (URL + params) per module.
2. Run them on the legacy code path; serialise the response (sorted JSON).
3. Apply the migration.
4. Re-run the same queries; serialise again.
5. Diff. The only acceptable deltas are:
     - row order (if the test query had no ORDER BY) — re-run with explicit ORDER BY
     - new tenant-scoped indexes ⇒ different default sort — accept after review
   Anything else is a regression and the migration PR is rejected.
```

The harness lives at `backend/src/saas/__validation__/read-equivalence/` (added per-module in Phase 2.1+).

## 6. `// @tenant-reviewed` policy

A single comment suppresses scanner findings on a line:

```ts
// @tenant-reviewed: <reason>
const u = await this.prisma.user.findUnique({ where: { email } });
```

Mandatory rules:

- The reason must reference one of: `R-1..R-12` (in `docs/saas/phase0/TENANT_ISOLATION_RULES.md`), an ADR (`ADR-NNN`), or an explicit Phase 2 ticket id.
- "TODO" is **never** a reason. Use a tracked ticket instead.
- Code-owner approval is required on the PR; the scanner reports comments without a `<reason>` separately.
- The list of reviewed lines is enumerated at boot (Phase 2.5) and a metric is exported (`saas.reviewed_prisma_sites`).

Categories where `@tenant-reviewed` is the **right answer**:

- `auth/`, `users/`, `identity/` — login is global. `findUnique({ email })` on `User` is the legitimate global identity lookup.
- `platform-admin/` — by design.
- migration scripts under `prisma/run-*.ts` — they execute against the live DB outside the wrapped client.

Anywhere else, `@tenant-reviewed` is a smell — prefer the wrapper.

## 7. Avoiding accidental behaviour changes

### 7.1 Pass-through default

`TenantPrismaService.client` is a **pass-through** to the underlying Prisma client when `TENANT_PRISMA_ENFORCEMENT=false`. Phase 2.0–2.5 ship with the flag OFF. The mechanical rewrite is therefore behaviourally identical to the legacy code; only the import path changes.

### 7.2 `findUnique` → `findFirst` rule

Wherever the unique key includes `tenantId` after Phase 2 backfill, every `findUnique({ where: { email } })` becomes `findFirst({ where: { email } })` (the wrapper auto-injects `tenantId`). The migration PR includes a one-line ESLint rule that flags `findUnique({ email | code | slug })` for tenant-scoped models and refers to this guidance.

### 7.3 Test gate

A migration PR cannot merge until:

- `npm run saas:validate` passes (28 → growing).
- `npm run saas:schema-lint` passes.
- The module's read-equivalence test passes (above).
- The module's two-tenant isolation test passes.
- The module's raw-SQL count drops to 0 OR every site has `@tenant-reviewed`.

## 8. Rollback strategy

Every migration PR is a single squash-merge commit. To roll back:

1. Revert the commit.
2. Run `npm run saas:validate` to confirm the SaaS suites still pass.
3. The flag remains OFF, so the legacy code path is what runs in production.

Because the migration is mechanically equivalent (under flag OFF), the cost of revert is the cost of one deploy, not a data migration.

## 9. Tracking & telemetry

Per-module migration PR description includes:

- Pre-migration count from `saas:phase2-runtime-inventory` for that module.
- Post-migration count (target: 0 unreviewed direct prisma sites).
- Read-equivalence test result (rows compared, deltas explained).
- Two-tenant isolation test passing screenshot/log.

Rolling progress dashboard published to `backend/reports/saas/phase2/migration-progress.json` (regenerated on each merge).

## 10. Hard rules

## 11. Phase 2.6 pilot landed

The first pilot module (`src/roles`, GLOBAL) shipped in the Phase 2.6 PR.
Key artefacts:

- `src/saas/prisma/pilot-prisma.accessor.ts` — per-call routing helper.
- `TENANT_PRISMA_PILOT_ENABLED` flag (default false).
- `RolesService` rewired to use the accessor (legacy semantics preserved).
- `saas:phase2-tenantprisma-pilot-equivalence` (13/13 PASS).
- `saas:phase2-tenantprisma-pilot-isolation` (9/9 PASS).
- `SAAS_PHASE2_TENANTPRISMA_PILOT_SELECTION.md`,
  `SAAS_PHASE2_TENANTPRISMA_REFACTOR_PATTERN.md`,
  `SAAS_PHASE2_TENANTPRISMA_PILOT_RESULTS.md`.

## 11.1 Phase 2.7 pilot landed

The first TENANT-SCOPED pilot module (`src/employee-work-history`)
shipped in the Phase 2.7 PR. Key artefacts:

- `src/saas/prisma/tenant-pilot-scope.ts` — `getPilotScope()` helper
  exposing spreadable `tenantWhere()` / `tenantData()`.
- `EmployeeWorkHistoryService` rewired with `private get prisma() { return pilot.client(); }`
  and `scope.tenantWhere() / .tenantData()` spreads at every call site.
- `phase27-ewh-extension.sql` fixture: seeds two-tenant collisions plus
  one NULL-tenant legacy row.
- `saas:phase2-ewh-equivalence` (12/12 PASS) — legacy vs pilot for
  list / event-types / create / update / remove.
- `saas:phase2-ewh-isolation` (8/8 PASS) — cross-tenant 404, write-
  refusal, concurrent ALS frame separation, pilot-OFF legacy path.
- `SAAS_PHASE2_EMPLOYEE_WORK_HISTORY_AUDIT.md`,
  `SAAS_PHASE2_EMPLOYEE_WORK_HISTORY_PILOT_RESULTS.md`.

The next recommended pilot is `src/compliance` (read-only views of
`compliance_alerts`).

## 11.2 Phase 2.8 pilot landed

The second TENANT-SCOPED pilot module (`src/compliance`) shipped in
the Phase 2.8 PR. Key artefacts:

- `getPilotScope(pilot, moduleName)` extended with module allow-list
  via `TENANT_PRISMA_PILOT_MODULES`.
- `ComplianceService` rewired with the same `private get prisma()` +
  `private scope()` pattern as EWH; 23 retained call sites annotated.
- `phase28-compliance-extension.sql` fixture: adds Postgres enums
  (AlertStatus, AlertSeverity, EntityType, DocumentStatus,
  WorkPermitStatus, VisaStatus) + missing columns on
  compliance_alerts/documents/document_types/work_permits/visas/employees,
  then seeds two-tenant compliance alerts plus one NULL-tenant legacy.
- `saas:phase2-compliance-equivalence` (12/12 PASS).
- `saas:phase2-compliance-isolation` (7/7 PASS).
- Phase 2.7 EWH harness still 12/12 + 8/8 PASS (no regression).
- `SAAS_PHASE2_COMPLIANCE_AUDIT.md`,
  `SAAS_PHASE2_COMPLIANCE_PILOT_RESULTS.md`.

The next recommended pilot is `src/job-ads` — single-table CRUD,
low mutation rate, no file/storage interactions.

## 11.3 Phase 2.9 pilot landed

The third TENANT-SCOPED pilot module (`src/job-ads`) shipped in the
Phase 2.9 PR. First pilot to ship a schema migration alongside the
service refactor. Key artefacts:

- `prisma/migrations/saas_phase29_jobads_tenantid/migration.sql` —
  additive nullable `tenantId` + two indexes; reverse migration
  provided.
- `JobAdsService` rewired (10 call sites) with the same pattern as
  Phase 2.7/2.8.
- `phase29-jobads-extension.sql` fixture: materialises the columns
  the staging fixture lacks + seeds two-tenant + one NULL-tenant
  ads.
- `saas:phase2-job-ads-equivalence` (13/13 PASS) including public
  listing equivalence.
- `saas:phase2-job-ads-isolation` (9/9 PASS) including same-slug-in-
  two-tenants behaviour and public-listing cross-tenant visibility.
- `SAAS_PHASE2_JOB_ADS_AUDIT.md`,
  `SAAS_PHASE2_JOB_ADS_SLUG_SAFETY.md`,
  `SAAS_PHASE2_JOB_ADS_PILOT_RESULTS.md`.

Phase 2.6/2.7/2.8 harnesses still green (regression-clean).

The next recommended pilot is `src/notifications` (read-mostly views
of notification rules and recent notifications).

## 11.4 Phase 2.10 pilot landed (partial scope)

The fourth TENANT-SCOPED pilot module (`src/notifications`, read paths
only) shipped in the Phase 2.10 PR. First pilot to deliberately split
a service into "in scope" and "explicitly excluded" — proving the
pattern handles partial refactors. Key artefacts:

- `NotificationsService` rewired (7 read sites under pilot scope; 19
  background sites annotated `phase210-excluded-background` and
  routed via `legacyPrisma`; 2 preferences sites `phase210-global`).
- `phase210-notifications-extension.sql` fixture extension.
- `saas:phase2-notifications-equivalence` (11/11 PASS).
- `saas:phase2-notifications-isolation` (8/8 PASS) including a
  source-level meta-assertion that the scheduler `check*` methods
  remain on `legacyPrisma`.
- `SAAS_PHASE2_NOTIFICATIONS_AUDIT.md`,
  `SAAS_PHASE2_NOTIFICATIONS_SCOPE_SPLIT.md`,
  `SAAS_PHASE2_NOTIFICATIONS_PILOT_RESULTS.md`.

Phase 2.6/2.7/2.8/2.9 harnesses still green (regression-clean).

The Phase 2.11+ scheduler/job-context refactor is documented in
`SAAS_PHASE2_NOTIFICATIONS_SCOPE_SPLIT.md`. The next pilot module is
`src/recycle-bin` (small, read-mostly, no scheduler).

## 11.5 Phase 2.11 pilot landed (multi-service, multi-entity)

The fifth TENANT-SCOPED pilot module (`src/recycle-bin`) shipped in the
Phase 2.11 PR. First pilot to span four services and 16 entity types
in a single module — proves the pattern scales beyond single-table
services. Key artefacts:

- `tenant-scope-map.ts` — module-local registry of tenant-scoped vs.
  global entity types (10 vs. 6).
- `RecycleBinService` rewired (107 sites) with `tenantWhereFor()` per
  entity-type spread.
- `RestoreService` (45 sites) + `HardDeleteService` (37 sites) gated
  by a single `assertTenantOwnership(entityType, id)` pre-check.
- `DatabaseCleanupService` (52 sites) annotated
  `phase211-excluded-platform` — System Admin global wipe stays
  platform-wide.
- `saas:phase2-recycle-bin-equivalence` (11/11 PASS).
- `saas:phase2-recycle-bin-isolation` (7/7 PASS).
- `SAAS_PHASE2_RECYCLE_BIN_AUDIT.md`,
  `SAAS_PHASE2_RECYCLE_BIN_SCOPE_MAP.md`,
  `SAAS_PHASE2_RECYCLE_BIN_PILOT_RESULTS.md`.

Phase 2.6/2.7/2.8/2.9/2.10 harnesses still green. The next phase will
either tackle the Phase 2.10-flagged scheduler/job-context work or
split `src/finance` reads-first.

## 11.6 Phase 2.12 consolidation landed

Six pilots prompted enough copy-paste that Phase 2.12 consolidates the
shared scaffolding before larger modules begin:

- **Harness library** — `backend/scripts/saas/phase2/lib/harness.ts`
  exports `getDatabaseUrl`, `abortUnlessStaging`, `withFlags`,
  `discoverPilotTenants`, `discoverUserForTenant`,
  `discoverEmployeeForTenant`, `writeReport`. Two existing harnesses
  (`tenantprisma-pilot-isolation`, `recycle-bin-equivalence`) were
  refactored to use the helpers as proof.
- **Annotation policy** — `SAAS_PHASE2_SCANNER_ANNOTATION_POLICY.md`
  enumerates every `@tenant-reviewed:` reason tag with allowed paths
  and expiry conditions. Adding a new tag requires updating both the
  policy doc and `KNOWN_REASONS` in the scanner.
- **Annotation scanner** — `npm run saas:scan:annotations` validates
  each annotation against the policy. Reports `UNKNOWN_REASON` /
  `WRONG_PATH` findings; WARN-only by default; `--strict-annotations`
  fails the build.
- **Pilot regression** — `npm run saas:phase2-pilot-regression` runs
  all 12 existing pilot harnesses sequentially. Today: 12/12 PASS.
- **Pattern audit + next-module template** —
  `SAAS_PHASE2_TENANTPRISMA_PATTERN_AUDIT.md` and
  `SAAS_PHASE2_NEXT_MODULE_TEMPLATE.md` codify the standard so the
  next pilot lands in a single PR with a predictable shape.

No business logic changed. No flags flipped. No new module under
pilot. Validation suite still green:

- saas:scan unchanged at 576.
- saas:scan:annotations: 0 findings.
- saas:phase2-pilot-regression: 12/12 PASS.

The next phase will pick up the Phase 2.10-flagged scheduler/
job-context work, or — if a no-scheduler pilot is preferred —
`src/finance` reads-first.

## 11.7 Phase 2.13 — job-context framework landed

The cron / scheduler blocker called out in Phase 2.10 + 2.12 is now
addressed at the infrastructure layer:

- New module `backend/src/saas/jobs/`:
  - `tenant-job.payload.ts` — `TenantJobPayload<T>` envelope,
    `assertTenantJobPayload`, `buildTenantJobPayload`,
    `buildRetryPayload`, `makeIdempotencyKey`.
  - `tenant-job-context.ts` — `runForTenant`, `runForTenantBatch`,
    `currentJobTenantId`, gated by `TENANT_AWARE_JOBS_ENABLED` +
    env classifier.
  - `tenant-job-fanout-planner.ts` — `TenantJobFanoutPlanner.plan(...)`
    returns an `ExecutionPlan` with `dryRun`, `maxTenants`, system /
    inactive / duplicate filters.
- Two new flags: `TENANT_AWARE_JOBS_ENABLED`,
  `TENANT_JOB_FANOUT_ENABLED` — both default `false`.
- New harness `saas:phase2-job-context-harness` (11/11 PASS):
  ALS attachment, concurrent-frame isolation, fanout limits, env
  refusal, retry preservation, idempotency-key stability.
- New docs:
  - `SAAS_PHASE2_JOB_CONTEXT_ARCHITECTURE.md`
  - `SAAS_PHASE2_NOTIFICATIONS_SCHEDULER_ADAPTER_PLAN.md` (Phase 2.14)
  - `SAAS_PHASE2_JOB_CONTEXT_OBSERVABILITY.md`

NO existing scheduler is wired to this yet. Notifications
scheduler / `notify*` writers / cron orchestrators continue to use
their pre-pilot legacy code paths.

The next phase is **Phase 2.14**: notifications scheduler adapter
following `SAAS_PHASE2_NOTIFICATIONS_SCHEDULER_ADAPTER_PLAN.md`.
Alternative path: `src/finance` reads-first split (no scheduler).

## 12. Hard rules

- **Never enable `TENANT_PRISMA_ENFORCEMENT=true` in production until every P0/P1/P2 module has migrated.** Enabling it with a half-migrated codebase makes the un-migrated services start filtering by tenant when their callers don't expect it.
- **Never ship a `Prisma.raw` outside the registry** during Phase 2.1+. The scanner blocks new ones; existing ones are migrated, not copied.
- **Always preserve the legacy code path** behind the flag. Removing the legacy code is Phase 3.
