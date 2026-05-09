/**
 * Tenant-safe report source definition.
 *
 * Every entry in the registry MUST declare:
 *   - `tenantColumn` on the primary table — the column the engine
 *     adds to every WHERE clause as the first AND-term.
 *   - `tenantAwareJoins[].on` — every join's ON clause MUST equate
 *     `tenant_id` between the joined tables. The boot validator
 *     refuses any source whose joins do not.
 *
 * Optional:
 *   - `agencyColumn` — when non-null, adds the agency-scope filter
 *     for callers who only have AgencyMembership rows for some
 *     subset of the tenant's agencies.
 *
 * The shape mirrors the legacy `SOURCE_DEFS` in
 * `backend/src/reports/reports.service.ts` so the eventual cutover is
 * mostly mechanical (rename `joins` → `tenantAwareJoins`, add the two
 * extra fields).  Phase 2 lands this *side-by-side*; Phase 3 deletes
 * the legacy registry.
 */

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'uuid'
  | 'decimal';

export interface FieldDef {
  /** Table alias used in the generated SQL. */
  alias: string;
  /** Actual column name in the DB. Must match `^[a-zA-Z_][a-zA-Z0-9_]*$`. */
  dbCol: string;
  /** Logical type — drives operator availability and serialisation. */
  type: FieldType;
  label: string;
}

export interface JoinDef {
  joinType: 'LEFT' | 'INNER';
  /** DB table name. Must match `^[a-zA-Z_][a-zA-Z0-9_]*$`. */
  table: string;
  /** Alias used in the generated SQL. */
  alias: string;
  /**
   * Fully-written, static ON condition using aliases.
   *
   * MANDATORY safety rule (enforced by the boot validator):
   *   The clause MUST contain a tenant-equality term of the shape
   *     `<aliasA>.tenant_id = <aliasB>.tenant_id`
   *   for the joined and referenced tables. The validator refuses
   *   joins that do not equate tenant_id, because they would allow a
   *   row from another tenant to match the join.
   */
  on: string;
}

export interface SourceDef {
  /** Stable key used in URLs / report definitions. e.g. 'employees'. */
  key: string;
  label: string;
  group: 'single' | 'combined';
  /** Display-only list of participating tables. */
  tables: string[];

  /** Primary table the engine fans out from. */
  primaryTable: string;
  /** Primary table alias. */
  primaryAlias: string;
  /** True when primaryTable has a soft-delete column to filter on. */
  softDelete: boolean;

  /**
   * Tenant column on the primary table.
   *
   * MANDATORY. The engine emits, as the FIRST term of every WHERE:
   *   <primaryAlias>.<tenantColumn> = $1
   * where $1 is bound from `TenantContext.current().id`.
   *
   * If a future model derives tenancy through a parent (e.g. Document
   * via Employee) — set `tenantColumn` to the column actually present
   * on the primary table after the Phase 2 backfill writes the denorm.
   */
  tenantColumn: string;

  /**
   * Optional agency column on the primary table.
   *
   * When non-null AND the caller has `agencyIds` in scope, the engine
   * emits an additional AND-term:
   *   <primaryAlias>.<agencyColumn> IN ($2, $3, ...)
   *
   * Set to null for catalogue-style tables (AgencyPermissionOverride,
   * etc.) where agency-scope is irrelevant.
   */
  agencyColumn: string | null;

  /** Joins. Each must equate tenant_id (validator-enforced). */
  tenantAwareJoins: JoinDef[];

  /** User-visible field map. */
  fields: Record<string, FieldDef>;

  /**
   * Platform-admin-only sources MUST set this true.  When the caller
   * is a regular tenant member, the engine refuses to run them.
   */
  platformAdminOnly?: boolean;
}

/** Reasons the boot validator can reject a source. */
export type SourceValidationError = {
  source: string;
  rule:
    | 'missing-tenantColumn'
    | 'invalid-tenantColumn'
    | 'invalid-primaryTable'
    | 'invalid-primaryAlias'
    | 'invalid-field-name'
    | 'invalid-field-dbCol'
    | 'join-missing-tenant-equality'
    | 'invalid-join-table'
    | 'invalid-join-alias'
    | 'agencyColumn-without-tenantColumn';
  detail: string;
};
