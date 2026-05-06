# I18N Phase 3 — Backend & Runtime-Message Plan

**Scope:** Planning only. No code changes (except creating this file). No Prisma schema edits. No commits unless requested.
**Date:** 2026-05-06
**Predecessors:** Phases 2.A–2.S (frontend static-literal sweep) and the i18n Frontend Final Validation Pass.
**Branch (when implementation starts):** `claude/plan-i18n-support-UhQ74` per SDK directive.

---

## 0. Executive Summary

Phase 2 closed the static-UI literal layer: 0 actionable scanner hits, 9 namespaces × 5 non-EN locales at full key parity, ~98% RTL-safe layout. The remaining i18n debt is **runtime/dynamic content** plus a handful of cosmetic frontend leftovers:

| Area | Current state | Phase |
|------|---------------|-------|
| Frontend toast/alert/Cancel residue | 130 toasts in 37 files, 16 `Cancel` buttons, 1 `alert()` | **3.A** |
| Backend API error responses | `{ statusCode, message, path }` — **no `code` field** | **3.B** |
| DTO/class-validator messages | Default English from class-validator | **3.C** |
| Backend email templates | **Already done** (`email-i18n.ts` covers 6 locales × 10 templates) | **3.D — verify only** |
| Notifications stored in DB | `title`/`message` are pre-rendered English strings | **3.E** |
| Backend exports (Excel/PDF/CSV) | Hardcoded English column headers in 5+ services | **3.F** |
| Database-driven labels (Roles, JobTypes, …) | Single `name`/`label` column, English-only | **3.G** |
| RTL hard-coded `sticky left-0` | 2 instances in `PermissionsMatrix.tsx` | **3.A (bundled)** |

**Recommendation:** Sequence Phase 3 as 3.A → 3.B → 3.C → 3.D → 3.E → 3.F → 3.G. Phases 3.A–3.C unblock the user-visible runtime messages with no DB risk. 3.D is a verification pass. 3.E–3.G involve schema or data-shape changes and should be gated on stakeholder approval.

---

## 1. Runtime Toast Cleanup (Phase 3.A)

### 1.1 Current Gaps

- **130 raw `toast.success/error/warning/info(...)` calls** across 37 files (full inventory in `I18N_FRONTEND_FINAL_VALIDATION_REPORT.md` §3b).
- **16 `Cancel` button labels** still hardcoded — pipeline pages (`WorkflowBoardPage`, `WorkflowStageDetailsPage`), settings dialogs (`JobTypes`, `TransactionTypes`, `WorkHistoryEventTypes`), component dialogs (`AttendanceTab`, `ApplicantPdfExport`, `CandidatesList`).
- **1 native `alert()`** at `WorkflowManagement.tsx:206` (`alert('Workflow configuration saved')`).
- **4 bare `Loading...`** strings in components outside Phase 2.S scope.
- **1 bare `Search`** label in `FinanceDashboard.tsx:497`.
- **2 `sticky left-0`** RTL utilities at `PermissionsMatrix.tsx:179,200`.
- **`apiError()` helper exists** in `src/i18n/apiError.ts` — code-based lookup against `errors.json` — but most catch blocks pass `err?.message` directly into toast, bypassing it.

### 1.2 Recommended Architecture

1. **Central toast keys.** Establish two key families inside the existing `common` namespace:
   - `common.toast.<verb>` — generic verbs (`saved`, `created`, `updated`, `deleted`, `restored`, `imported`, `exported`, `uploaded`, `copied`, `linkCopied`, `failed`, `loadFailed`, `networkError`, `unsupportedFile`, `validationFailed`).
   - `common.toast.<entity>.<verb>` — only when a verb is consistently entity-scoped (e.g. `common.toast.user.created`).
   For module-specific copy, use existing `<module>.toast.*` sub-keys (already established in `users.add.*`, `users.list.*`, `vehicles.*`).
2. **Standard call shape:**
   ```ts
   try { ... toast.success(t('users.list.exportDownloaded')); }
   catch (err) { toast.error(apiError(err, t)); }
   ```
   `apiError(err, t)` is the single chokepoint that:
   - Looks up `errors.<group>.<KEY>` when `err.code` is present.
   - Falls back to `err.message` (English from server).
   - Falls back to `errors.generic.UNEXPECTED`.
3. **Cancel/Save/Loading consolidation.** All `Cancel` → `tc('actions.cancel')`, `Save Changes` → `tc('actions.saveChanges')`, `Loading...` → `tc('states.loading')`. These keys already exist in `common.json`.
4. **Replace `alert()`.** Convert the `WorkflowManagement.tsx:206` stub to `toast.success(t('workflow.management.savedStub'))` (new key) or remove the stub entirely if save is now wired.
5. **RTL fix.** `PermissionsMatrix.tsx`: `sticky left-0` → `sticky start-0` on lines 179 and 200.

### 1.3 Files Affected (Phase 3.A)

37 files with raw toasts (see Final Validation Report §3b), grouped by module:

| Module | Files |
|--------|-------|
| Applicants | `AddApplicant.tsx`, `ApplicantsList.tsx`, `CandidatesList.tsx`, `EditApplicant.tsx`, `EditCandidate.tsx` |
| Attendance | `AttendanceList.tsx`, `AttendanceSheet.tsx`, `AttendanceTab.tsx` |
| Documents | `DocumentVerification.tsx`, `DocumentsCompliance.tsx`, `EmployeeDocumentExplorer.tsx` |
| Employees | `WorkHistoryTimeline.tsx` |
| Finance | `FinanceDashboard.tsx` |
| Job Ads | `JobAdForm.tsx` |
| Notifications | `NotificationCenter.tsx`, `NotificationSettings.tsx` |
| Profile | `UserPreferences.tsx` |
| Recycle Bin | `DeletedRecords.tsx` |
| Reports | `ReportsDashboard.tsx` |
| Settings | `BrandingSettings.tsx`, `DatabaseBackup.tsx`, `DatabaseCleanup.tsx`, `DocumentTypeEdit.tsx`, `DocumentTypeNew.tsx`, `JobTypes.tsx`, `MaintenanceTypesSettings.tsx`, `SecuritySettings.tsx`, `SkillsSettings.tsx`, `TrailerTypesSettings.tsx`, `TransactionTypesSettings.tsx`, `TransportTypesSettings.tsx`, `TruckBrandsSettings.tsx`, `VehicleSettings.tsx`, `WorkHistoryEventTypesSettings.tsx` |
| Vehicles (CRUD dialogs) | `MaintenanceRecordsList.tsx`, `MaintenanceTypesList.tsx`, `WorkshopsList.tsx` |
| Workflow | `WorkflowManagement.tsx` (alert), `WorkflowBoardPage.tsx`, `WorkflowStageDetailsPage.tsx` |
| Permissions | `PermissionsMatrix.tsx` (RTL) |

Plus locale JSON files: `src/i18n/locales/{en,sk,de,ru,ar,tr}/{common,pages}.json`.

### 1.4 Risks

- **Translation overload of toast verbs.** Module-scoped keys can balloon. Mitigate by preferring `common.toast.*` whenever the verb is generic.
- **Concealing real backend errors.** `apiError()` falling back to `err.message` keeps server text visible until 3.B is in place. Acceptable transitional state.
- **Snapshot/RTL regressions** when re-keying `Cancel`/`Save`. Mitigate with a build pass and the existing `i18n:check-keys` and `i18n:check-literals` scripts.

### 1.5 Acceptance Criteria

- `npm run i18n:check-literals` ≤ existing 13 false-positive baseline (no new hits).
- `npm run i18n:check-keys` passes for all 5 non-EN locales.
- `grep -nE "toast\.(success|error|warning|info)\(['\"\`]" src/` returns **0** lines with bare string literals (only `t(...)` or `apiError(...)` arguments).
- `grep -nE ">[[:space:]]*Cancel[[:space:]]*<" src/` returns **0**.
- No `alert(` calls in `src/`.
- `PermissionsMatrix.tsx` uses `sticky start-0` (no `left-0` or `right-0`).
- `npm run build` clean (0 TS errors).
- All 6 locales render the affected toasts in language-switcher manual smoke test.

### 1.6 Exact First Implementation Prompt — Phase 3.A

> **Phase 3.A — Frontend Runtime Toast & Residual Sweep**
>
> Continue the i18n branch `claude/plan-i18n-support-UhQ74`. Do **not** touch backend, Prisma, `.env`, uploads, or the Excel/PDF generators. Do **not** open a PR.
>
> **Goal:** Eliminate all remaining user-visible English literals in transient runtime messages, dialog buttons, and the RTL stickiness leak. Ship Phase 2 frontend i18n at 100% literal coverage.
>
> **Tasks:**
> 1. **Toast sweep (130 instances / 37 files)** — for every `toast.success/error/warning/info(` call in `src/`:
>    - If it's a static success/info string → use the appropriate `common.toast.<verb>` or `<module>.<page>.toast.<verb>` key. Add the EN string to `pages.json` (or `common.json` for generic verbs) and re-run the locale sync script (`/tmp/sync_keys.mjs` style: deepMerge EN into ar/de/ru/sk/tr while preserving plural variants).
>    - If it's an error from a `catch` block → replace with `toast.error(apiError(err, t))` and import `apiError` from `@/i18n/apiError`. Do **not** invent a new helper.
>    - Use the file inventory in `I18N_FRONTEND_FINAL_VALIDATION_REPORT.md` §3b as the worklist.
> 2. **Cancel/Save/Loading residue** — replace the 16 hardcoded `Cancel`, the 4 bare `Loading...`, and the `Search` label in `FinanceDashboard.tsx:497` with `tc('actions.cancel')`, `tc('states.loading')`, `tc('actions.search')` (already exist in `common.json`).
> 3. **alert() stub** — `WorkflowManagement.tsx:206`: replace `alert('Workflow configuration saved')` with `toast.success(t('workflow.management.savedStub'))` and add the new key.
> 4. **RTL fix** — `PermissionsMatrix.tsx:179,200`: change `sticky left-0` → `sticky start-0`. Verify the column still pins correctly in LTR and pins to the right edge in RTL.
> 5. **Validation:**
>    - `npm run i18n:check-keys` clean.
>    - `npm run i18n:check-literals` ≤ 13 hits (same false-positive baseline).
>    - `npm run build` clean.
>    - `grep -RnE "toast\.(success|error|warning|info)\(['\"\`]" src/` returns 0 actionable hits.
>    - `grep -RnE ">[[:space:]]*Cancel[[:space:]]*<" src/` returns 0.
> 6. **Report:** Create `I18N_PHASE_3A_REPORT.md` with: files touched, key counts added per locale, scanner deltas, RTL note. Commit on `claude/plan-i18n-support-UhQ74` with a `feat(i18n): Phase 3.A — runtime toast & residual sweep` message. Push. **Do not open a PR.**

---

## 2. Backend API Errors (Phase 3.B)

### 2.1 Current Gaps

- `AllExceptionsFilter` in `backend/src/main.ts` returns:
  ```json
  { "statusCode": 400, "message": "...", "path": "/..." }
  ```
  No `code` field. Frontend `apiError()` already expects `{ code: 'GROUP.KEY', message, params }` and degrades gracefully when `code` is absent — but the lookup never succeeds.
- **357 typed exceptions** across the backend with raw English literal messages:
  - `NotFoundException` × 165
  - `BadRequestException` × 87
  - `ConflictException` × 35
  - `ForbiddenException` × 32
  - `UnauthorizedException` × 24
  - Other custom thrown errors × ~14
- No central error-code registry. Many similar errors use slightly different prose (`"User not found"`, `"User does not exist"`, `"Could not find user"`).

### 2.2 Recommended Architecture

**Strategy: Frontend translates, backend supplies stable codes.**

1. **Stable error code shape:**
   ```ts
   // backend/src/common/errors.ts
   export class AppError extends HttpException {
     constructor(
       public readonly code: string,        // e.g. 'USER.NOT_FOUND'
       public readonly httpStatus: number,
       public readonly defaultMessage: string,
       public readonly params?: Record<string, string | number>,
     ) {
       super({ code, message: defaultMessage, params }, httpStatus);
     }
   }
   ```
2. **Update `AllExceptionsFilter`** to:
   - Detect `AppError` instances and pass `code`/`params` through.
   - For untyped `HttpException`, emit `code: 'HTTP.<STATUS>'` (e.g. `HTTP.400`).
   - Keep `statusCode`, `message`, `path`, `timestamp` for backward compat.
   - **New shape:**
     ```json
     {
       "statusCode": 404,
       "code": "USER.NOT_FOUND",
       "message": "User not found",
       "params": { "id": "abc-123" },
       "path": "/users/abc-123",
       "timestamp": "2026-05-06T10:00:00Z"
     }
     ```
3. **Code registry.** Group by domain: `USER.*`, `AGENCY.*`, `APPLICANT.*`, `VEHICLE.*`, `MAINTENANCE.*`, `WORKFLOW.*`, `STAGE.*`, `DOCUMENT.*`, `JOB.*`, `FINANCE.*`, `NOTIFICATION.*`, `AUTH.*`, `PERMISSION.*`, `VALIDATION.*`, `FILE.*`, `HTTP.*`. Recommend ≤ 200 codes initially; reuse aggressively.
4. **Frontend mapping.** Mirror codes into `src/i18n/locales/<locale>/errors.json` under matching groups. `errors.auth` and `errors.validation` already exist — extend, don't replace.
5. **Backwards compatibility.** Keep `message` field. Old clients still work; new client prefers `code`.

### 2.3 Should the frontend translate backend codes?

**Yes, frontend translates.** Reasons:
- Server-rendered locale would require Accept-Language threading through 357 throw sites today.
- Locale switching in-app must not require a re-fetch.
- Existing `apiError.ts` is already half the implementation.
- Email/PDF (server-rendered) remain server-translated because there is no client.

### 2.4 Files Affected

- `backend/src/main.ts` — `AllExceptionsFilter`.
- New: `backend/src/common/errors/app-error.ts`, `backend/src/common/errors/codes.ts`.
- ~150 backend service/controller files where `throw new XxxException(...)` lives.
- `src/i18n/apiError.ts` — verify shape.
- `src/i18n/locales/{en,sk,de,ru,ar,tr}/errors.json` — extend.

### 2.5 Risks

- **Public API contract change.** Adding fields is non-breaking; clients tolerating unknown fields stay fine. Document in CHANGELOG.
- **Mass refactor scope.** 357 throw sites. Mitigate by introducing `AppError` alongside existing `*Exception` and migrating opportunistically per domain (start with `USER`, `AUTH`, `VALIDATION`).
- **Test churn.** Any backend test asserting exact message text needs updating. Mitigate by asserting `code` instead.

### 2.6 Acceptance Criteria

- `AllExceptionsFilter` emits `code` for every error response.
- 100% of `auth/`, `users/`, `agencies/` modules use `AppError` with codes.
- `errors.json` has matching keys for all emitted codes.
- Frontend `apiError(err, t)` returns translated string for known codes; falls back to `err.message` otherwise.
- Backend tests green.
- One end-to-end check: trigger a known 404 in Arabic locale → user sees Arabic toast.

---

## 3. Validation Messages (Phase 3.C)

### 3.1 Current Gaps

- DTOs use `class-validator` decorators **without** custom `message:` overrides, so the default English class-validator strings flow through verbatim into `BadRequestException` payloads.
- Frontend forms (`zod`/manual) have inline English strings.

### 3.2 Recommended Architecture

1. **Backend:** install `nestjs-i18n` is overkill — instead, configure a single `ValidationPipe` with `exceptionFactory` that emits:
   ```json
   {
     "code": "VALIDATION.FAILED",
     "message": "Validation failed",
     "params": {
       "fields": [
         { "field": "email", "code": "VALIDATION.EMAIL", "params": {} },
         { "field": "password", "code": "VALIDATION.MIN_LENGTH", "params": { "min": 8 } }
       ]
     }
   }
   ```
2. **Map class-validator constraint names → codes:** `isEmail` → `VALIDATION.EMAIL`, `minLength` → `VALIDATION.MIN_LENGTH`, `isNotEmpty` → `VALIDATION.REQUIRED`, etc. Single mapping table in `backend/src/common/validation/codes.ts`.
3. **Frontend:** extend `errors.validation` namespace with these codes. Add `apiError.fieldErrors(err, t)` helper that returns `Record<field, translatedMessage>` for inline form display.
4. **Client-side validation:** frontend forms continue to use `t('errors.validation.<CODE>')` directly.

### 3.3 Files Affected

- `backend/src/main.ts` (ValidationPipe global config).
- New: `backend/src/common/validation/codes.ts`, `backend/src/common/validation/exception-factory.ts`.
- Frontend forms with inline validation messages (~20 files).
- `errors.json` (all locales) — extend `validation` group.

### 3.4 Risks

- Field-level error rendering in forms may need refactor where errors are currently consumed as a single string.

### 3.5 Acceptance Criteria

- All `class-validator` failures arrive on the client as `{ code: 'VALIDATION.FAILED', params: { fields: [...] } }`.
- Inline form error rendering shows translated strings in all 6 locales.

---

## 4. Email Templates (Phase 3.D — Verification)

### 4.1 Current State (already implemented)

- `backend/src/email/email-i18n.ts` defines `EMAIL_TRANSLATIONS` for **all 6 locales** × **10 template types**: `activation`, `passwordReset`, `passwordResetAdmin`, `twoFactor`, `passwordChanged`, `passwordExpired`, `accountLocked`, `welcome`, `applicationConfirmation`, `notification`.
- `tEmail(locale, type, key, params?)` helper performs key lookup and `{{param}}` interpolation.
- `EmailService.sendXxx()` methods accept `locale?: EmailLocale` and pass it to `tEmail()`.
- `baseTemplate()` emits `<html lang="${lc}" dir="${dir}">`. Arabic gets `dir="rtl"`.

### 4.2 Recommended Locale Selection Strategy

Locale resolution priority for outbound emails:
1. Explicit `locale` argument from caller (e.g. when admin manually triggers a reset).
2. **`User.preferredLocale`** — verify the column exists in `User` model; if missing, add in a separate migration *outside this plan*.
3. Agency default (`Agency.defaultLocale`) — currently absent; optional addition.
4. System default `'en'`.

### 4.3 Recommended Fallback Behavior

`tEmail()` already returns the English value if the requested locale's key is missing. Keep this. Add a **single warning log** (`logger.warn('email_i18n_fallback', { locale, type, key })`) so missing translations surface in observability without breaking delivery.

### 4.4 Template File Structure Per Locale

Already inline in `email-i18n.ts`. No file split is required. **If** the file grows beyond ~1500 lines, split into `email-i18n/<locale>.ts` re-exported from an index. Not urgent.

### 4.5 Verification Tasks (Phase 3.D)

1. Audit every callsite of `EmailService.send*` and confirm the caller threads `user.preferredLocale` (or equivalent).
2. Add a unit test that renders each of the 10 templates in each of the 6 locales and asserts non-empty subject/body and correct `dir`.
3. Add a CLI smoke script `npm run email:preview -- --locale=ar --type=activation` for manual QA.

### 4.6 Acceptance Criteria

- 6 × 10 = 60 template renders verified.
- All `EmailService.send*` callers pass a `locale` argument.
- Fallback log line emits only when keys are genuinely missing.

---

## 5. Notifications (Phase 3.E)

### 5.1 Current Gaps

- `Notification` row stores fully-rendered English text:
  ```ts
  title: `${vehicle.registrationNumber}: ${check.label} Expiring Soon`,
  message: `${check.label} expires in ${daysUntil} days`,
  ```
- `NOTIF_EVENT_META` in `backend/src/notifications/notification-events.ts` has hardcoded English `label`/`description` per event type — these surface in `NotificationSettings.tsx`.
- Locale of the recipient at the moment of notification creation is not necessarily their locale at the moment of reading.

### 5.2 Recommended Architecture

**Store keys + params, render at read-time.**

1. **Schema additions** (Phase 3.G migration):
   ```prisma
   model Notification {
     // existing fields...
     titleKey   String?   // e.g. 'notifications.vehicleCheckExpiring.title'
     messageKey String?   // e.g. 'notifications.vehicleCheckExpiring.body'
     params     Json?     // { reg: 'AB123', label: 'MOT', days: 7 }
     // keep title/message for backward compat & search-friendliness
   }
   ```
2. **Producers** populate `titleKey`/`messageKey`/`params` and a best-effort English `title`/`message` (for backward compat and notification log greps).
3. **Reader (`NotificationsController.list`)** receives `Accept-Language`, resolves keys, and emits `{ id, title, message, ... }` already-translated. Falls back to stored `title`/`message` if keys missing.
4. **`NOTIF_EVENT_META`** — replace hardcoded `label`/`description` with key references; resolve in controller. Settings UI gets translated values.
5. **Migration of existing rows.** Existing pre-rendered notifications keep their English `title`/`message` as a frozen historical record — do not retroactively re-render. New notifications use the new path.

### 5.3 Files Affected

- `backend/src/notifications/notifications.service.ts` (~10 producer sites).
- `backend/src/notifications/notification-events.ts`.
- `backend/src/notifications/notifications.controller.ts` (read endpoint).
- New: `backend/src/i18n/server-translate.ts` (shared key→string utility for non-email flows).
- `src/app/pages/notifications/NotificationCenter.tsx`, `NotificationSettings.tsx`.
- `src/i18n/locales/<locale>/notifications.json` — new namespace.

### 5.4 Migration Strategy

- Schema change is **additive** (`titleKey`, `messageKey`, `params` all nullable). Zero data migration.
- Backfill not required.
- Rollback: drop the three columns; producers fall back to old code path automatically.

### 5.5 Risks

- Doubling write columns increases row size marginally.
- Server-side translate utility duplicates frontend i18n catalog. Mitigate by sharing a JSON fixture imported from a single source-of-truth package, or by reading the EN locale file at server boot.

### 5.6 Acceptance Criteria

- New notifications carry `titleKey`/`messageKey`/`params`.
- Reading the same notification in two locales shows two languages.
- Old (pre-migration) notifications still render (English).
- `NOTIF_EVENT_META` exposes translated `label`/`description` to settings UI.

---

## 6. Backend-Generated Exports / PDFs (Phase 3.F)

### 6.1 Current Gaps

- ExcelJS exports with hardcoded English column headers in:
  - `backend/src/employees/employees.service.ts` — 17 columns
  - `backend/src/finance/finance.service.ts`
  - `backend/src/applicants/applicants.service.ts`
  - `backend/src/attendance/attendance.service.ts`
  - `backend/src/vehicles/vehicles.service.ts`
- PDF generators (currently frontend-only via jsPDF in `ApplicantFormSteps.tsx`) — already use `dir` and `S()` helper.
- No `Accept-Language` plumbing in export controllers.

### 6.2 Recommended Strategy

1. **Accept-Language header** propagated via Nest middleware → `LocaleContext` (per-request AsyncLocalStorage) → service-level `tServer(key, params, locale)`.
2. **Localized header arrays.** Each export service exposes `getColumns(locale)` returning `[{ header: tServer('exports.employees.columns.firstName', {}, locale), key, width }]`.
3. **Filename localization.** `employees-2026-05-06.xlsx` stays language-neutral; sheet *name* localizes.
4. **PDFs.** When server-side PDF generation is added (none today besides the frontend jsPDF), use the same `tServer` path and `dir` resolution (RTL → mirror tables, set font).
5. **Locale catalog source.** Reuse the EN frontend locale JSON as the source-of-truth for `tServer` to avoid divergence. Build step copies `src/i18n/locales/*.json` into `backend/dist/i18n/`.

### 6.3 Files Affected

- New middleware: `backend/src/common/i18n/locale-context.middleware.ts`.
- New utility: `backend/src/common/i18n/t-server.ts`.
- 5 export services listed above.
- 5 controllers — accept `Accept-Language`.
- `src/i18n/locales/<locale>/exports.json` — new namespace.

### 6.4 Risks

- Excel header text width may need re-tuning per locale (German is ~30% longer; Arabic shorter).
- Sorting/filtering by header in downstream tooling may break if the consumer expects English. Document.

### 6.5 Acceptance Criteria

- Hitting `/api/employees/export` with `Accept-Language: ar` returns Arabic column headers.
- Falls back to EN if `Accept-Language` missing/unknown.
- All 5 export services covered.

---

## 7. Database-Driven Labels (Phase 3.G)

### 7.1 Models with translatable name/label fields

- `Role.name`, `Role.description`
- `Permission.name`, `Permission.description`
- `Agency.name` *(may stay literal — proper noun)*
- `StageTemplate.name`, `StageTemplate.description`
- `JobType.name`
- `FinanceTransactionType.name`
- `DocumentType.name`
- `NotificationRule.name`, `NotificationRule.description`
- `Workflow.name`, `Workflow.description`
- `WorkflowStage.name`
- `Workshop.name` *(proper noun — usually keep literal)*
- `MaintenanceType.name`
- `MaintenanceTypeSetting.label`
- `WorkHistoryEventTypeSetting.label`
- `JobAd.title`, `JobAd.description` *(user-authored marketing — single-locale per ad is acceptable)*

### 7.2 Two-axis decision

| | Option A: JSONB column | Option B: Translation table |
|---|---|---|
| Schema | `nameI18n Json` next to existing `name` | `RoleTranslation { roleId, locale, name, description }` |
| Read | One row, parse JSON | Join + filter by locale |
| Write | Update one row | Upsert per locale |
| Indexing/search | Limited (JSONB GIN) | Standard B-tree per `(entity, locale)` |
| Migration cost | Low (additive) | Higher (new tables, FKs) |
| Querying flexibility | Lower | Higher |
| Fallback to EN | Trivial (`nameI18n.en ?? name`) | Trivial (LEFT JOIN on `locale='en'`) |

**Recommendation:** **Option A (JSONB)** for taxonomy-style models (Role, Permission, JobType, DocumentType, MaintenanceType, FinanceTransactionType, StageTemplate, WorkflowStage, NotificationRule, MaintenanceTypeSetting, WorkHistoryEventTypeSetting). It's lower-risk, additive, and matches the read pattern (always full row by ID).

**Skip** for `Agency`, `Workshop`, `JobAd` — these are user-authored; translating them is an editorial workflow, not an i18n one.

### 7.3 Schema sketch (do not apply yet)

```prisma
model JobType {
  id        String  @id @default(uuid())
  name      String                     // legacy / fallback
  nameI18n  Json?                      // { en: '...', ar: '...', ... }
  // ...
}
```

### 7.4 Seed Data Strategy

- Seed file ships canonical EN values + best-effort translations for sk/de/ru/ar/tr for the small system-owned set (Roles ~10, Permissions ~50, default StageTemplates ~12, default DocumentTypes ~15, default MaintenanceTypes ~10).
- User-created rows start with `nameI18n: { en: name }` only; admins fill other locales via UI.

### 7.5 Migration Risks

- Existing reads using `findMany({ select: { name: true } })` keep working — JSONB column ignored.
- Writes via the admin UI must update both `name` (legacy) and `nameI18n.en`. Mitigate via a Prisma extension or service-layer wrapper.
- Backups/exports may need to learn the new column.

### 7.6 Rollback Plan

- Drop `nameI18n` column. App reverts to `name` automatically.
- No data loss for legacy `name` field.

### 7.7 Acceptance Criteria

- Switching the language switcher relabels the Roles dropdown, JobType filter, MaintenanceType options, etc.
- Admin edit screen exposes per-locale editors for the JSONB fields.
- `name` remains populated for back-compat.

---

## 8. RTL Remaining Risk

### 8.1 PermissionsMatrix sticky-left

- `src/app/pages/permissions/PermissionsMatrix.tsx:179` — `sticky left-0` on the first column header.
- `src/app/pages/permissions/PermissionsMatrix.tsx:200` — `sticky left-0` on each row's first cell.

### 8.2 Recommended Fix

Replace `left-0` with the Tailwind logical equivalent **`start-0`**. Verify project Tailwind config has `logicalProperties: true` (or the `tailwindcss-rtl` plugin); the rest of the codebase relies on this and shows it works (2,117 logical-property usages).

If `start-0` does not pin in LTR for any reason, fall back to:
```tsx
className={cn('sticky', dir === 'rtl' ? 'right-0' : 'left-0')}
```
where `dir = useLanguage().dir`.

### 8.3 Bundle With

Ship in **Phase 3.A** alongside the toast sweep — single small UI commit.

---

## 9. Implementation Roadmap

| Phase | Title | Scope | Schema change? | Est. effort | Depends on |
|-------|-------|-------|----------------|-------------|------------|
| **3.A** | Frontend runtime toast & residual sweep | 130 toasts, 16 Cancel, 1 alert, RTL `sticky` | No | M | — |
| **3.B** | Backend error codes (`AppError` + filter) | Filter, `AppError`, code registry, migrate `auth/`, `users/`, `agencies/` | No | L | 3.A (apiError reliance) |
| **3.C** | Validation message codes | ValidationPipe `exceptionFactory`, code map, frontend mapping | No | M | 3.B |
| **3.D** | Email templates verification | Audit callers, add tests | No | S | — (independent) |
| **3.E** | Notifications keys + params | Add 3 nullable columns; producer/reader rewrite | **Yes** (additive) | L | 3.B (codes namespace) |
| **3.F** | Backend exports/PDFs | LocaleContext middleware, `tServer`, 5 services | No | M | 3.B |
| **3.G** | DB-driven label JSONB | `nameI18n` columns on 11 taxonomy models, seed translations, admin UI editors | **Yes** (additive) | XL | 3.E (shared `tServer`) |

**Recommended sequencing:** 3.A and 3.D in parallel → 3.B → 3.C and 3.F in parallel → 3.E → 3.G.

---

## 10. Cross-Cutting Risks

- **Locale catalog drift** — Frontend `errors.json` and backend code registry must stay in sync. Add a CI script that asserts every backend code emitted (collected via reflection or a manifest file) has a matching key in `errors.json` for all locales.
- **Performance** — JSONB reads, server-side translate lookups: cache locale catalog at boot.
- **Search/UX** — Localized notification titles defeat substring search across languages. Acceptable trade-off; document.
- **Testing** — Add a lightweight Playwright job that loads the app under `?lang=ar` and asserts the page does not contain English-only fallbacks for known-translated keys.

---

## 11. Acceptance Criteria — Phase 3 Overall

- ≤ 13 false-positive scanner hits (no new actionable hits).
- 0 `toast.<verb>('literal')` calls in `src/`.
- Every backend error response carries a `code`.
- All 6 locales render dynamically populated values (notifications, exports, taxonomy labels) without English bleed-through except for explicitly user-authored content (Agency.name, JobAd.title, Workshop.name).
- Arabic RTL: 0 hardcoded `left-`/`right-` utilities in `src/`.
- 60 email template renders verified (6 locales × 10 templates).
- Build clean; backend tests green; locale parity check green.

---

## 12. Exact First Implementation Prompt — Phase 3.A

> **Phase 3.A — Frontend Runtime Toast & Residual Sweep**
>
> Branch: `claude/plan-i18n-support-UhQ74`. Do **not** touch backend, Prisma, `.env`, uploads, Excel/PDF generators, or anything outside `src/` and `src/i18n/locales/`. Do **not** open a PR.
>
> **Context:**
> - Frontend static-literal layer is complete (see `I18N_FRONTEND_FINAL_VALIDATION_REPORT.md`).
> - Remaining residue: 130 raw `toast.*` calls in 37 files, 16 hardcoded `Cancel` buttons, 4 `Loading...`, 1 `Search` label in `FinanceDashboard.tsx`, 1 `alert()` in `WorkflowManagement.tsx:206`, and 2 `sticky left-0` in `PermissionsMatrix.tsx:179,200`.
> - `src/i18n/apiError.ts` (`apiError(err, t)`) already handles backend error fallback — use it for every `catch`-fed toast.
>
> **Tasks:**
> 1. **Toast sweep.** For each file in `I18N_FRONTEND_FINAL_VALIDATION_REPORT.md` §3b worklist:
>    - Static success/info → `t('<module>.<page>.toast.<verb>')` or `tc('toast.<verb>')`.
>    - Catch-block error → `toast.error(apiError(err, t))`.
>    - Add new EN keys to the appropriate namespace JSON file (`pages.json` or `common.json`).
> 2. **Sync locales.** Re-run the deepMerge sync from EN into ar/de/ru/sk/tr, preserving plural variants (`_zero`, `_two`, `_few`, `_many`).
> 3. **Cancel/Save/Loading/Search residue.** Replace bare strings with `tc('actions.cancel')`, `tc('actions.saveChanges')`, `tc('states.loading')`, `tc('actions.search')`.
> 4. **alert() stub.** `WorkflowManagement.tsx:206`: replace with `toast.success(t('workflow.management.savedStub'))` and add the new key to all 6 locales.
> 5. **RTL fix.** `PermissionsMatrix.tsx:179,200`: `sticky left-0` → `sticky start-0`. If LTR positioning regresses, fall back to `cn('sticky', dir === 'rtl' ? 'right-0' : 'left-0')` using `useLanguage().dir`.
> 6. **Validation:**
>    - `npm run i18n:check-keys` — clean.
>    - `npm run i18n:check-literals` — ≤ 13 hits (same baseline).
>    - `npm run build` — 0 TS errors.
>    - `grep -RnE "toast\.(success|error|warning|info)\(['\"\`]" src/` — 0 actionable hits.
>    - `grep -RnE ">[[:space:]]*Cancel[[:space:]]*<" src/` — 0 hits.
>    - `grep -Rn "alert(" src/` — 0 hits.
>    - `grep -RnE "(left|right)-0" src/app/pages/permissions/` — 0 hits.
> 7. **Report.** Create `I18N_PHASE_3A_REPORT.md` summarizing: files touched, keys added per namespace and locale, scanner deltas, screenshots/notes for the RTL fix.
> 8. **Commit & push.** Single commit titled `feat(i18n): Phase 3.A — runtime toast & residual sweep` on `claude/plan-i18n-support-UhQ74`. Push with `git push -u origin claude/plan-i18n-support-UhQ74`. **Do not open a PR.**
>
> **Out of scope (defer to 3.B):** Backend error codes, `AppError`, `AllExceptionsFilter` changes, validation refactor, notification schema, exports.
