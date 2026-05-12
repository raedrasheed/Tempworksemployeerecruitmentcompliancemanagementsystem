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

  // ─── READY (Phase 2.3): single-table entity-keyed, denorm now available ─
  documents: READY({
    key: 'documents',
    label: 'Documents',
    group: 'single',
    tables: ['documents'],
    primaryTable: 'documents',
    primaryAlias: 'doc',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: null,                 // documents are entity-keyed; agency scope through parent
    tenantAwareJoins: [],
    fields: {
      id:             { alias: 'doc', dbCol: 'id',             type: 'uuid',   label: 'ID' },
      name:           { alias: 'doc', dbCol: 'name',           type: 'string', label: 'Name' },
      entityType:     { alias: 'doc', dbCol: 'entityType',     type: 'enum',   label: 'Entity Type' },
      status:         { alias: 'doc', dbCol: 'status',         type: 'enum',   label: 'Status' },
      fileSize:       { alias: 'doc', dbCol: 'fileSize',       type: 'number', label: 'Size (bytes)' },
      issueDate:      { alias: 'doc', dbCol: 'issueDate',      type: 'date',   label: 'Issue Date' },
      expiryDate:     { alias: 'doc', dbCol: 'expiryDate',     type: 'date',   label: 'Expiry Date' },
      issuer:         { alias: 'doc', dbCol: 'issuer',         type: 'string', label: 'Issuer' },
      documentNumber: { alias: 'doc', dbCol: 'documentNumber', type: 'string', label: 'Doc No.' },
      createdAt:      { alias: 'doc', dbCol: 'createdAt',      type: 'date',   label: 'Created At' },
    },
  }),

  compliance_alerts: READY({
    key: 'compliance_alerts',
    label: 'Compliance Alerts',
    group: 'single',
    tables: ['compliance_alerts'],
    primaryTable: 'compliance_alerts',
    primaryAlias: 'ca',
    softDelete: false,
    tenantColumn: 'tenantId',
    agencyColumn: null,
    tenantAwareJoins: [],
    fields: {
      id:         { alias: 'ca', dbCol: 'id',         type: 'uuid',   label: 'ID' },
      entityType: { alias: 'ca', dbCol: 'entityType', type: 'enum',   label: 'Entity Type' },
      alertType:  { alias: 'ca', dbCol: 'alertType',  type: 'string', label: 'Alert Type' },
      severity:   { alias: 'ca', dbCol: 'severity',   type: 'enum',   label: 'Severity' },
      message:    { alias: 'ca', dbCol: 'message',    type: 'string', label: 'Message' },
      status:     { alias: 'ca', dbCol: 'status',     type: 'enum',   label: 'Status' },
      dueDate:    { alias: 'ca', dbCol: 'dueDate',    type: 'date',   label: 'Due Date' },
      createdAt:  { alias: 'ca', dbCol: 'createdAt',  type: 'date',   label: 'Created At' },
    },
  }),

  work_permits: READY({
    key: 'work_permits',
    label: 'Work Permits',
    group: 'single',
    tables: ['work_permits'],
    primaryTable: 'work_permits',
    primaryAlias: 'wp',
    softDelete: false,
    tenantColumn: 'tenantId',
    agencyColumn: null,                 // permits are per-employee; agency scope via Employee
    tenantAwareJoins: [],
    fields: {
      id:              { alias: 'wp', dbCol: 'id',              type: 'uuid',   label: 'ID' },
      permitType:      { alias: 'wp', dbCol: 'permitType',      type: 'string', label: 'Permit Type' },
      status:          { alias: 'wp', dbCol: 'status',          type: 'enum',   label: 'Status' },
      permitNumber:    { alias: 'wp', dbCol: 'permitNumber',    type: 'string', label: 'Permit No.' },
      applicationDate: { alias: 'wp', dbCol: 'applicationDate', type: 'date',   label: 'Applied' },
      approvalDate:    { alias: 'wp', dbCol: 'approvalDate',    type: 'date',   label: 'Approved' },
      expiryDate:      { alias: 'wp', dbCol: 'expiryDate',      type: 'date',   label: 'Expiry' },
      createdAt:       { alias: 'wp', dbCol: 'createdAt',       type: 'date',   label: 'Created At' },
    },
  }),

  visas: READY({
    key: 'visas',
    label: 'Visas',
    group: 'single',
    tables: ['visas'],
    primaryTable: 'visas',
    primaryAlias: 'v',
    softDelete: false,
    tenantColumn: 'tenantId',
    agencyColumn: null,
    tenantAwareJoins: [],
    fields: {
      id:              { alias: 'v', dbCol: 'id',              type: 'uuid',   label: 'ID' },
      entityType:      { alias: 'v', dbCol: 'entityType',      type: 'enum',   label: 'Entity Type' },
      entityId:        { alias: 'v', dbCol: 'entityId',        type: 'string', label: 'Entity ID' },
      visaType:        { alias: 'v', dbCol: 'visaType',        type: 'string', label: 'Visa Type' },
      status:          { alias: 'v', dbCol: 'status',          type: 'enum',   label: 'Status' },
      visaNumber:      { alias: 'v', dbCol: 'visaNumber',      type: 'string', label: 'Visa Number' },
      applicationDate: { alias: 'v', dbCol: 'applicationDate', type: 'date',   label: 'Applied' },
      appointmentDate: { alias: 'v', dbCol: 'appointmentDate', type: 'date',   label: 'Appointment' },
      approvalDate:    { alias: 'v', dbCol: 'approvalDate',    type: 'date',   label: 'Approved' },
      expiryDate:      { alias: 'v', dbCol: 'expiryDate',      type: 'date',   label: 'Expiry' },
      embassy:         { alias: 'v', dbCol: 'embassy',         type: 'string', label: 'Embassy' },
      createdAt:       { alias: 'v', dbCol: 'createdAt',       type: 'date',   label: 'Created At' },
    },
  }),

  // ─── DISABLED: catalog accessed only through join sources ─────────────
  // `document_types` is a global catalog (no tenantId). It is accessible
  // for SELECT-style reporting via `documents_with_type` and
  // `employees_documents_type` using `kind: 'catalog'` joins. Exposing
  // it as a stand-alone source would let any tenant member enumerate
  // catalog rows — fine in principle, but Phase 2.4 keeps it behind the
  // joined sources until a product decision is made on direct exposure.
  // See `SAAS_PHASE2_CATALOG_SOURCES_DECISION.md`.
  document_types:    DISABLED('Phase 2.4 — global catalog; reachable via joined sources (documents_with_type, employees_documents_type) using kind=catalog. Direct exposure pending product decision.'),

  // ─── READY (Phase 2.4): tenant-safe joined sources ────────────────────
  employees_documents: READY({
    key: 'employees_documents',
    label: 'Employees + Documents',
    group: 'combined',
    tables: ['employees', 'documents'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [{
      joinType: 'LEFT',
      table: 'documents',
      alias: 'd',
      structuredOn: {
        fk:     { leftAlias: 'e', leftCol: 'id',       rightAlias: 'd', rightCol: 'entityId' },
        tenant: { leftAlias: 'e', leftCol: 'tenantId', rightAlias: 'd', rightCol: 'tenantId' },
        literals: [{ alias: 'd', col: 'entityType', literal: 'EMPLOYEE' }],
        nullChecks: [{ alias: 'd', col: 'deletedAt' }],
      },
    }],
    fields: {
      empId:           { alias: 'e', dbCol: 'id',             type: 'string', label: 'Employee ID' },
      empFirstName:    { alias: 'e', dbCol: 'firstName',      type: 'string', label: 'First Name' },
      empLastName:     { alias: 'e', dbCol: 'lastName',       type: 'string', label: 'Last Name' },
      empEmail:        { alias: 'e', dbCol: 'email',          type: 'string', label: 'Email' },
      empNationality:  { alias: 'e', dbCol: 'nationality',    type: 'string', label: 'Nationality' },
      empStatus:       { alias: 'e', dbCol: 'status',         type: 'enum',   label: 'Employee Status' },
      empCountry:      { alias: 'e', dbCol: 'country',        type: 'string', label: 'Country' },
      docName:         { alias: 'd', dbCol: 'name',           type: 'string', label: 'Document Name' },
      docNumber:       { alias: 'd', dbCol: 'documentNumber', type: 'string', label: 'Doc Number' },
      docStatus:       { alias: 'd', dbCol: 'status',         type: 'enum',   label: 'Doc Status' },
      docIssueDate:    { alias: 'd', dbCol: 'issueDate',      type: 'date',   label: 'Doc Issue Date' },
      docExpiryDate:   { alias: 'd', dbCol: 'expiryDate',     type: 'date',   label: 'Doc Expiry' },
      docIssuer:       { alias: 'd', dbCol: 'issuer',         type: 'string', label: 'Doc Issuer' },
      docCreatedAt:    { alias: 'd', dbCol: 'createdAt',      type: 'date',   label: 'Doc Created At' },
    },
    defaultSort: { field: 'empLastName', direction: 'ASC' },
  }),

  employees_work_permits: READY({
    key: 'employees_work_permits',
    label: 'Employees + Work Permits',
    group: 'combined',
    tables: ['employees', 'work_permits'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [{
      joinType: 'LEFT',
      table: 'work_permits',
      alias: 'wp',
      structuredOn: {
        fk:     { leftAlias: 'e', leftCol: 'id',       rightAlias: 'wp', rightCol: 'employeeId' },
        tenant: { leftAlias: 'e', leftCol: 'tenantId', rightAlias: 'wp', rightCol: 'tenantId' },
      },
    }],
    fields: {
      empId:           { alias: 'e',  dbCol: 'id',              type: 'string', label: 'Employee ID' },
      empFirstName:    { alias: 'e',  dbCol: 'firstName',       type: 'string', label: 'First Name' },
      empLastName:     { alias: 'e',  dbCol: 'lastName',        type: 'string', label: 'Last Name' },
      empEmail:        { alias: 'e',  dbCol: 'email',           type: 'string', label: 'Email' },
      empNationality:  { alias: 'e',  dbCol: 'nationality',     type: 'string', label: 'Nationality' },
      empStatus:       { alias: 'e',  dbCol: 'status',          type: 'enum',   label: 'Employee Status' },
      empCountry:      { alias: 'e',  dbCol: 'country',         type: 'string', label: 'Country' },
      wpPermitType:    { alias: 'wp', dbCol: 'permitType',      type: 'string', label: 'Permit Type' },
      wpStatus:        { alias: 'wp', dbCol: 'status',          type: 'enum',   label: 'Permit Status' },
      wpNumber:        { alias: 'wp', dbCol: 'permitNumber',    type: 'string', label: 'Permit No.' },
      wpAppliedDate:   { alias: 'wp', dbCol: 'applicationDate', type: 'date',   label: 'Applied Date' },
      wpApprovedDate:  { alias: 'wp', dbCol: 'approvalDate',    type: 'date',   label: 'Approval Date' },
      wpExpiryDate:    { alias: 'wp', dbCol: 'expiryDate',      type: 'date',   label: 'Permit Expiry' },
    },
  }),

  employees_compliance: READY({
    key: 'employees_compliance',
    label: 'Employees + Compliance Alerts',
    group: 'combined',
    tables: ['employees', 'compliance_alerts'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [{
      joinType: 'LEFT',
      table: 'compliance_alerts',
      alias: 'ca',
      structuredOn: {
        fk:     { leftAlias: 'e', leftCol: 'id',       rightAlias: 'ca', rightCol: 'entityId' },
        tenant: { leftAlias: 'e', leftCol: 'tenantId', rightAlias: 'ca', rightCol: 'tenantId' },
        literals: [{ alias: 'ca', col: 'entityType', literal: 'EMPLOYEE' }],
      },
    }],
    fields: {
      empId:          { alias: 'e',  dbCol: 'id',          type: 'string', label: 'Employee ID' },
      empFirstName:   { alias: 'e',  dbCol: 'firstName',   type: 'string', label: 'First Name' },
      empLastName:    { alias: 'e',  dbCol: 'lastName',    type: 'string', label: 'Last Name' },
      empEmail:       { alias: 'e',  dbCol: 'email',       type: 'string', label: 'Email' },
      empNationality: { alias: 'e',  dbCol: 'nationality', type: 'string', label: 'Nationality' },
      empStatus:      { alias: 'e',  dbCol: 'status',      type: 'enum',   label: 'Employee Status' },
      caAlertType:    { alias: 'ca', dbCol: 'alertType',   type: 'string', label: 'Alert Type' },
      caSeverity:     { alias: 'ca', dbCol: 'severity',    type: 'enum',   label: 'Severity' },
      caMessage:      { alias: 'ca', dbCol: 'message',     type: 'string', label: 'Alert Message' },
      caStatus:       { alias: 'ca', dbCol: 'status',      type: 'enum',   label: 'Alert Status' },
      caDueDate:      { alias: 'ca', dbCol: 'dueDate',     type: 'date',   label: 'Due Date' },
      caCreatedAt:    { alias: 'ca', dbCol: 'createdAt',   type: 'date',   label: 'Alert Date' },
    },
  }),

  applicants_documents: READY({
    key: 'applicants_documents',
    label: 'Applicants + Documents',
    group: 'combined',
    tables: ['applicants', 'documents'],
    primaryTable: 'applicants',
    primaryAlias: 'ap',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [{
      joinType: 'LEFT',
      table: 'documents',
      alias: 'd',
      structuredOn: {
        fk:     { leftAlias: 'ap', leftCol: 'id',       rightAlias: 'd', rightCol: 'entityId' },
        tenant: { leftAlias: 'ap', leftCol: 'tenantId', rightAlias: 'd', rightCol: 'tenantId' },
        literals: [{ alias: 'd', col: 'entityType', literal: 'APPLICANT' }],
        nullChecks: [{ alias: 'd', col: 'deletedAt' }],
      },
    }],
    fields: {
      apId:           { alias: 'ap', dbCol: 'id',                  type: 'string',  label: 'Applicant ID' },
      apFirstName:    { alias: 'ap', dbCol: 'firstName',           type: 'string',  label: 'First Name' },
      apLastName:     { alias: 'ap', dbCol: 'lastName',            type: 'string',  label: 'Last Name' },
      apEmail:        { alias: 'ap', dbCol: 'email',               type: 'string',  label: 'Email' },
      apNationality:  { alias: 'ap', dbCol: 'nationality',         type: 'string',  label: 'Nationality' },
      apStatus:       { alias: 'ap', dbCol: 'status',              type: 'enum',    label: 'Applicant Status' },
      apResidency:    { alias: 'ap', dbCol: 'residencyStatus',     type: 'string',  label: 'Residency' },
      apWorkAuth:     { alias: 'ap', dbCol: 'hasWorkAuthorization', type: 'boolean', label: 'Work Auth' },
      apCreatedAt:    { alias: 'ap', dbCol: 'createdAt',           type: 'date',    label: 'Applied At' },
      docName:        { alias: 'd',  dbCol: 'name',                type: 'string',  label: 'Document Name' },
      docNumber:      { alias: 'd',  dbCol: 'documentNumber',      type: 'string',  label: 'Doc Number' },
      docStatus:      { alias: 'd',  dbCol: 'status',              type: 'enum',    label: 'Doc Status' },
      docExpiryDate:  { alias: 'd',  dbCol: 'expiryDate',          type: 'date',    label: 'Doc Expiry' },
    },
  }),

  applicants_compliance: READY({
    key: 'applicants_compliance',
    label: 'Applicants + Compliance Alerts',
    group: 'combined',
    tables: ['applicants', 'compliance_alerts'],
    primaryTable: 'applicants',
    primaryAlias: 'ap',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [{
      joinType: 'LEFT',
      table: 'compliance_alerts',
      alias: 'ca',
      structuredOn: {
        fk:     { leftAlias: 'ap', leftCol: 'id',       rightAlias: 'ca', rightCol: 'entityId' },
        tenant: { leftAlias: 'ap', leftCol: 'tenantId', rightAlias: 'ca', rightCol: 'tenantId' },
        literals: [{ alias: 'ca', col: 'entityType', literal: 'APPLICANT' }],
      },
    }],
    fields: {
      apId:           { alias: 'ap', dbCol: 'id',          type: 'string', label: 'Applicant ID' },
      apFirstName:    { alias: 'ap', dbCol: 'firstName',   type: 'string', label: 'First Name' },
      apLastName:     { alias: 'ap', dbCol: 'lastName',    type: 'string', label: 'Last Name' },
      apEmail:        { alias: 'ap', dbCol: 'email',       type: 'string', label: 'Email' },
      apNationality:  { alias: 'ap', dbCol: 'nationality', type: 'string', label: 'Nationality' },
      apStatus:       { alias: 'ap', dbCol: 'status',      type: 'enum',   label: 'Applicant Status' },
      caAlertType:    { alias: 'ca', dbCol: 'alertType',   type: 'string', label: 'Alert Type' },
      caSeverity:     { alias: 'ca', dbCol: 'severity',    type: 'enum',   label: 'Severity' },
      caMessage:      { alias: 'ca', dbCol: 'message',     type: 'string', label: 'Alert Message' },
      caStatus:       { alias: 'ca', dbCol: 'status',      type: 'enum',   label: 'Alert Status' },
      caDueDate:      { alias: 'ca', dbCol: 'dueDate',     type: 'date',   label: 'Due Date' },
    },
  }),

  employees_visas: READY({
    key: 'employees_visas',
    label: 'Employees + Visas',
    group: 'combined',
    tables: ['employees', 'visas'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [{
      joinType: 'LEFT',
      table: 'visas',
      alias: 'v',
      structuredOn: {
        fk:     { leftAlias: 'e', leftCol: 'id',       rightAlias: 'v', rightCol: 'entityId' },
        tenant: { leftAlias: 'e', leftCol: 'tenantId', rightAlias: 'v', rightCol: 'tenantId' },
        literals: [{ alias: 'v', col: 'entityType', literal: 'EMPLOYEE' }],
      },
    }],
    fields: {
      empId:          { alias: 'e', dbCol: 'id',              type: 'string', label: 'Employee ID' },
      empFirstName:   { alias: 'e', dbCol: 'firstName',       type: 'string', label: 'First Name' },
      empLastName:    { alias: 'e', dbCol: 'lastName',        type: 'string', label: 'Last Name' },
      empEmail:       { alias: 'e', dbCol: 'email',           type: 'string', label: 'Email' },
      empNationality: { alias: 'e', dbCol: 'nationality',     type: 'string', label: 'Nationality' },
      empStatus:      { alias: 'e', dbCol: 'status',          type: 'enum',   label: 'Employee Status' },
      empCountry:     { alias: 'e', dbCol: 'country',         type: 'string', label: 'Country' },
      visaType:       { alias: 'v', dbCol: 'visaType',        type: 'string', label: 'Visa Type' },
      visaStatus:     { alias: 'v', dbCol: 'status',          type: 'enum',   label: 'Visa Status' },
      visaNumber:     { alias: 'v', dbCol: 'visaNumber',      type: 'string', label: 'Visa Number' },
      visaApplied:    { alias: 'v', dbCol: 'applicationDate', type: 'date',   label: 'Applied' },
      visaApproved:   { alias: 'v', dbCol: 'approvalDate',    type: 'date',   label: 'Approved' },
      visaExpiry:     { alias: 'v', dbCol: 'expiryDate',      type: 'date',   label: 'Visa Expiry' },
      visaEmbassy:    { alias: 'v', dbCol: 'embassy',         type: 'string', label: 'Embassy' },
    },
  }),

  applicants_visas: READY({
    key: 'applicants_visas',
    label: 'Applicants + Visas',
    group: 'combined',
    tables: ['applicants', 'visas'],
    primaryTable: 'applicants',
    primaryAlias: 'ap',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [{
      joinType: 'LEFT',
      table: 'visas',
      alias: 'v',
      structuredOn: {
        fk:     { leftAlias: 'ap', leftCol: 'id',       rightAlias: 'v', rightCol: 'entityId' },
        tenant: { leftAlias: 'ap', leftCol: 'tenantId', rightAlias: 'v', rightCol: 'tenantId' },
        literals: [{ alias: 'v', col: 'entityType', literal: 'APPLICANT' }],
      },
    }],
    fields: {
      apId:           { alias: 'ap', dbCol: 'id',                  type: 'string',  label: 'Applicant ID' },
      apFirstName:    { alias: 'ap', dbCol: 'firstName',           type: 'string',  label: 'First Name' },
      apLastName:     { alias: 'ap', dbCol: 'lastName',            type: 'string',  label: 'Last Name' },
      apEmail:        { alias: 'ap', dbCol: 'email',               type: 'string',  label: 'Email' },
      apNationality:  { alias: 'ap', dbCol: 'nationality',         type: 'string',  label: 'Nationality' },
      apStatus:       { alias: 'ap', dbCol: 'status',              type: 'enum',    label: 'Applicant Status' },
      apWorkAuth:     { alias: 'ap', dbCol: 'hasWorkAuthorization', type: 'boolean', label: 'Work Auth' },
      visaType:       { alias: 'v',  dbCol: 'visaType',            type: 'string',  label: 'Visa Type' },
      visaStatus:     { alias: 'v',  dbCol: 'status',              type: 'enum',    label: 'Visa Status' },
      visaNumber:     { alias: 'v',  dbCol: 'visaNumber',          type: 'string',  label: 'Visa Number' },
      visaApplied:    { alias: 'v',  dbCol: 'applicationDate',     type: 'date',    label: 'Applied' },
      visaApproved:   { alias: 'v',  dbCol: 'approvalDate',        type: 'date',    label: 'Approved' },
      visaExpiry:     { alias: 'v',  dbCol: 'expiryDate',          type: 'date',    label: 'Visa Expiry' },
      visaEmbassy:    { alias: 'v',  dbCol: 'embassy',             type: 'string',  label: 'Embassy' },
    },
  }),

  employees_agencies: READY({
    key: 'employees_agencies',
    label: 'Employees + Agencies',
    group: 'combined',
    tables: ['employees', 'agencies'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [{
      joinType: 'LEFT',
      table: 'agencies',
      alias: 'ag',
      structuredOn: {
        fk:     { leftAlias: 'e', leftCol: 'agencyId', rightAlias: 'ag', rightCol: 'id' },
        tenant: { leftAlias: 'e', leftCol: 'tenantId', rightAlias: 'ag', rightCol: 'tenantId' },
        nullChecks: [{ alias: 'ag', col: 'deletedAt' }],
      },
    }],
    fields: {
      empId:           { alias: 'e',  dbCol: 'id',            type: 'string', label: 'Employee ID' },
      empFirstName:    { alias: 'e',  dbCol: 'firstName',     type: 'string', label: 'First Name' },
      empLastName:     { alias: 'e',  dbCol: 'lastName',      type: 'string', label: 'Last Name' },
      empEmail:        { alias: 'e',  dbCol: 'email',         type: 'string', label: 'Email' },
      empNationality:  { alias: 'e',  dbCol: 'nationality',   type: 'string', label: 'Nationality' },
      empStatus:       { alias: 'e',  dbCol: 'status',        type: 'enum',   label: 'Employee Status' },
      empCity:         { alias: 'e',  dbCol: 'city',          type: 'string', label: 'City' },
      empCountry:      { alias: 'e',  dbCol: 'country',       type: 'string', label: 'Country' },
      empCreatedAt:    { alias: 'e',  dbCol: 'createdAt',     type: 'date',   label: 'Employee Since' },
      agName:          { alias: 'ag', dbCol: 'name',          type: 'string', label: 'Agency Name' },
      agCountry:       { alias: 'ag', dbCol: 'country',       type: 'string', label: 'Agency Country' },
      agContact:       { alias: 'ag', dbCol: 'contactPerson', type: 'string', label: 'Agency Contact' },
      agStatus:        { alias: 'ag', dbCol: 'status',        type: 'enum',   label: 'Agency Status' },
    },
  }),

  documents_with_type: READY({
    key: 'documents_with_type',
    label: 'Documents + Document Types',
    group: 'combined',
    tables: ['documents', 'document_types'],
    primaryTable: 'documents',
    primaryAlias: 'doc',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: null,                 // entity-keyed; agency scope through parent
    tenantAwareJoins: [{
      joinType: 'LEFT',
      table: 'document_types',
      alias: 'dt',
      kind: 'catalog',                  // global catalog — no tenantId on dt
      structuredOn: {
        fk: { leftAlias: 'doc', leftCol: 'documentTypeId', rightAlias: 'dt', rightCol: 'id' },
      },
    }],
    fields: {
      docId:            { alias: 'doc', dbCol: 'id',               type: 'string',  label: 'Document ID' },
      docName:          { alias: 'doc', dbCol: 'name',             type: 'string',  label: 'Document Name' },
      docEntityType:    { alias: 'doc', dbCol: 'entityType',       type: 'enum',    label: 'Entity Type' },
      docNumber:        { alias: 'doc', dbCol: 'documentNumber',   type: 'string',  label: 'Doc Number' },
      docStatus:        { alias: 'doc', dbCol: 'status',           type: 'enum',    label: 'Status' },
      docIssueDate:     { alias: 'doc', dbCol: 'issueDate',        type: 'date',    label: 'Issue Date' },
      docExpiryDate:    { alias: 'doc', dbCol: 'expiryDate',       type: 'date',    label: 'Expiry Date' },
      docIssuer:        { alias: 'doc', dbCol: 'issuer',           type: 'string',  label: 'Issuer' },
      docFileSize:      { alias: 'doc', dbCol: 'fileSize',         type: 'number',  label: 'File Size (bytes)' },
      docCreatedAt:     { alias: 'doc', dbCol: 'createdAt',        type: 'date',    label: 'Uploaded At' },
      dtTypeName:       { alias: 'dt',  dbCol: 'name',             type: 'string',  label: 'Document Type' },
      dtCategory:       { alias: 'dt',  dbCol: 'category',         type: 'string',  label: 'Type Category' },
      dtRequired:       { alias: 'dt',  dbCol: 'required',         type: 'boolean', label: 'Required' },
      dtTrackExpiry:    { alias: 'dt',  dbCol: 'trackExpiry',      type: 'boolean', label: 'Track Expiry' },
      dtRenewalDays:    { alias: 'dt',  dbCol: 'renewalPeriodDays', type: 'number',  label: 'Renewal Period (days)' },
    },
  }),

  employees_documents_type: READY({
    key: 'employees_documents_type',
    label: 'Employees + Documents + Types',
    group: 'combined',
    tables: ['employees', 'documents', 'document_types'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    tenantColumn: 'tenantId',
    agencyColumn: 'agencyId',
    tenantAwareJoins: [
      {
        joinType: 'LEFT',
        table: 'documents',
        alias: 'd',
        structuredOn: {
          fk:     { leftAlias: 'e', leftCol: 'id',       rightAlias: 'd', rightCol: 'entityId' },
          tenant: { leftAlias: 'e', leftCol: 'tenantId', rightAlias: 'd', rightCol: 'tenantId' },
          literals: [{ alias: 'd', col: 'entityType', literal: 'EMPLOYEE' }],
          nullChecks: [{ alias: 'd', col: 'deletedAt' }],
        },
      },
      {
        joinType: 'LEFT',
        table: 'document_types',
        alias: 'dt',
        kind: 'catalog',
        structuredOn: {
          fk: { leftAlias: 'd', leftCol: 'documentTypeId', rightAlias: 'dt', rightCol: 'id' },
        },
      },
    ],
    fields: {
      empId:         { alias: 'e',   dbCol: 'id',                type: 'string',  label: 'Employee ID' },
      empFirstName:  { alias: 'e',   dbCol: 'firstName',         type: 'string',  label: 'First Name' },
      empLastName:   { alias: 'e',   dbCol: 'lastName',          type: 'string',  label: 'Last Name' },
      empEmail:      { alias: 'e',   dbCol: 'email',             type: 'string',  label: 'Email' },
      empNationality:{ alias: 'e',   dbCol: 'nationality',       type: 'string',  label: 'Nationality' },
      empStatus:     { alias: 'e',   dbCol: 'status',            type: 'enum',    label: 'Employee Status' },
      docName:       { alias: 'd',   dbCol: 'name',              type: 'string',  label: 'Document Name' },
      docNumber:     { alias: 'd',   dbCol: 'documentNumber',    type: 'string',  label: 'Doc Number' },
      docStatus:     { alias: 'd',   dbCol: 'status',            type: 'enum',    label: 'Doc Status' },
      docExpiry:     { alias: 'd',   dbCol: 'expiryDate',        type: 'date',    label: 'Doc Expiry' },
      dtTypeName:    { alias: 'dt',  dbCol: 'name',              type: 'string',  label: 'Document Type' },
      dtCategory:    { alias: 'dt',  dbCol: 'category',          type: 'string',  label: 'Type Category' },
      dtRequired:    { alias: 'dt',  dbCol: 'required',          type: 'boolean', label: 'Required' },
      dtRenewalDays: { alias: 'dt',  dbCol: 'renewalPeriodDays', type: 'number',  label: 'Renewal Period (days)' },
    },
  }),
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
