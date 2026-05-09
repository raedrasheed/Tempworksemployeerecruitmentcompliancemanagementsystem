/**
 * SQL guard helpers shared by the tenant-safe reports engine.
 *
 * These are pure functions — no DB access, no I/O — so they are cheap
 * to call inside both the boot validator and the per-query builder.
 */

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Strict identifier check. Rejects spaces, dots, quotes, semicolons. */
export function ident(name: string): string {
  if (!IDENT_RE.test(name)) throw new Error(`bad identifier: ${JSON.stringify(name)}`);
  return `"${name}"`;
}

/** Quote a column reference of the form `alias.column`, both validated. */
export function colRef(alias: string, col: string): string {
  if (!IDENT_RE.test(alias)) throw new Error(`bad alias: ${JSON.stringify(alias)}`);
  if (!IDENT_RE.test(col))   throw new Error(`bad column: ${JSON.stringify(col)}`);
  return `"${alias}"."${col}"`;
}

/**
 * Tenant-equality detector used by the boot validator on every join's
 * `on` clause. Returns true iff the clause contains
 *   `<aliasA>.tenant_id = <aliasB>.tenant_id`
 * with valid identifiers on both sides. We also accept the alternative
 * Postgres convention `tenantId` (camelCase column).
 */
export function joinHasTenantEquality(on: string): boolean {
  // Allow either snake_case or camelCase tenant column.
  const re =
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*"?(?:tenant_id|tenantId)"?\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*"?(?:tenant_id|tenantId)"?\b/;
  return re.test(on);
}

/**
 * Operator allow-list for user-supplied filters.
 * NEVER add 'OR'. Top-level OR is forbidden in the engine; the only
 * disjunction allowed is via IN on a closed list.
 */
export const ALLOWED_OPS: ReadonlySet<string> = new Set([
  '=', '!=', '<', '<=', '>', '>=',
  'ILIKE', 'IN', 'BETWEEN',
  'IS NULL', 'IS NOT NULL',
]);

/** Reject anything that hints at SQL injection in an op string. */
export function assertOp(op: string): string {
  if (!ALLOWED_OPS.has(op)) throw new Error(`forbidden op: ${JSON.stringify(op)}`);
  return op;
}

/** Hard-coded forbidden patterns used by the static scanner & runtime guard. */
export const FORBIDDEN_SQL_PATTERNS: RegExp[] = [
  /\bOR\b\s+1\s*=\s*1/i,
  /;\s*(DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER|GRANT|REVOKE)\b/i,
  /--\s*$/m,                 // trailing comment - inline obfuscation
  /\/\*.*?\*\//s,            // block comment
  /\bUNION\b\s+\bSELECT\b/i,
  /\bxp_cmdshell\b/i,        // SQL Server but cheap to detect
];

export function looksLikeUnsafeSql(s: string): boolean {
  return FORBIDDEN_SQL_PATTERNS.some((re) => re.test(s));
}

/**
 * UUID-shape validator — purpose is SQL-injection defence, not RFC 4122
 * compliance. Accepts any 8-4-4-4-12 hex string. The v4-specific check
 * in `infra/prisma/rls.ts` is intentionally stricter for the GUC path,
 * but for the reports builder the looser shape suffices because the
 * value is already a positional parameter — the regex only stops a
 * caller from binding a garbage / SQL-laced string in a context where
 * a UUID is expected.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(v: string, what = 'tenantId'): string {
  if (!UUID_RE.test(v)) throw new Error(`Invalid UUID for ${what}`);
  return v;
}
