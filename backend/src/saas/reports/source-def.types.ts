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

/**
 * Two flavours of join supported by the engine:
 *
 *   - `tenant-equality` — the default. The ON clause MUST equate
 *     `tenant_id` between the joined alias and a previously-introduced
 *     alias (the primary alias or another tenant-equality joined alias).
 *
 *   - `catalog` — reserved for global reference tables that legitimately
 *     have NO `tenantId` column (e.g. `document_types`). The table MUST
 *     appear in `CATALOG_TABLES` (allow-list in `sql-guards.ts`). The
 *     join is treated as a lookup and is not allowed to introduce new
 *     row visibility (the catalog table never carries tenant-owned data).
 */
export type JoinKind = 'tenant-equality' | 'catalog';

/**
 * Structured ON-clause representation. Phase 2.4 prefers this over the
 * legacy `on: string` form because it lets the validator pick the
 * tenant-equality term out of the structure directly (no regex on
 * arbitrary SQL) and prevents arbitrary string concatenation.
 *
 * Composer renders this deterministically as:
 *   <fk.leftAlias>.<fk.leftCol> = <fk.rightAlias>.<fk.rightCol>
 *   [AND <tenant.leftAlias>.<tenant.leftCol>
 *        = <tenant.rightAlias>.<tenant.rightCol>]
 *   [AND <literals[i].alias>.<literals[i].col> = '<literals[i].literal>']
 *   [AND <nullChecks[i].alias>.<nullChecks[i].col> IS NULL]
 *
 * `tenant` is REQUIRED for `kind: 'tenant-equality'`. It is ignored for
 * `kind: 'catalog'`.
 *
 * `literals[i].literal` MUST match `^[A-Z][A-Z0-9_]*$` (enum-name shape)
 * — this is the validator-enforced rule, no SQL escapes possible.
 */
export interface StructuredJoinOn {
  fk: { leftAlias: string; leftCol: string; rightAlias: string; rightCol: string };
  tenant?: { leftAlias: string; leftCol: string; rightAlias: string; rightCol: string };
  literals?: { alias: string; col: string; literal: string }[];
  nullChecks?: { alias: string; col: string }[];
}

export interface JoinDef {
  joinType: 'LEFT' | 'INNER';
  /** DB table name. Must match `^[a-zA-Z_][a-zA-Z0-9_]*$`. */
  table: string;
  /** Alias used in the generated SQL. */
  alias: string;
  /** Default 'tenant-equality'. 'catalog' allowed only for allow-listed tables. */
  kind?: JoinKind;
  /**
   * Structured ON clause (preferred, Phase 2.4+). When present, the
   * composer ignores `on` and renders SQL from this structure.
   */
  structuredOn?: StructuredJoinOn;
  /**
   * Legacy free-form ON. Deprecated in Phase 2.4. Only used when
   * `structuredOn` is absent. Validator still applies the tenant-equality
   * regex to it.
   */
  on?: string;
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

  /**
   * Optional Phase 2.4 metadata. When omitted, the engine treats every
   * field as filterable / sortable / exportable. Callers that pass a
   * filter / sort / column on a field NOT in these lists (when the list
   * is present) get a hard error from the composer.
   */
  allowedFilterFields?: ReadonlyArray<string>;
  sortFields?: ReadonlyArray<string>;
  exportFields?: ReadonlyArray<string>;
  defaultSort?: { field: string; direction: 'ASC' | 'DESC' };
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
    | 'agencyColumn-without-tenantColumn'
    | 'duplicate-join-alias'
    | 'invalid-join-type'
    | 'unknown-join-alias-reference'
    | 'catalog-table-not-allowed'
    | 'invalid-literal'
    | 'tenant-equality-missing-from-structured-join'
    | 'unknown-default-sort'
    | 'unknown-allowed-filter'
    | 'unknown-sort-field'
    | 'unknown-export-field';
  detail: string;
};
