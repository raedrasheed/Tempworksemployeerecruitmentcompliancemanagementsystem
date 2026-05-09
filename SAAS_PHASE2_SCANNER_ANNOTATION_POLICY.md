# Phase 2.12 — Scanner Annotation Policy

> Sharpen the tools before cutting the bigger beams.
>
> Defines the allowed `// @tenant-reviewed:` annotation tags, where
> they may appear, how they expire, and how the scanner validates them.

---

## 1. The contract

Every direct `prisma.<model>.<op>` call site in application code must
fall into one of two categories:

1. **Allow-listed** — the file lives in `src/prisma/`,
   `src/saas/prisma/`, or `src/saas/__validation__/`. No annotation
   needed; the scanner skips these directories.
2. **Reviewed** — the line carries a `// @tenant-reviewed: <reason>`
   comment whose `<reason>` is in the policy below.

Any other `prisma.X.<op>` line is reported as `USAGE` by `saas:scan`
and counted against the strict-mode threshold.

## 2. Allowed reasons (alphabetical)

| Reason tag | Meaning | Allowed paths | Phase |
|---|---|---|---|
| `phase26-pilot-accessor` | Site routes through `PilotPrismaAccessor.client()`; model is GLOBAL — pilot is a pass-through. | `src/roles/**` | 2.6 |
| `phase27-pilot-scope` | Site spreads `getPilotScope(this.pilot, 'employee-work-history').tenantWhere()` (or `.tenantData()`). | `src/employee-work-history/**` | 2.7 |
| `phase27-audit-log` | `legacyPrisma.auditLog.create` — global side-effect kept legacy. | `src/employee-work-history/**` | 2.7 |
| `phase28-pilot-scope` | Same as 2.7 for compliance module. | `src/compliance/**` | 2.8 |
| `phase28-audit-log` | Audit log on legacyPrisma. | `src/compliance/**` | 2.8 |
| `phase29-pilot-scope` | Same as 2.7 for job-ads module. Notes: `uniqueSlug` lookup intentionally tenant-agnostic. | `src/job-ads/**` | 2.9 |
| `phase210-pilot-scope` | Same for notifications read paths. | `src/notifications/**` | 2.10 |
| `phase210-excluded-background` | Notifications scheduler / fanout — out of scope until job-context framework lands. | `src/notifications/**` | 2.10 |
| `phase210-global` | Per-user global model (`NotificationPreference`); no tenantId by design. | `src/notifications/**` | 2.10 |
| `phase211-pilot-scope` | Recycle-bin tenant-scoped entity sites. | `src/recycle-bin/**` | 2.11 |
| `phase211-pilot-scope (or global; spread is tenantWhereFor)` | Same as above with the per-entity dispatch helper. | `src/recycle-bin/**` | 2.11 |
| `phase211-pilot-scope (ownership pre-checked)` | Restore / hard-delete branches running on `legacyPrisma` after `assertTenantOwnership` already authorized. | `src/recycle-bin/**` | 2.11 |
| `phase211-pilot-scope (parent FR was tenant-checked)` | `FinancialRecordAttachment` reads scoped via the parent's tenant filter. | `src/recycle-bin/**` | 2.11 |
| `phase211-global` | Recycle-bin global / catalog entity sites (USER, ROLE, DOCUMENT_TYPE, MAINTENANCE_TYPE, WORKSHOP, REPORT). | `src/recycle-bin/**` | 2.11 |
| `phase211-excluded-platform` | DatabaseCleanupService — System Admin global wipe; intentionally cross-tenant. | `src/recycle-bin/**` | 2.11 |
| `tenant-safe-report-runtime` | Reports engine uses `$queryRawUnsafe` with positional parameters and a registry-validated SQL string. | `src/reports/reports.service.ts` | 2.1 |

## 3. When annotations are allowed

An annotation is **only** valid when:

1. The reason tag is in the table above.
2. The site lives in a path the policy permits for that tag (the
   "Allowed paths" column).
3. The behaviour the tag claims is actually implemented at that site
   (e.g. `phase211-pilot-scope` requires the `where` to spread
   `tenantWhereFor(...)` — the scanner does not check this directly,
   but the per-pilot isolation harness will reveal regressions).

## 4. When annotations expire

Annotations are scoped to the phase that introduced them. They
**expire** when one of the following lands:

- **`phase2X-excluded-background`** expires when the corresponding
  scheduler/job-context refactor lands. After that, those sites move
  to `phase2X-pilot-scope` (or are deleted entirely).
- **`phase2X-excluded-platform`** expires only if a Phase 3 product
  decision splits the platform op into per-tenant operations.
- **`phase2X-pilot-scope`** ALL of these expire together when
  `TENANT_PRISMA_ENFORCEMENT` flips on globally and the wrapper-level
  tenant filter replaces the service-level spread. At that point the
  service spreads can be removed; the annotations follow.

The scanner will get a `--check-expired` mode in Phase 3 that flags
annotations whose expiry phase has passed.

## 5. What must happen before strict mode

`saas:scan` is REPORT-ONLY today. Strict mode (`saas:scan --strict`)
will fail the build on any unannotated `prisma.X.<op>` site.
Prerequisites for flipping to strict:

1. Every `USAGE` line in `saas:scan` output is either annotated or
   moved into `src/saas/prisma/` / `src/prisma/`.
2. Every annotated reason matches the policy above.
3. The `saas:scan:annotations` subcommand reports zero `UNKNOWN_REASON`
   and zero `WRONG_PATH` findings.
4. CI runs `saas:scan --strict` on every PR.

Phase 2.12 adds (1) the policy validation (`saas:scan:annotations`)
in WARN-only mode, (2) the `--strict-annotations` flag that returns
non-zero on policy violations, but does NOT yet flip the global
`saas:scan` to strict.

## 6. Reviewing exceptions

If a new direct prisma call needs an annotation that isn't in the
policy above:

1. The PR MUST add the new tag to this document with:
   - tag name
   - meaning (one sentence)
   - allowed paths
   - phase number
   - expiry condition
2. Reviewer must confirm the new tag is genuinely a new category and
   not a re-shaping of an existing one (e.g. don't add
   `phase212-pilot-scope-ish`).
3. The new tag is added to `KNOWN_REASONS` in
   `backend/scripts/scan-tenant-safe.ts` in the same PR.

## 7. How to avoid annotation laundering

"Annotation laundering" = adding `@tenant-reviewed: <bogus reason>`
to suppress the scanner without doing the actual review. Mitigations:

- The scanner's annotation validator (this PR) cross-checks the tag
  against `KNOWN_REASONS` and the path allow-list. A bogus reason or
  wrong path fails the check.
- `saas:phase2-pilot-regression` runs every pilot's isolation
  harness; if a tag claims tenant-safety but the site is in fact
  unsafe, the harness fails.
- Per-phase docs (`SAAS_PHASE2_<MODULE>_AUDIT.md`) record the
  expected annotation count. A diff in the count without an audit
  update is a code-review smell.
- Code review: any PR that adds a `@tenant-reviewed` line to a file
  not previously in the pilot allow-list triggers a manual review.

## 8. Operator-facing summary

```sh
# Today (REPORT-ONLY):
npm run saas:scan
# → "Total: <N>. Allowlist: …. Phase 0: scanner is in REPORT-ONLY mode."

# Phase 2.12 addition (WARN-ONLY):
npm run saas:scan:annotations
# → reports any annotation with a reason not in the policy or in a
#   path that doesn't match. Returns 0 unless --strict is passed.

# Phase 3 plan (STRICT, post-cutover):
npm run saas:scan -- --strict
# → fails the build on any unannotated USAGE.
```
