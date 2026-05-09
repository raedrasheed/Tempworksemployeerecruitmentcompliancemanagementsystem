/**
 * Phase 2.1 — Tenant-Safe Report Source Registry.
 *
 * Maps every legacy `SOURCE_DEFS` entry to a tenant-safe definition.
 * Each entry must declare a `tenantColumn`. Multi-table sources must
 * declare joins whose `on` clause equates `tenant_id`.
 *
 * Sources that cannot be mapped (e.g. an entity-keyed model whose
 * `tenantId` denorm hasn't been backfilled yet) are marked DISABLED
 * with a reason. The boot validator skips DISABLED sources.
 *
 * The legacy registry in `backend/src/reports/reports.service.ts`
 * remains the LIVE source until `TENANT_SAFE_REPORTS_ENABLED=true`.
 */
import { SourceDef } from '../source-def.types';

/** Convenience: the same field map used by both engines. */
const employeeFields: SourceDef['fields'] = {
  id:              { alias: 'e', dbCol: 'id',              type: 'uuid',   label: 'ID' },
  firstName:       { alias: 'e', dbCol: 'firstName',       type: 'string', label: 'First Name' },
  lastName:        { alias: 'e', dbCol: 'lastName',        type: 'string', label: 'Last Name' },
  email:           { alias: 'e', dbCol: 'email',           type: 'string', label: 'Email' },
  phone:           { alias: 'e', dbCol: 'phone',           type: 'string', label: 'Phone' },
  nationality:     { alias: 'e', dbCol: 'nationality',     type: 'string', label: 'Nationality' },
  status:          { alias: 'e', dbCol: 'status',          type: 'enum',   label: 'Status' },
  dateOfBirth:     { alias: 'e', dbCol: 'dateOfBirth',     type: 'date',   label: 'Date of Birth' },
  licenseNumber:   { alias: 'e', dbCol: 'licenseNumber',   type: 'string', label: 'License No.' },
  licenseCategory: { alias: 'e', dbCol: 'licenseCategory', type: 'string', label: 'License Category' },
  yearsExperience: { alias: 'e', dbCol: 'yearsExperience', type: 'number', label: 'Years Exp.' },
  city:            { alias: 'e', dbCol: 'city',            type: 'string', label: 'City' },
  country:         { alias: 'e', dbCol: 'country',         type: 'string', label: 'Country' },
  createdAt:       { alias: 'e', dbCol: 'createdAt',       type: 'date',   label: 'Created At' },
};

const applicantFields: SourceDef['fields'] = {
  id:                   { alias: 'ap', dbCol: 'id',                   type: 'uuid',    label: 'ID' },
  firstName:            { alias: 'ap', dbCol: 'firstName',            type: 'string',  label: 'First Name' },
  lastName:             { alias: 'ap', dbCol: 'lastName',             type: 'string',  label: 'Last Name' },
  email:                { alias: 'ap', dbCol: 'email',                type: 'string',  label: 'Email' },
  phone:                { alias: 'ap', dbCol: 'phone',                type: 'string',  label: 'Phone' },
  nationality:          { alias: 'ap', dbCol: 'nationality',          type: 'string',  label: 'Nationality' },
  status:               { alias: 'ap', dbCol: 'status',               type: 'enum',    label: 'Status' },
  residencyStatus:      { alias: 'ap', dbCol: 'residencyStatus',      type: 'string',  label: 'Residency' },
  hasWorkAuthorization: { alias: 'ap', dbCol: 'hasWorkAuthorization', type: 'boolean', label: 'Work Auth' },
  availability:         { alias: 'ap', dbCol: 'availability',         type: 'string',  label: 'Availability' },
  salaryExpectation:    { alias: 'ap', dbCol: 'salaryExpectation',    type: 'string',  label: 'Salary Exp.' },
  willingToRelocate:    { alias: 'ap', dbCol: 'willingToRelocate',    type: 'boolean', label: 'Relocate' },
  createdAt:            { alias: 'ap', dbCol: 'createdAt',            type: 'date',    label: 'Created At' },
};

const agencyFields: SourceDef['fields'] = {
  id:            { alias: 'ag', dbCol: 'id',            type: 'uuid',   label: 'ID' },
  name:          { alias: 'ag', dbCol: 'name',          type: 'string', label: 'Name' },
  country:       { alias: 'ag', dbCol: 'country',       type: 'string', label: 'Country' },
  email:         { alias: 'ag', dbCol: 'email',         type: 'string', label: 'Email' },
  phone:         { alias: 'ag', dbCol: 'phone',         type: 'string', label: 'Phone' },
  status:        { alias: 'ag', dbCol: 'status',        type: 'enum',   label: 'Status' },
  createdAt:     { alias: 'ag', dbCol: 'createdAt',     type: 'date',   label: 'Created At' },
};

/**
 * Per-source readiness for the tenant-safe runtime.
 *   READY     — boot validator accepts; engine will execute
 *   DISABLED  — engine refuses to run; reason exposed to operator
 */
export type SourceStatus = 'READY' | 'DISABLED';

export interface MappedSource {
  status: SourceStatus;
  reason?: string;
  /** When READY, the validated SourceDef. When DISABLED, undefined. */
  def?: SourceDef;
}

const READY = (def: SourceDef): MappedSource => ({ status: 'READY', def });
const DISABLED = (reason: string): MappedSource => ({ status: 'DISABLED', reason });

/**
 * Phase 2.1 mapping — only the simple, safe-to-migrate sources are READY.
 *
 * Multi-table and entity-keyed sources are DISABLED until the Phase 2
 * backfill writes the parent-derived `tenantId` column.  Operators
 * still get a "source not available in tenant-safe mode" response;
 * the legacy engine continues to handle those sources.
 */
export const TENANT_SAFE_SOURCES: Record<string, MappedSource> = {
  // ─── Single-table, primary-table-has-tenantId ────────────────────────────
  employees: READY({
    key: 'employees',
    label: 'Employees',
    group: 'single',
    tables: ['employees'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [],
    fields: employeeFields,
  }),

  applicants: READY({
    key: 'applicants',
    label: 'Applicants',
    group: 'single',
    tables: ['applicants'],
    primaryTable: 'applicants',
    primaryAlias: 'ap',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [],
    fields: applicantFields,
  }),

  agencies: READY({
    key: 'agencies',
    label: 'Agencies',
    group: 'single',
    tables: ['agencies'],
    primaryTable: 'agencies',
    primaryAlias: 'ag',
    // The agencies table doesn't carry a soft-delete column; the legacy
    // engine likewise omits it.
    softDelete: false,
    tenantColumn: 'tenantId',
    // Self-scope: the row IS the agency, so agencyColumn = id.
    agencyColumn: 'id',
    tenantAwareJoins: [],
    fields: agencyFields,
  }),

  // ─── DISABLED: entity-keyed, awaiting Phase 2.3 denorm ───────────────────
  documents:         DISABLED('Phase 2.3 — `documents.tenantId` denorm not yet backfilled.'),
  compliance_alerts: DISABLED('Phase 2.3 — `compliance_alerts.tenantId` denorm not yet backfilled.'),
  work_permits:      DISABLED('Phase 2.3 — entity-keyed via Employee; awaits denorm.'),
  visas:             DISABLED('Phase 2.3 — entity-keyed; awaits denorm.'),
  document_types:    DISABLED('Phase 2.3 — catalog model with tenantId NULL semantics not finalised.'),

  // ─── DISABLED: multi-table joins require Phase 2.3 denorm + join rewrite ─
  employees_documents:        DISABLED('Phase 2.3 — joined documents.tenantId not yet backfilled.'),
  employees_work_permits:     DISABLED('Phase 2.3 — joined work_permits.tenantId not yet backfilled.'),
  employees_compliance:       DISABLED('Phase 2.3 — joined compliance_alerts.tenantId not yet backfilled.'),
  applicants_documents:       DISABLED('Phase 2.3 — same reason as employees_documents.'),
  employees_agencies:         DISABLED('Phase 2.3 — pending Wave A landing for both sides.'),
  applicants_compliance:      DISABLED('Phase 2.3 — joined compliance_alerts.tenantId not backfilled.'),
  documents_with_type:        DISABLED('Phase 2.3 — catalog join rules pending product sign-off.'),
  employees_visas:            DISABLED('Phase 2.3 — joined visas.tenantId not backfilled.'),
  applicants_visas:           DISABLED('Phase 2.3 — joined visas.tenantId not backfilled.'),
  employees_documents_type:   DISABLED('Phase 2.3 — depends on documents + document_types.'),
};

/** Convenience: list of READY source keys. */
export function readySourceKeys(): string[] {
  return Object.entries(TENANT_SAFE_SOURCES)
    .filter(([, m]) => m.status === 'READY')
    .map(([k]) => k);
}

/** Convenience: list of DISABLED source keys with reasons. */
export function disabledSources(): { key: string; reason: string }[] {
  return Object.entries(TENANT_SAFE_SOURCES)
    .filter(([, m]) => m.status === 'DISABLED')
    .map(([key, m]) => ({ key, reason: m.reason ?? 'unspecified' }));
}
