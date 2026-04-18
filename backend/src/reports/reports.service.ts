import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, WidthType,
} from 'docx';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReportDto, UpdateReportDto, RunReportDto, ExportFormat,
  ReportFilterDto, ReportColumnDto, ReportSortingDto,
} from './dto/report.dto';

// ─── Data-Source Registry ─────────────────────────────────────────────────────

interface FieldDef {
  alias: string;   // table alias used in query
  dbCol: string;   // actual column name in the DB
  type: string;
  label: string;
}

interface JoinDef {
  joinType: 'LEFT' | 'INNER';
  table: string;   // DB table name
  alias: string;   // alias in the query
  /** Fully-written, static ON condition using aliases.  All values are
   *  hardcoded here — never interpolated from user input — so Prisma.raw is safe. */
  on: string;
}

interface SourceDef {
  label: string;
  group: 'single' | 'combined';
  /** Human-readable names of every table that participates */
  tables: string[];
  primaryTable: string;
  primaryAlias: string;
  /** Primary table has a deletedAt soft-delete column */
  softDelete: boolean;
  joins: JoinDef[];
  fields: Record<string, FieldDef>;
}

const SOURCE_DEFS: Record<string, SourceDef> = {
  // ── Single-table sources ──────────────────────────────────────────────────
  employees: {
    label: 'Employees', group: 'single', tables: ['Employees'],
    primaryTable: 'employees', primaryAlias: 'e', softDelete: true, joins: [],
    fields: {
      id:              { alias: 'e', dbCol: 'id',              type: 'string', label: 'ID' },
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
    },
  },

  applicants: {
    label: 'Applicants', group: 'single', tables: ['Applicants'],
    primaryTable: 'applicants', primaryAlias: 'ap', softDelete: true, joins: [],
    fields: {
      id:                   { alias: 'ap', dbCol: 'id',                   type: 'string',  label: 'ID' },
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
    },
  },

  documents: {
    label: 'Documents', group: 'single', tables: ['Documents'],
    primaryTable: 'documents', primaryAlias: 'doc', softDelete: true, joins: [],
    fields: {
      id:             { alias: 'doc', dbCol: 'id',             type: 'string', label: 'ID' },
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
  },

  compliance_alerts: {
    label: 'Compliance Alerts', group: 'single', tables: ['Compliance Alerts'],
    primaryTable: 'compliance_alerts', primaryAlias: 'ca', softDelete: false, joins: [],
    fields: {
      id:         { alias: 'ca', dbCol: 'id',         type: 'string', label: 'ID' },
      entityType: { alias: 'ca', dbCol: 'entityType', type: 'enum',   label: 'Entity Type' },
      alertType:  { alias: 'ca', dbCol: 'alertType',  type: 'string', label: 'Alert Type' },
      severity:   { alias: 'ca', dbCol: 'severity',   type: 'enum',   label: 'Severity' },
      message:    { alias: 'ca', dbCol: 'message',    type: 'string', label: 'Message' },
      status:     { alias: 'ca', dbCol: 'status',     type: 'enum',   label: 'Status' },
      dueDate:    { alias: 'ca', dbCol: 'dueDate',    type: 'date',   label: 'Due Date' },
      createdAt:  { alias: 'ca', dbCol: 'createdAt',  type: 'date',   label: 'Created At' },
    },
  },

  agencies: {
    label: 'Agencies', group: 'single', tables: ['Agencies'],
    primaryTable: 'agencies', primaryAlias: 'ag', softDelete: true, joins: [],
    fields: {
      id:            { alias: 'ag', dbCol: 'id',            type: 'string', label: 'ID' },
      name:          { alias: 'ag', dbCol: 'name',          type: 'string', label: 'Name' },
      country:       { alias: 'ag', dbCol: 'country',       type: 'string', label: 'Country' },
      contactPerson: { alias: 'ag', dbCol: 'contactPerson', type: 'string', label: 'Contact' },
      email:         { alias: 'ag', dbCol: 'email',         type: 'string', label: 'Email' },
      phone:         { alias: 'ag', dbCol: 'phone',         type: 'string', label: 'Phone' },
      status:        { alias: 'ag', dbCol: 'status',        type: 'enum',   label: 'Status' },
      createdAt:     { alias: 'ag', dbCol: 'createdAt',     type: 'date',   label: 'Created At' },
    },
  },

  work_permits: {
    label: 'Work Permits', group: 'single', tables: ['Work Permits'],
    primaryTable: 'work_permits', primaryAlias: 'wp', softDelete: false, joins: [],
    fields: {
      id:              { alias: 'wp', dbCol: 'id',              type: 'string', label: 'ID' },
      permitType:      { alias: 'wp', dbCol: 'permitType',      type: 'string', label: 'Permit Type' },
      status:          { alias: 'wp', dbCol: 'status',          type: 'enum',   label: 'Status' },
      permitNumber:    { alias: 'wp', dbCol: 'permitNumber',    type: 'string', label: 'Permit No.' },
      applicationDate: { alias: 'wp', dbCol: 'applicationDate', type: 'date',   label: 'Applied' },
      approvalDate:    { alias: 'wp', dbCol: 'approvalDate',    type: 'date',   label: 'Approved' },
      expiryDate:      { alias: 'wp', dbCol: 'expiryDate',      type: 'date',   label: 'Expiry' },
      createdAt:       { alias: 'wp', dbCol: 'createdAt',       type: 'date',   label: 'Created At' },
    },
  },

  // ── Combined / multi-table sources ───────────────────────────────────────
  employees_documents: {
    label: 'Employees + Documents',
    group: 'combined',
    tables: ['Employees', 'Documents'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    joins: [{
      joinType: 'LEFT',
      table: 'documents',
      alias: 'd',
      on: `e.id = d."entityId" AND d."entityType" = 'EMPLOYEE' AND d."deletedAt" IS NULL`,
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
  },

  employees_work_permits: {
    label: 'Employees + Work Permits',
    group: 'combined',
    tables: ['Employees', 'Work Permits'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    joins: [{
      joinType: 'LEFT',
      table: 'work_permits',
      alias: 'wp',
      on: `e.id = wp."employeeId"`,
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
  },

  employees_compliance: {
    label: 'Employees + Compliance Alerts',
    group: 'combined',
    tables: ['Employees', 'Compliance Alerts'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    joins: [{
      joinType: 'LEFT',
      table: 'compliance_alerts',
      alias: 'ca',
      on: `e.id = ca."entityId" AND ca."entityType" = 'EMPLOYEE'`,
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
  },

  applicants_documents: {
    label: 'Applicants + Documents',
    group: 'combined',
    tables: ['Applicants', 'Documents'],
    primaryTable: 'applicants',
    primaryAlias: 'ap',
    softDelete: true,
    joins: [{
      joinType: 'LEFT',
      table: 'documents',
      alias: 'd',
      on: `ap.id = d."entityId" AND d."entityType" = 'APPLICANT' AND d."deletedAt" IS NULL`,
    }],
    fields: {
      apId:           { alias: 'ap', dbCol: 'id',              type: 'string',  label: 'Applicant ID' },
      apFirstName:    { alias: 'ap', dbCol: 'firstName',       type: 'string',  label: 'First Name' },
      apLastName:     { alias: 'ap', dbCol: 'lastName',        type: 'string',  label: 'Last Name' },
      apEmail:        { alias: 'ap', dbCol: 'email',           type: 'string',  label: 'Email' },
      apNationality:  { alias: 'ap', dbCol: 'nationality',     type: 'string',  label: 'Nationality' },
      apStatus:       { alias: 'ap', dbCol: 'status',          type: 'enum',    label: 'Applicant Status' },
      apResidency:    { alias: 'ap', dbCol: 'residencyStatus', type: 'string',  label: 'Residency' },
      apWorkAuth:     { alias: 'ap', dbCol: 'hasWorkAuthorization', type: 'boolean', label: 'Work Auth' },
      apCreatedAt:    { alias: 'ap', dbCol: 'createdAt',       type: 'date',    label: 'Applied At' },
      docName:        { alias: 'd',  dbCol: 'name',            type: 'string',  label: 'Document Name' },
      docNumber:      { alias: 'd',  dbCol: 'documentNumber',  type: 'string',  label: 'Doc Number' },
      docStatus:      { alias: 'd',  dbCol: 'status',          type: 'enum',    label: 'Doc Status' },
      docExpiryDate:  { alias: 'd',  dbCol: 'expiryDate',      type: 'date',    label: 'Doc Expiry' },
    },
  },

  employees_agencies: {
    label: 'Employees + Agencies',
    group: 'combined',
    tables: ['Employees', 'Agencies'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    joins: [{
      joinType: 'LEFT',
      table: 'agencies',
      alias: 'ag',
      on: `e."agencyId" = ag.id AND ag."deletedAt" IS NULL`,
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
  },

  applicants_compliance: {
    label: 'Applicants + Compliance Alerts',
    group: 'combined',
    tables: ['Applicants', 'Compliance Alerts'],
    primaryTable: 'applicants',
    primaryAlias: 'ap',
    softDelete: true,
    joins: [{
      joinType: 'LEFT',
      table: 'compliance_alerts',
      alias: 'ca',
      on: `ap.id = ca."entityId" AND ca."entityType" = 'APPLICANT'`,
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
  },

  // ── Additional detail tables ──────────────────────────────────────────────
  document_types: {
    label: 'Document Types', group: 'single', tables: ['Document Types'],
    primaryTable: 'document_types', primaryAlias: 'dt', softDelete: false, joins: [],
    fields: {
      id:               { alias: 'dt', dbCol: 'id',               type: 'string',  label: 'ID' },
      name:             { alias: 'dt', dbCol: 'name',             type: 'string',  label: 'Type Name' },
      description:      { alias: 'dt', dbCol: 'description',      type: 'string',  label: 'Description' },
      category:         { alias: 'dt', dbCol: 'category',         type: 'string',  label: 'Category' },
      required:         { alias: 'dt', dbCol: 'required',         type: 'boolean', label: 'Required' },
      trackExpiry:      { alias: 'dt', dbCol: 'trackExpiry',      type: 'boolean', label: 'Track Expiry' },
      renewalPeriodDays:{ alias: 'dt', dbCol: 'renewalPeriodDays',type: 'number',  label: 'Renewal Period (days)' },
      isActive:         { alias: 'dt', dbCol: 'isActive',         type: 'boolean', label: 'Is Active' },
      createdAt:        { alias: 'dt', dbCol: 'createdAt',        type: 'date',    label: 'Created At' },
    },
  },

  visas: {
    label: 'Visas', group: 'single', tables: ['Visas'],
    primaryTable: 'visas', primaryAlias: 'v', softDelete: false, joins: [],
    fields: {
      id:              { alias: 'v', dbCol: 'id',              type: 'string', label: 'ID' },
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
  },

  documents_with_type: {
    label: 'Documents + Document Types',
    group: 'combined',
    tables: ['Documents', 'Document Types'],
    primaryTable: 'documents',
    primaryAlias: 'doc',
    softDelete: true,
    joins: [{
      joinType: 'LEFT',
      table: 'document_types',
      alias: 'dt',
      on: `doc."documentTypeId" = dt.id`,
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
      dtRenewalDays:    { alias: 'dt',  dbCol: 'renewalPeriodDays',type: 'number',  label: 'Renewal Period (days)' },
    },
  },

  employees_visas: {
    label: 'Employees + Visas',
    group: 'combined',
    tables: ['Employees', 'Visas'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    joins: [{
      joinType: 'LEFT',
      table: 'visas',
      alias: 'v',
      on: `e.id = v."entityId" AND v."entityType" = 'EMPLOYEE'`,
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
  },

  applicants_visas: {
    label: 'Applicants + Visas',
    group: 'combined',
    tables: ['Applicants', 'Visas'],
    primaryTable: 'applicants',
    primaryAlias: 'ap',
    softDelete: true,
    joins: [{
      joinType: 'LEFT',
      table: 'visas',
      alias: 'v',
      on: `ap.id = v."entityId" AND v."entityType" = 'APPLICANT'`,
    }],
    fields: {
      apId:           { alias: 'ap', dbCol: 'id',              type: 'string',  label: 'Applicant ID' },
      apFirstName:    { alias: 'ap', dbCol: 'firstName',       type: 'string',  label: 'First Name' },
      apLastName:     { alias: 'ap', dbCol: 'lastName',        type: 'string',  label: 'Last Name' },
      apEmail:        { alias: 'ap', dbCol: 'email',           type: 'string',  label: 'Email' },
      apNationality:  { alias: 'ap', dbCol: 'nationality',     type: 'string',  label: 'Nationality' },
      apStatus:       { alias: 'ap', dbCol: 'status',          type: 'enum',    label: 'Applicant Status' },
      apWorkAuth:     { alias: 'ap', dbCol: 'hasWorkAuthorization', type: 'boolean', label: 'Work Auth' },
      visaType:       { alias: 'v',  dbCol: 'visaType',        type: 'string',  label: 'Visa Type' },
      visaStatus:     { alias: 'v',  dbCol: 'status',          type: 'enum',    label: 'Visa Status' },
      visaNumber:     { alias: 'v',  dbCol: 'visaNumber',      type: 'string',  label: 'Visa Number' },
      visaApplied:    { alias: 'v',  dbCol: 'applicationDate', type: 'date',    label: 'Applied' },
      visaApproved:   { alias: 'v',  dbCol: 'approvalDate',    type: 'date',    label: 'Approved' },
      visaExpiry:     { alias: 'v',  dbCol: 'expiryDate',      type: 'date',    label: 'Visa Expiry' },
      visaEmbassy:    { alias: 'v',  dbCol: 'embassy',         type: 'string',  label: 'Embassy' },
    },
  },

  employees_documents_type: {
    label: 'Employees + Documents + Types',
    group: 'combined',
    tables: ['Employees', 'Documents', 'Document Types'],
    primaryTable: 'employees',
    primaryAlias: 'e',
    softDelete: true,
    joins: [
      {
        joinType: 'LEFT',
        table: 'documents',
        alias: 'd',
        on: `e.id = d."entityId" AND d."entityType" = 'EMPLOYEE' AND d."deletedAt" IS NULL`,
      },
      {
        joinType: 'LEFT',
        table: 'document_types',
        alias: 'dt',
        on: `d."documentTypeId" = dt.id`,
      },
    ],
    fields: {
      empId:         { alias: 'e',   dbCol: 'id',               type: 'string',  label: 'Employee ID' },
      empFirstName:  { alias: 'e',   dbCol: 'firstName',        type: 'string',  label: 'First Name' },
      empLastName:   { alias: 'e',   dbCol: 'lastName',         type: 'string',  label: 'Last Name' },
      empEmail:      { alias: 'e',   dbCol: 'email',            type: 'string',  label: 'Email' },
      empNationality:{ alias: 'e',   dbCol: 'nationality',      type: 'string',  label: 'Nationality' },
      empStatus:     { alias: 'e',   dbCol: 'status',           type: 'enum',    label: 'Employee Status' },
      docName:       { alias: 'd',   dbCol: 'name',             type: 'string',  label: 'Document Name' },
      docNumber:     { alias: 'd',   dbCol: 'documentNumber',   type: 'string',  label: 'Doc Number' },
      docStatus:     { alias: 'd',   dbCol: 'status',           type: 'enum',    label: 'Doc Status' },
      docExpiry:     { alias: 'd',   dbCol: 'expiryDate',       type: 'date',    label: 'Doc Expiry' },
      dtTypeName:    { alias: 'dt',  dbCol: 'name',             type: 'string',  label: 'Document Type' },
      dtCategory:    { alias: 'dt',  dbCol: 'category',         type: 'string',  label: 'Type Category' },
      dtRequired:    { alias: 'dt',  dbCol: 'required',         type: 'boolean', label: 'Required' },
      dtRenewalDays: { alias: 'dt',  dbCol: 'renewalPeriodDays',type: 'number',  label: 'Renewal Period (days)' },
    },
  },
};

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ── Schema introspection ─────────────────────────────────────────────────

  getDataSources() {
    return Object.entries(SOURCE_DEFS).map(([key, def]) => ({
      key,
      label: def.label,
      group: def.group,
      tables: def.tables,
      fields: Object.entries(def.fields).map(([f, meta]) => ({
        key: f, label: meta.label, type: meta.type,
      })),
    }));
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async create(dto: CreateReportDto, userId?: string) {
    const existing = await this.prisma.report.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existing) throw new ConflictException(`Report name "${dto.name}" is already in use`);

    return this.prisma.report.create({
      data: {
        name:        dto.name,
        description: dto.description,
        dataSource:  dto.dataSource,
        createdById: userId,
        filters: { create: (dto.filters  ?? []).map(this.mapFilter) },
        columns: { create: (dto.columns  ?? []).map(this.mapColumn) },
        sorting: { create: (dto.sorting  ?? []).map(this.mapSorting) },
      },
      include: this.include,
    });
  }

  async findAll() {
    return this.prisma.report.findMany({
      where: { deletedAt: null },
      include: this.include,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }

  async update(id: string, dto: UpdateReportDto) {
    await this.findOne(id);
    if (dto.name) {
      const conflict = await this.prisma.report.findFirst({
        where: { name: dto.name, deletedAt: null, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Report name "${dto.name}" is already in use`);
    }
    await this.prisma.$transaction([
      this.prisma.reportFilter.deleteMany({ where: { reportId: id } }),
      this.prisma.reportColumn.deleteMany({ where: { reportId: id } }),
      this.prisma.reportSorting.deleteMany({ where: { reportId: id } }),
      this.prisma.report.update({
        where: { id },
        data: {
          name: dto.name, description: dto.description, dataSource: dto.dataSource,
          filters: { create: (dto.filters  ?? []).map(this.mapFilter) },
          columns: { create: (dto.columns  ?? []).map(this.mapColumn) },
          sorting: { create: (dto.sorting  ?? []).map(this.mapSorting) },
        },
      }),
    ]);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.report.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Report deleted' };
  }

  private get include() {
    return {
      filters: true,
      columns: { orderBy: { position: 'asc' as const } },
      sorting: { orderBy: { position: 'asc' as const } },
    };
  }

  private mapFilter  = (f: ReportFilterDto)  => ({ fieldName: f.fieldName, operator: f.operator, value: f.value ?? '', value2: f.value2, valueType: f.valueType ?? 'string' });
  private mapColumn  = (c: ReportColumnDto)  => ({ columnName: c.columnName, displayName: c.displayName, dataType: c.dataType ?? 'string', isGrouped: c.isGrouped ?? false, isAggregated: c.isAggregated ?? false, aggregationType: c.aggregationType, position: c.position ?? 0 });
  private mapSorting = (s: ReportSortingDto) => ({ columnName: s.columnName, direction: s.direction ?? 'ASC', position: s.position ?? 0 });

  // ── Run (dynamic query) ───────────────────────────────────────────────────

  async run(id: string, opts: RunReportDto = {}) {
    const report = await this.findOne(id);
    return this.executeReport(report, opts);
  }

  private async executeReport(
    report: any,
    opts: RunReportDto,
  ): Promise<{ columns: any[]; rows: any[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 100 } = opts;
    const source = report.dataSource as string;
    const def = SOURCE_DEFS[source];
    if (!def) throw new BadRequestException(`Unknown data source: ${source}`);

    const { primaryTable, primaryAlias, softDelete, joins, fields } = def;

    // ── Column selection ─────────────────────────────────────────────────
    const cols: any[] = report.columns.length
      ? report.columns
      : Object.entries(fields).map(([k, v]) => ({
          columnName: k, displayName: v.label,
          isAggregated: false, aggregationType: null, isGrouped: false,
        }));

    const selectParts: string[] = [];
    for (const col of cols) {
      const f = fields[col.columnName];
      if (!f) continue;
      const colRef = `${f.alias}."${f.dbCol}"`;
      if (col.isAggregated && col.aggregationType) {
        selectParts.push(`${col.aggregationType}(${colRef}) AS "${col.columnName}"`);
      } else {
        selectParts.push(`${colRef} AS "${col.columnName}"`);
      }
    }
    if (selectParts.length === 0) selectParts.push(`${primaryAlias}.*`);

    // ── FROM + JOIN ───────────────────────────────────────────────────────
    const joinFragments = joins.map(j =>
      `${j.joinType} JOIN "${j.table}" AS ${j.alias} ON ${j.on}`,
    );
    const fromFragment = `"${primaryTable}" AS ${primaryAlias}${joinFragments.length ? ' ' + joinFragments.join(' ') : ''}`;

    // ── WHERE clause ─────────────────────────────────────────────────────
    const conditions: Prisma.Sql[] = softDelete
      ? [Prisma.sql`${Prisma.raw(`${primaryAlias}."deletedAt"`)} IS NULL`]
      : [];

    for (const filter of (report.filters as any[])) {
      const f = fields[filter.fieldName];
      if (!f) continue; // whitelist: skip unknown fields

      const col    = Prisma.raw(`${f.alias}."${f.dbCol}"`);
      const casted = this.castValue(filter.value, filter.valueType);

      switch (filter.operator) {
        case 'eq':          conditions.push(Prisma.sql`${col} = ${casted}`); break;
        case 'ne':          conditions.push(Prisma.sql`${col} != ${casted}`); break;
        case 'gt':          conditions.push(Prisma.sql`${col} > ${casted}`); break;
        case 'gte':         conditions.push(Prisma.sql`${col} >= ${casted}`); break;
        case 'lt':          conditions.push(Prisma.sql`${col} < ${casted}`); break;
        case 'lte':         conditions.push(Prisma.sql`${col} <= ${casted}`); break;
        case 'like':        conditions.push(Prisma.sql`${col} ILIKE ${'%' + filter.value + '%'}`); break;
        case 'between': {
          const c2 = filter.value2 ? this.castValue(filter.value2, filter.valueType) : null;
          if (c2 !== null) conditions.push(Prisma.sql`${col} BETWEEN ${casted} AND ${c2}`);
          break;
        }
        case 'in': {
          const vals = (filter.value || '').split(',').map((v: string) => this.castValue(v.trim(), filter.valueType));
          if (vals.length) conditions.push(Prisma.sql`${col} = ANY(${vals})`);
          break;
        }
        case 'is_null':     conditions.push(Prisma.sql`${col} IS NULL`);     break;
        case 'is_not_null': conditions.push(Prisma.sql`${col} IS NOT NULL`); break;
      }
    }

    const whereClause = conditions.length ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`;

    // ── GROUP BY ──────────────────────────────────────────────────────────
    const groupedCols = cols.filter((c: any) => c.isGrouped && fields[c.columnName]);
    const groupByClause = groupedCols.length
      ? Prisma.sql`GROUP BY ${Prisma.join(
          groupedCols.map((c: any) => Prisma.raw(`${fields[c.columnName].alias}."${fields[c.columnName].dbCol}"`)),
          ', ',
        )}`
      : Prisma.empty;

    // ── ORDER BY ──────────────────────────────────────────────────────────
    const sortParts = (report.sorting as any[])
      .filter((s: any) => fields[s.columnName])
      .map((s: any) => Prisma.raw(
        `${fields[s.columnName].alias}."${fields[s.columnName].dbCol}" ${s.direction === 'DESC' ? 'DESC' : 'ASC'}`,
      ));
    const fallbackOrder = `${primaryAlias}."createdAt" DESC`;
    const orderByClause = sortParts.length
      ? Prisma.sql`ORDER BY ${Prisma.join(sortParts, ', ')}`
      : Prisma.sql`ORDER BY ${Prisma.raw(fallbackOrder)}`;

    // ── Count ─────────────────────────────────────────────────────────────
    const offset = (Number(page) - 1) * Number(limit);
    // For joined sources use COUNT(DISTINCT primary key) to avoid inflated counts from 1-to-many joins
    const countExpr = joins.length
      ? `COUNT(DISTINCT ${primaryAlias}."id")`
      : 'COUNT(*)';
    const countSql = Prisma.sql`
      SELECT ${Prisma.raw(countExpr)} AS total
      FROM ${Prisma.raw(fromFragment)}
      WHERE ${whereClause}
    `;
    const countResult: any[] = await this.prisma.$queryRaw(countSql);
    const total = groupedCols.length ? 0 : Number(countResult[0]?.total ?? 0);

    // ── Data ──────────────────────────────────────────────────────────────
    const dataSql = Prisma.sql`
      SELECT ${Prisma.raw(selectParts.join(', '))}
      FROM ${Prisma.raw(fromFragment)}
      WHERE ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${Number(limit)} OFFSET ${offset}
    `;
    const rows: any[] = await this.prisma.$queryRaw(dataSql);
    const safeRows = rows.map(r => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) {
        out[k] = typeof v === 'bigint' ? Number(v) : v;
      }
      return out;
    });

    return {
      columns: cols
        .filter((c: any) => fields[c.columnName])
        .map((c: any) => ({ key: c.columnName, label: c.displayName, type: fields[c.columnName]?.type ?? 'string' })),
      rows: safeRows,
      total: groupedCols.length ? safeRows.length : total,
      page:  Number(page),
      limit: Number(limit),
    };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async export(id: string, format: ExportFormat): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const report = await this.findOne(id);
    const { columns, rows } = await this.executeReport(report, { page: 1, limit: 50000 });
    switch (format) {
      case ExportFormat.EXCEL: return this.toExcel(report, columns, rows);
      case ExportFormat.PDF:   return this.toPdf(report, columns, rows);
      case ExportFormat.WORD:  return this.toWord(report, columns, rows);
      default: throw new BadRequestException(`Unsupported format: ${format}`);
    }
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboard(actor?: { role?: string; agencyId?: string }) {
    const now              = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fwd60            = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    // Agency accounts are candidates-only: scope the applicant
    // aggregates to CANDIDATE tier and their own agency so the
    // dashboard can't reveal Lead counts or cross-agency data even
    // if reports:read is granted later.
    const isAgencyActor = actor?.role === 'Agency User' || actor?.role === 'Agency Manager';
    const applicantScope: any = { deletedAt: null };
    if (isAgencyActor) {
      applicantScope.tier = 'CANDIDATE';
      if (actor?.agencyId) applicantScope.agencyId = actor.agencyId;
    }

    const [
      totalEmp, activeEmp, empThisMonth,
      pendingApps, totalApp, appByStatus,
      expiringSoonCount, expiredUnrenewedCount,
      stageTemplates,
      avgDaysResult,
      approvedCount, decidedCount,
      recentEmployees,
      expiredDocsList,
      recentActivity,
    ] = await Promise.all([
      // ── Employees ──
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { deletedAt: null, createdAt: { gte: startOfThisMonth } } }),

      // ── Applicants ──
      // "Pending" = status NEW (submitted but no action taken yet)
      this.prisma.applicant.count({ where: { ...applicantScope, status: 'NEW' } }),
      this.prisma.applicant.count({ where: applicantScope }),
      this.prisma.applicant.groupBy({ by: ['status'], where: applicantScope, _count: { id: true } }),

      // ── Documents ──
      // Expiring soon: expiryDate in (now, +60 days] (excludes already expired)
      this.prisma.document.count({ where: { deletedAt: null, expiryDate: { not: null, lte: fwd60, gt: now } } }),
      // Expired and not yet renewed: expiryDate < now AND no renewal doc exists
      this.prisma.document.count({ where: { deletedAt: null, expiryDate: { lt: now }, renewals: { none: {} } } }),

      // ── Pipeline (StageTemplates with active EmployeeStage counts) ──
      this.prisma.stageTemplate.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { employeeStages: { where: { status: 'IN_PROGRESS' } } } },
        },
      }),

      // ── Avg processing days: average (completedAt - startedAt) across completed stages ──
      // Uses raw SQL because Prisma doesn't aggregate date diffs natively
      this.prisma.$queryRaw`
        SELECT COALESCE(
          AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) / 86400.0), 0
        )::float AS avg_days
        FROM employee_stages
        WHERE status = 'COMPLETED'
          AND "completedAt" IS NOT NULL
          AND "startedAt"   IS NOT NULL
      ` as Promise<{ avg_days: number }[]>,

      // ── Approval rate: approved / (approved + rejected) ──
      this.prisma.candidateStageApproval.count({ where: { decision: 'APPROVED' } }),
      this.prisma.candidateStageApproval.count({ where: { decision: { in: ['APPROVED', 'REJECTED'] } } }),

      // ── Recent employees: last 5 registrations ──
      this.prisma.employee.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, firstName: true, lastName: true,
          employeeNumber: true, status: true, createdAt: true, photoUrl: true,
        },
      }),

      // ── Expired documents (not yet renewed), latest 5 ──
      this.prisma.document.findMany({
        where: { deletedAt: null, expiryDate: { lt: now }, renewals: { none: {} } },
        orderBy: { expiryDate: 'asc' },
        take: 5,
        include: { documentType: { select: { name: true, code: true } } },
      }),

      // ── Recent activity from audit log, last 10 entries ──
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, entity: true, entityId: true, userEmail: true, createdAt: true },
      }),
    ]);

    // Batch-resolve owner names for expired documents
    const eIds = expiredDocsList.filter(d => d.entityType === 'EMPLOYEE').map(d => d.entityId);
    const aIds = expiredDocsList.filter(d => d.entityType === 'APPLICANT').map(d => d.entityId);
    const [docEmps, docApps] = await Promise.all([
      eIds.length ? this.prisma.employee.findMany({ where: { id: { in: eIds } }, select: { id: true, firstName: true, lastName: true } }) : [],
      aIds.length ? this.prisma.applicant.findMany({ where: { id: { in: aIds } }, select: { id: true, firstName: true, lastName: true } }) : [],
    ]);
    const empNameMap = Object.fromEntries(docEmps.map(e => [e.id, `${e.firstName} ${e.lastName}`]));
    const appNameMap = Object.fromEntries(docApps.map(a => [a.id, `${a.firstName} ${a.lastName}`]));

    const avgDays = avgDaysResult[0]?.avg_days
      ? parseFloat((avgDaysResult[0].avg_days as any).toFixed(1))
      : null;
    const approvalRate = decidedCount > 0
      ? parseFloat(((approvedCount / decidedCount) * 100).toFixed(1))
      : null;

    return {
      // Widget 1: Total Employees
      // Widget 2: Active Employees
      employees: {
        total:        totalEmp,
        active:       activeEmp,
        newThisMonth: empThisMonth,  // delta = employees added this calendar month
      },

      // Widget 3: Pending Applications
      // "Pending" defined as: applicant.status = 'NEW' (submitted, no action taken yet)
      applicants: {
        total:   totalApp,
        pending: pendingApps,
        byStatus: appByStatus.map(a => ({ status: a.status, count: (a._count as any).id })),
      },

      // Widget 4: Expiring Documents
      // Widget 8: Expired Documents (not yet renewed)
      documents: {
        // expiringSoon: expiryDate in (now, now+60d]; already-expired excluded
        expiringSoon:          expiringSoonCount,
        // expiredUnrenewed: expiryDate < now AND no renewal document exists
        expiredUnrenewedCount: expiredUnrenewedCount,
      },

      // Widget 5: Recruitment Pipeline
      // stages: StageTemplate list with IN_PROGRESS employee count
      // avgProcessingDays: mean calendar days across all COMPLETED employee stages
      // approvalRate: approved / (approved+rejected) × 100 across all candidate stage approvals
      pipeline: {
        stages: stageTemplates.map(st => ({
          id:       st.id,
          name:     st.name,
          order:    st.order,
          category: st.category,
          color:    st.color,
          count:    (st._count as any).employeeStages,
        })),
        avgProcessingDays: avgDays,
        approvalRate:      approvalRate,
      },

      // Widget 7: Recent Employees
      recentEmployees,

      // Widget 8: Expired Documents List
      expiredDocuments: expiredDocsList.map(doc => ({
        id:           doc.id,
        docId:        doc.docId,
        name:         doc.name,
        entityType:   doc.entityType,
        entityId:     doc.entityId,
        expiryDate:   doc.expiryDate,
        status:       doc.status,
        documentType: doc.documentType,
        ownerName:    doc.entityType === 'EMPLOYEE'
          ? (empNameMap[doc.entityId] ?? null)
          : (appNameMap[doc.entityId] ?? null),
      })),

      // Widget 6: Recent Activity Feed
      // Source: AuditLog — covers all UPLOAD/VERIFY/REJECT/CREATE/UPDATE/DELETE events
      recentActivity,
    };
  }

  // ── Excel ─────────────────────────────────────────────────────────────────

  private async toExcel(report: any, columns: any[], rows: any[]): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'TempWorks';
    wb.created = new Date();
    const ws = wb.addWorksheet(report.name.substring(0, 31));

    // Title (columns.length data cols + 1 serial col)
    const lastCol = String.fromCharCode(64 + Math.max(columns.length + 1, 2));
    ws.mergeCells(`A1:${lastCol}1`);
    const titleCell = ws.getCell('A1');
    titleCell.value = report.name;
    titleCell.font  = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center' };

    ws.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
    ws.getCell('A2').font  = { italic: true, size: 9, color: { argb: 'FF64748B' } };
    if (report.description) {
      ws.getCell('A3').value = report.description;
      ws.getCell('A3').font  = { size: 9, color: { argb: 'FF94A3B8' } };
    }

    // Header — first column is serial number
    const headerRow = ws.getRow(5);
    headerRow.height = 22;
    const noCell = headerRow.getCell(1);
    noCell.value = '#';
    noCell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    noCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    noCell.alignment = { horizontal: 'center', vertical: 'middle' };
    columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 2);
      cell.value = col.label;
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF1D4ED8' } } };
    });

    // Data
    rows.forEach((row, ri) => {
      const wsRow = ws.getRow(ri + 6);
      // Serial number cell
      const snCell = wsRow.getCell(1);
      snCell.value = ri + 1;
      snCell.alignment = { horizontal: 'center' };
      if (ri % 2 === 1) snCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      snCell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } }, right: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      // Data cells
      columns.forEach((col, ci) => {
        const cell = wsRow.getCell(ci + 2);
        cell.value = this.formatValue(row[col.key]);
        if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } }, right: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      });
    });

    ws.getColumn(1).width = 6; // # column
    columns.forEach((col, i) => {
      ws.getColumn(i + 2).width = Math.max(col.label.length + 4, 12);
    });

    const raw = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(raw as ArrayBuffer);
    return { buffer, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${this.safeFilename(report.name)}.xlsx` };
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  private toPdf(report: any, columns: any[], rows: any[]): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    return new Promise((resolve, reject) => {
      const doc    = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' } as any);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), mimeType: 'application/pdf', filename: `${this.safeFilename(report.name)}.pdf` }));
      doc.on('error', reject);

      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A').text(report.name, { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#64748B').text(`Generated: ${new Date().toLocaleString()}  |  ${rows.length} records`, { align: 'center' });
      if (report.description) doc.fontSize(9).fillColor('#94A3B8').text(report.description, { align: 'center' });
      doc.moveDown(0.6);

      const snW    = 24; // serial number column width
      const pageW  = (doc as any).page.width - 72 - snW;
      const colW   = Math.max(Math.floor(pageW / Math.max(columns.length, 1)), 55);
      const tblW   = snW + colW * columns.length;
      const startX = ((doc as any).page.width - tblW) / 2;
      const rowH   = 16;
      const hdrH   = 20;
      let y = (doc as any).y;

      // Header
      doc.rect(startX, y, tblW, hdrH).fill('#2563EB');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
      doc.text('#', startX + 3, y + 6, { width: snW - 6, ellipsis: true });
      columns.forEach((col, i) => {
        doc.text(col.label, startX + snW + i * colW + 3, y + 6, { width: colW - 6, ellipsis: true });
      });
      y += hdrH;

      // Rows
      doc.font('Helvetica').fontSize(7);
      rows.forEach((row, ri) => {
        if (y + rowH > (doc as any).page.height - 36) { doc.addPage(); y = 36; }
        if (ri % 2 === 0) doc.rect(startX, y, tblW, rowH).fill('#F8FAFC');
        doc.fillColor('#0F172A');
        doc.text(String(ri + 1), startX + 3, y + 4, { width: snW - 6, ellipsis: true });
        columns.forEach((col, i) => {
          doc.text(String(this.formatValue(row[col.key]) ?? ''), startX + snW + i * colW + 3, y + 4, { width: colW - 6, ellipsis: true });
        });
        doc.rect(startX, y, tblW, rowH).stroke('#E2E8F0');
        y += rowH;
      });

      doc.fillColor('#94A3B8').fontSize(8).text(`TempWorks — ${report.name}`, 36, (doc as any).page.height - 20, { align: 'center' });
      doc.end();
    });
  }

  // ── Word ──────────────────────────────────────────────────────────────────

  private async toWord(report: any, columns: any[], rows: any[]): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const snHeaderCell = new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF', size: 20 })], spacing: { before: 80, after: 80 } })],
      shading: { fill: '2563EB' },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
    });

    const headerCells = [
      snHeaderCell,
      ...columns.map(col =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: col.label, bold: true, color: 'FFFFFF', size: 20 })], spacing: { before: 80, after: 80 } })],
          shading: { fill: '2563EB' },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
        }),
      ),
    ];

    const dataRows = rows.map((row, ri) =>
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(ri + 1), size: 18 })], spacing: { before: 60, after: 60 } })],
            shading: ri % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
          }),
          ...columns.map(col =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: String(this.formatValue(row[col.key]) ?? ''), size: 18 })], spacing: { before: 60, after: 60 } })],
              shading: ri % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
            }),
          ),
        ],
      }),
    );

    const docObj = new Document({
      sections: [{
        children: [
          new Paragraph({ text: report.name, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}  |  ${rows.length} records`, color: '64748B', italics: true, size: 18 })] }),
          ...(report.description ? [new Paragraph({ children: [new TextRun({ text: report.description, color: '94A3B8', size: 18 })] })] : []),
          new Paragraph({ text: '' }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows] }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(docObj);
    return { buffer, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: `${this.safeFilename(report.name)}.docx` };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private castValue(raw: string, type: string): any {
    if (type === 'number')  return Number(raw);
    if (type === 'boolean') return raw === 'true';
    if (type === 'date')    return new Date(raw);
    return raw;
  }

  private formatValue(val: any): string | number | null {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) {
      return val.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  }

  private safeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 60) + `_${Date.now()}`;
  }
}
