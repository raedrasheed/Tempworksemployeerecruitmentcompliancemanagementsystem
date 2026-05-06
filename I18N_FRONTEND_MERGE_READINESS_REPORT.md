# Frontend i18n — Merge-Readiness Review

**Branch under review:** `claude/phase-3a-runtime-toast-i18n` (HEAD `481da68`)
**Review branch:** `claude/i18n-frontend-merge-readiness` (this branch)
**Date:** 2026-05-06
**Verdict:** **READY TO MERGE** ✓

All twelve required checks pass. No backend code, Prisma schema, environment files, uploads, or other unrelated files were touched. The branch is a clean fast-forward from `claude/i18n-frontend-final-validation` plus a single Phase 3.A commit.

---

## 1. Base Ancestry ✓

```text
$ git merge-base --is-ancestor origin/claude/i18n-frontend-final-validation origin/claude/phase-3a-runtime-toast-i18n
YES — final-validation is ancestor of phase-3a

$ git log --oneline final-validation..phase-3a
481da68 feat(i18n): Phase 3.A — runtime toast & residual sweep

$ git merge-base final-validation phase-3a
8cff26f0f04ebd2eb549e4805700ba555e8363f6   ← matches final-validation HEAD

$ git log -1 --oneline final-validation
8cff26f chore(i18n): frontend final validation pass — fix residual Phase 2.S strings
```

The branch is a **single linear commit** on top of `claude/i18n-frontend-final-validation` — no rebases, no force-pushes, no orphan commits. Merge-base equals the validation branch's HEAD, confirming a true fast-forward.

---

## 2. Full Frontend i18n Implementation ✓

The merged result includes the complete frontend stack contributed by previous phases:

| Component | Path | Verified |
|-----------|------|----------|
| i18next runtime | `src/i18n/index.ts` | ✓ |
| Locale config (6 locales, 9 namespaces) | `src/i18n/config.ts` | ✓ |
| Language context + RTL `dir` switching | `src/i18n/LanguageContext.tsx` | ✓ |
| Language switcher UI | `src/i18n/LanguageSwitcher.tsx` | ✓ |
| Backend error translator | `src/i18n/apiError.ts` | ✓ |
| Enum label helper | `src/i18n/enumLabel.ts` | ✓ |
| Number/date formatters | `src/i18n/formatters.ts` | ✓ |
| Pseudo-locale generator | `src/i18n/pseudo.ts` | ✓ |
| EN locale (9 namespaces) | `src/i18n/locales/en/{auth,common,dashboard,enums,errors,nav,pages,public,ui}.json` | ✓ |
| AR / DE / RU / SK / TR locales | matching trees | ✓ |
| Key-parity scanner | `scripts/i18n-check-keys.mjs` | ✓ |
| Literal scanner | `scripts/i18n-check-literals.mjs` | ✓ |

**Locale stats:**
- 6 locales × 9 namespaces = 54 namespace files
- EN `pages.json`: **3,838** flattened keys
- EN `common.json`: **247** flattened keys (after Phase 3.A additions)

---

## 3. Scope Audit ✓

```text
$ git diff --name-only final-validation..phase-3a | awk -F/ '{print $1}' | sort -u
I18N_PHASE_3A_RUNTIME_REPORT.md
src
```

Only **two top-level paths** touched: `src/` and the new Phase 3.A report at the repo root.

```text
$ git diff --name-only final-validation..phase-3a | grep -E "^(backend|prisma)/|\.env|uploads|\.zip$"
(none)
```

| Forbidden zone | Files touched |
|----------------|---------------|
| `backend/**` | **0** |
| `prisma/**` | **0** (no such directory in repo) |
| `.env*` | **0** |
| `uploads/**` | **0** |
| `*.zip` / binaries | **0** |

**60 files changed in total:**
- 1 new report (`I18N_PHASE_3A_RUNTIME_REPORT.md`)
- 47 source files under `src/app/`
- 12 locale JSON files under `src/i18n/locales/{en,ar,de,ru,sk,tr}/{common,pages}.json`

`+1,262 / −258` lines.

---

## 4. package.json / package-lock.json ✓

**Phase 3.A made zero changes to `package.json` or `package-lock.json`:**

```text
$ git diff --name-only final-validation..phase-3a -- package.json package-lock.json
(empty)
```

The i18n dependencies were already present in the base branch (added by Phase 1 and Phase 5 long before Phase 3.A):

| Dep | Version | Location in base |
|-----|---------|------------------|
| `i18next` | `^26.0.8` | `package.json` (final-validation HEAD) |
| `i18next-browser-languagedetector` | `^8.2.1` | `package.json` (final-validation HEAD) |
| `react-i18next` | `^17.0.6` | `package.json` (final-validation HEAD) |
| `i18n:check-keys` script | — | `package.json` |
| `i18n:check-literals` script | — | `package.json` |
| `i18n:check` script | — | `package.json` |

**Conclusion:** No package changes are introduced by this merge candidate. The lockfile and manifest are identical to the validation branch.

---

## 5. Locale Key Parity ✓

```text
$ npm run i18n:check-keys
✓ All 5 target locales × 9 namespaces match English.
```

| Locale | Namespaces | Parity |
|--------|------------|--------|
| `ar` | 9 | ✓ (extra keys are CLDR plural variants `_zero`, `_two`, `_few`) |
| `de` | 9 | ✓ exact |
| `ru` | 9 | ✓ (extra keys are CLDR plural variants `_few`, `_many`) |
| `sk` | 9 | ✓ (extra keys are CLDR plural variant `_few`) |
| `tr` | 9 | ✓ exact |

**Note on translation completeness:** Phase 3.A added new EN keys (e.g. `common.toast.savedSuccessfully`, `common.toast.idleSignedOut`, `pages.notifications.toast.*`, etc.) and propagated them to all five non-EN locales by deep-merge with the EN value as a placeholder. Locale **structure** is in parity; **translation quality** for the new keys awaits a translator pass. Sample of 15 new toast keys checked in `ar/common.json`: 15/15 present, populated with EN placeholder values (no missing keys, no broken fallbacks).

This is the same convention used by every previous phase and is what `i18n:check-keys` validates.

---

## 6. Build ✓

```text
$ npm run build
…
dist/assets/index-D4Z4djMI.js  4,733.52 kB │ gzip: 1,337.01 kB
✓ built in 18.28s
```

- 0 TypeScript errors
- 0 compilation errors
- Only the pre-existing chunk-size warning (unrelated to i18n; same warning present on `main`)

---

## 7. Literal Scanner ✓ (13 known false positives, baseline unchanged)

```text
$ npm run i18n:check-literals
Found 13 suspicious hardcoded JSX literal(s):
  src/app/components/applicants/ApplicantFormSteps.tsx:1304  →  "void; requiredDocuments?: string[]; fieldErrors?: Record"
  src/app/components/applicants/ApplicantFormSteps.tsx:1553  →  "void; requiredDocuments?: string[]; fieldErrors?: Record"
  src/app/components/applicants/ApplicantFormSteps.tsx:1728  →  "void; settings: FormSettings; fieldErrors?: Record"
  src/app/components/applicants/ApplicantFormSteps.tsx:1976  →  "void; fieldErrors?: Record"
  src/app/components/applicants/ApplicantFormSteps.tsx:2259  →  "void; fieldErrors?: Record"
  src/app/components/applicants/ApplicantFormSteps.tsx:2698  →  "0 ? section(S('skillsSection'), `"
  src/app/pages/users/UsersList.tsx:625  →  "firstName,lastName,email,roleId,agencyId"
  src/app/pages/workflow/WorkflowAnalytics.tsx:81  →  "45 days"
  src/app/pages/workflow/WorkflowAnalytics.tsx:84  →  "-8% vs last month"
  src/app/pages/workflow/WorkflowAnalytics.tsx:102  →  "+5% vs last month"
  src/app/pages/workflow/WorkflowAnalytics.tsx:120  →  "+3 vs last month"
  src/app/pages/workflow/WorkflowAnalytics.tsx:138  →  "+12 vs last month"
  src/app/services/api.ts:548  →  "[]) as Promise"
```

All 13 hits are documented false positives in `I18N_FRONTEND_FINAL_VALIDATION_REPORT.md` §2:
- 5 × TypeScript prop-type signatures inside `ApplicantFormSteps.tsx`
- 1 × template-literal boundary mis-parse in PDF generator (`section(S('skillsSection'), …)`)
- 1 × CSV column-name spec inside a `<code>` block (API field names, not display labels)
- 5 × static mock chart data in `WorkflowAnalytics.tsx` (placeholder analytics, replaced by real API data in production)
- 1 × TypeScript cast `as Promise<…>`

**0 new actionable hits** introduced by Phase 3.A.

---

## 8. Raw Toast Literals ✓ (0)

```text
$ grep -rnE "toast\.(success|error|warning|info)\(['\"\`]" src/ --include="*.tsx" --include="*.ts" | wc -l
0
```

Down from **157 across 40 files** before Phase 3.A. Every `toast.<verb>(…)` first-argument literal is now a `t(...)` / `tc(...)` / `apiError(err, ...)` call.

---

## 9. `alert()` ✓ (0)

```text
$ grep -rn "alert(" src/ --include="*.tsx" --include="*.ts" \
    | grep -vi 'alertdialog\|alertcircle\|alerttriangle\|alertoctagon' | wc -l
0
```

The single native `alert('Workflow configuration saved')` at `WorkflowManagement.tsx:206` is replaced with `toast.success(tp('workflow.management.savedStub'))`. The new `workflow.management.savedStub` key exists in all 6 locales.

---

## 10. Bare `Cancel` Button Labels ✓ (0)

```text
$ grep -rnE ">[[:space:]]*Cancel[[:space:]]*<" src/ --include="*.tsx" | wc -l
0
```

All 17 hardcoded `Cancel` button labels (across pipeline pages, settings dialogs, AlertDialog footers, attendance, applicant, document, recycle-bin, and user-import dialogs) now use `tc('actions.cancel')` from the existing `common.actions.cancel` key — already translated in all 6 locales since Phase 1.

---

## 11. PermissionsMatrix RTL Fix ✓ (safe)

**Diff:**
```diff
- <th className="text-start p-4 font-semibold sticky left-0 bg-[#F8FAFC] z-20 ...
+ <th className="text-start p-4 font-semibold sticky start-0 bg-[#F8FAFC] z-20 ...

- <td className="p-3 sticky left-0 bg-white border-t">
+ <td className="p-3 sticky start-0 bg-white border-t">

- <td className="p-2 ps-10 sticky left-0 bg-white">
+ <td className="p-2 ps-10 sticky start-0 bg-white">
```

**Three identical `left-0 → start-0` swaps**, lines 179, 200, 213. No surrounding logic changed.

**Why this is safe:**
- `start-0` is a Tailwind logical-property utility that resolves to `left: 0` in LTR and `right: 0` in RTL — exactly the desired stickiness behavior on both sides.
- Tailwind 4.1.12 (`tailwindcss` and `@tailwindcss/vite` in `package.json`) supports logical properties natively.
- The convention is **already pervasive in the codebase**: 100 existing `start-/end-N` usages and 507 existing `ms-/me-/ps-/pe-` usages prove the plugin chain handles these classes.
- **Repo-wide check:** `grep -rnE "sticky (left|right)-" src/` returns 0 — no other RTL leak of the same kind exists, so this is the only callsite that needed the fix.

**LTR regression risk:** none. `start-0` produces the same computed CSS as `left-0` in LTR contexts.

---

## 12. Reports Committed ✓

All phase reports are tracked in the branch HEAD (22 markdown files):

```text
I18N_FRONTEND_FINAL_VALIDATION_REPORT.md   (final validation pass)
I18N_PHASE_1_NOTES.md                      (foundation)
I18N_PHASE_2A_REPORT.md … I18N_PHASE_2S_REPORT.md   (19 sub-phases)
I18N_PHASE_3A_RUNTIME_REPORT.md            (this PR)
```

Plus the planning document on the parallel branch:
- `I18N_PHASE_3_BACKEND_RUNTIME_PLAN.md` lives on `claude/plan-i18n-support-UhQ74`. It is the planning artifact for the *next* phase (3.B–3.G) and is intentionally **not** included in the merge candidate, since it covers backend work that's out of scope for the frontend i18n merge.

---

## 13. Cleanliness Checks (extra)

| Check | Result |
|-------|--------|
| Merge conflict markers in `src/` | 0 |
| Files >500 KB added | 0 |
| Working tree clean on `phase-3a-runtime-toast-i18n` | ✓ |
| Locale JSONs end with newline | 12/12 ✓ |
| `TODO_REMOVE` / `XXX_DEBUG` markers in locales | 0 |

---

## 14. Known Residue (Documented, Out of Scope)

These items remain in the codebase, are documented in `I18N_PHASE_3A_RUNTIME_REPORT.md` §7, and are scheduled for **Phase 3.B**:

| Item | File | Why deferred |
|------|------|--------------|
| Backend `err.message` echoed via `apiError(err)` fallback | every catch block | Will start translating when Phase 3.B emits `{ code, params }` |
| `e?.message ?? 'Restore failed' / 'Delete failed'` patterns where the literal isn't first-arg | `DeletedRecords.tsx:204,222` | Outside Phase 3.A regex; resolved when backend emits `code` |
| Backend warning strings (`result.warnings.forEach(w => toast.warning(w))`) | `DeletedRecords.tsx:197` | Server-supplied — preserved per "preserve backend messages if already user-facing" rule |
| Button copy: `'Importing…'`, `'Import Records'`, `'Creating…'`, `'Create & Configure'` | `UsersList.tsx`, `WorkflowsPage.tsx` | Not in Phase 3.A scope (action labels inside JSX text, but not in the listed Cancel/Save/Delete/Retry/Export/Refresh/Loading/Success/Error set) |
| New non-EN locale keys carry EN-string placeholders | `ar / de / ru / sk / tr` `common.json` + `pages.json` | Translator pass is a separate workflow; key parity is structural |

None of these block the merge. The first-time UX in non-EN locales remains structurally correct (i18next never throws "missing key" — it returns the EN value silently).

---

## 15. Recommendation

**Merge `claude/phase-3a-runtime-toast-i18n` into `main` (or the next integration branch) as-is.**

- Single commit on top of an already-validated branch.
- Zero risk to backend, schema, env, or unrelated code.
- All automated checks green; literal scanner at the same baseline; build succeeds.
- RTL fix is a pure logical-property swap consistent with the rest of the codebase.
- Reports trail the work for audit.

**Recommended commit message for the merge** (if a merge commit is used):

```text
Merge branch 'claude/phase-3a-runtime-toast-i18n'

Frontend i18n complete:
- 157 raw toast literals → 0 across 40 files
- 17 hardcoded Cancel labels → 0
- 1 alert() → 0 (replaced with translated toast)
- PermissionsMatrix sticky left-0 → start-0 (RTL-safe)
- Locale parity preserved across 6 locales × 9 namespaces

Backend error-code wiring (Phase 3.B), notification key
columns (3.E), Excel export header localization (3.F), and
DB-driven label JSONB migration (3.G) tracked separately
in I18N_PHASE_3_BACKEND_RUNTIME_PLAN.md.
```

---

## 16. Quick Verification Commands (for the merger)

```bash
# Branch is a clean fast-forward
git merge-base --is-ancestor \
  origin/claude/i18n-frontend-final-validation \
  origin/claude/phase-3a-runtime-toast-i18n

# No forbidden zones touched
git diff --name-only \
  origin/claude/i18n-frontend-final-validation..origin/claude/phase-3a-runtime-toast-i18n \
  | grep -E '^(backend|prisma)/|\.env|uploads|\.zip$' || echo "clean"

# All gates
npm run i18n:check-keys              # → ✓ All 5 × 9 match English
npm run i18n:check-literals          # → 13 known false positives only
npm run build                         # → ✓ 0 TS errors

# Repo-wide invariants
grep -rnE "toast\.(success|error|warning|info)\(['\"\`]" src/ --include='*.tsx' --include='*.ts' | wc -l   # → 0
grep -rn "alert(" src/ --include='*.tsx' --include='*.ts' | grep -vi 'alertdialog\|alertcircle\|alerttriangle\|alertoctagon' | wc -l   # → 0
grep -rnE ">[[:space:]]*Cancel[[:space:]]*<" src/ --include='*.tsx' | wc -l   # → 0
grep -rnE "sticky (left|right)-" src/ --include='*.tsx' | wc -l               # → 0
```
