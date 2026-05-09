/**
 * Tenant-safe SQL composer.
 *
 * Lives inside the runtime/ allow-listed directory so the raw-SQL
 * scanner does not flag the template-literal composition. All
 * identifiers come from the validated registry (`SourceDef`); all
 * values are positional parameters bound by `buildTenantSafeWhere`.
 *
 * Returns { sql, countSql, params, columns }; the integration point
 * in `backend/src/reports/reports.service.ts` runs them through a
 * single `$queryRawUnsafe` call (annotated `@tenant-reviewed`).
 */
import { SourceDef } from '../source-def.types';
import { buildTenantSafeWhere, BuildContext, UserFilter } from '../where-builder';
import { colRef } from '../sql-guards';

export interface ComposeRequest {
  def: SourceDef;
  filters?: UserFilter[];
  /** Field names from `SourceDef.fields`. Empty = all fields. */
  columns?: string[];
  /** Page is 1-indexed. */
  page?: number;
  limit?: number;
}

export interface ComposedReportSql {
  sql: string;
  countSql: string;
  params: unknown[];
  columns: { key: string; label: string; type: string }[];
  page: number;
  limit: number;
}

const MAX_LIMIT = 10_000;

export function composeReportSql(req: ComposeRequest, ctx: BuildContext): ComposedReportSql {
  const { def } = req;

  const where = buildTenantSafeWhere(def, req.filters ?? [], ctx);

  const selectCols = (req.columns?.length ? req.columns : Object.keys(def.fields));
  const selectExpr = selectCols.map((c) => {
    const f = def.fields[c];
    if (!f) throw new Error(`unknown column: ${JSON.stringify(c)}`);
    return `${colRef(f.alias, f.dbCol)} AS "${c}"`;
  }).join(', ');

  const joinClauses = (def.tenantAwareJoins ?? [])
    .map((j) => `${j.joinType} JOIN "${j.table}" "${j.alias}" ON ${j.on}`)
    .join(' ');
  const fromClause = `"${def.primaryTable}" "${def.primaryAlias}"`
    + (joinClauses ? ' ' + joinClauses : '');

  const page  = Math.max(1, req.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, req.limit ?? 100));
  const offset = (page - 1) * limit;

  const sql      = `SELECT ${selectExpr} FROM ${fromClause} WHERE ${where.sql} LIMIT ${limit} OFFSET ${offset}`;
  const countSql = `SELECT count(*)::int AS n FROM ${fromClause} WHERE ${where.sql}`;

  return {
    sql, countSql, params: where.params,
    columns: selectCols.map((c) => ({
      key: c, label: def.fields[c]?.label ?? c, type: def.fields[c]?.type ?? 'string',
    })),
    page, limit,
  };
}
