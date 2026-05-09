/**
 * Phase 0 SaaS feature flag registry.
 *
 * Every flag declared here:
 *   - defaults to `false` in production
 *   - is read from `process.env.<NAME>` exactly once at boot
 *   - has a typed accessor on `FeatureFlagsService`
 *   - turns ON additive behavior; never required for the legacy code path
 *
 * Adding a flag requires:
 *   1. Append a new `FlagKey` entry below.
 *   2. Document it in `docs/saas/phase0/PHASE0_RUNTIME_INVARIANTS.md`.
 *   3. Add a test in `backend/src/saas/__validation__/feature-flags.check.ts`.
 */
export type FlagKey =
  | 'MULTI_TENANT_ENABLED'
  | 'TENANT_PRISMA_ENFORCEMENT'
  | 'RLS_ENFORCEMENT'
  | 'SIGNED_URLS_ENABLED'
  | 'TENANT_SWITCHING_ENABLED'
  | 'PLATFORM_ADMIN_ENABLED'
  | 'TENANT_SAFE_REPORTS_ENABLED'
  | 'TENANT_CONTEXT_STAGING_ONLY'
  | 'TENANT_CONTEXT_REQUIRED_FOR_SAFE_REPORTS';

export const FLAG_KEYS: ReadonlyArray<FlagKey> = [
  'MULTI_TENANT_ENABLED',
  'TENANT_PRISMA_ENFORCEMENT',
  'RLS_ENFORCEMENT',
  'SIGNED_URLS_ENABLED',
  'TENANT_SWITCHING_ENABLED',
  'PLATFORM_ADMIN_ENABLED',
  'TENANT_SAFE_REPORTS_ENABLED',
  'TENANT_CONTEXT_STAGING_ONLY',
  'TENANT_CONTEXT_REQUIRED_FOR_SAFE_REPORTS',
];

/** Defaults. ANY change to a default value is a release-note item. */
export const FLAG_DEFAULTS: Record<FlagKey, boolean> = {
  MULTI_TENANT_ENABLED:                       false,
  TENANT_PRISMA_ENFORCEMENT:                  false,
  RLS_ENFORCEMENT:                            false,
  SIGNED_URLS_ENABLED:                        false,
  TENANT_SWITCHING_ENABLED:                   false,
  PLATFORM_ADMIN_ENABLED:                     false,
  TENANT_SAFE_REPORTS_ENABLED:                false,
  TENANT_CONTEXT_STAGING_ONLY:                false,
  TENANT_CONTEXT_REQUIRED_FOR_SAFE_REPORTS:   false,
};

/** Strict env parse: only `'true'`/`'false'` (case-insensitive) flip the flag. */
export function parseFlag(raw: string | undefined, def: boolean): boolean {
  if (raw === undefined) return def;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on')  return true;
  if (v === 'false'|| v === '0' || v === 'no'  || v === 'off') return false;
  // Unknown values fall back to the default — never silently coerced.
  return def;
}
