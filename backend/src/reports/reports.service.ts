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

// ─── Field Whitelist ─────────────────────────────────────────────────────────

const DATA_SOURCE_FIELDS: Record<string, Record<string, { dbCol: string; type: string; label: string }>> = {
  employees: {
    id:              { dbCol: 'id',               type: 'string', label: 'ID' },
    firstName:       { dbCol: 'first_name',       type: 'string', label: 'First Name' },
    lastName:        { dbCol: 'last_name',        type: 'string', label: 'Last Name' },
    email:           { dbCol: 'email',            type: 'string', label: 'Email' },
    phone:           { dbCol: 'phone',            type: 'string', label: 'Phone' },
    nationality:     { dbCol: 'nationality',      type: 'string', label: 'Nationality' },
    status:          { dbCol: 'status',           type: 'enum',   label: 'Status' },
    dateOfBirth:     { dbCol: 'date_of_birth',    type: 'date',   label: 'Date of Birth' },
    licenseNumber:   { dbCol: 'license_number',   type: 'string', label: 'License No.' },
    licenseCategory: { dbCol: 'license_category', type: 'string', label: 'License Category' },
    yearsExperience: { dbCol: 'years_experience', type: 'number', label: 'Years Exp.' },
    city:            { dbCol: 'city',             type: 'string', label: 'City' },
    country:         { dbCol: 'country',          type: 'string', label: 'Country' },
    createdAt:       { dbCol: 'created_at',       type: 'date',   label: 'Created At' },
  },
  applicants: {
    id:                   { dbCol: 'id',                      type: 'string',  label: 'ID' },
    firstName:            { dbCol: 'first_name',              type: 'string',  label: 'First Name' },
    lastName:             { dbCol: 'last_name',               type: 'string',  label: 'Last Name' },
    email:                { dbCol: 'email',                   type: 'string',  label: 'Email' },
    phone:                { dbCol: 'phone',                   type: 'string',  label: 'Phone' },
    nationality:          { dbCol: 'nationality',             type: 'string',  label: 'Nationality' },
    status:               { dbCol: 'status',                  type: 'enum',    label: 'Status' },
    residencyStatus:      { dbCol: 'residency_status',        type: 'string',  label: 'Residency' },
    hasWorkAuthorization: { dbCol: 'has_work_authorization',  type: 'boolean', label: 'Work Auth' },
    availability:         { dbCol: 'availability',            type: 'string',  label: 'Availability' },
    salaryExpectation:    { dbCol: 'salary_expectation',      type: 'string',  label: 'Salary Exp.' },
    willingToRelocate:    { dbCol: 'willing_to_relocate',     type: 'boolean', label: 'Relocate' },
    createdAt:            { dbCol: 'created_at',              type: 'date',    label: 'Created At' },
  },
  documents: {
    id:             { dbCol: 'id',              type: 'string', label: 'ID' },
    name:           { dbCol: 'name',            type: 'string', label: 'Name' },
    entityType:     { dbCol: 'entity_type',     type: 'enum',   label: 'Entity Type' },
    status:         { dbCol: 'status',          type: 'enum',   label: 'Status' },
    fileSize:       { dbCol: 'file_size',       type: 'number', label: 'Size (bytes)' },
    issueDate:      { dbCol: 'issue_date',      type: 'date',   label: 'Issue Date' },
    expiryDate:     { dbCol: 'expiry_date',     type: 'date',   label: 'Expiry Date' },
    issuer:         { dbCol: 'issuer',          type: 'string', label: 'Issuer' },
    documentNumber: { dbCol: 'document_number', type: 'string', label: 'Doc No.' },
    createdAt:      { dbCol: 'created_at',      type: 'date',   label: 'Created At' },
  },
  compliance_alerts: {
    id:         { dbCol: 'id',          type: 'string', label: 'ID' },
    entityType: { dbCol: 'entity_type', type: 'enum',   label: 'Entity Type' },
    alertType:  { dbCol: 'alert_type',  type: 'string', label: 'Alert Type' },
    severity:   { dbCol: 'severity',    type: 'enum',   label: 'Severity' },
    message:    { dbCol: 'message',     type: 'string', label: 'Message' },
    status:     { dbCol: 'status',      type: 'enum',   label: 'Status' },
    dueDate:    { dbCol: 'due_date',    type: 'date',   label: 'Due Date' },
    createdAt:  { dbCol: 'created_at',  type: 'date',   label: 'Created At' },
  },
  agencies: {
    id:            { dbCol: 'id',             type: 'string', label: 'ID' },
    name:          { dbCol: 'name',           type: 'string', label: 'Name' },
    country:       { dbCol: 'country',        type: 'string', label: 'Country' },
    contactPerson: { dbCol: 'contact_person', type: 'string', label: 'Contact' },
    email:         { dbCol: 'email',          type: 'string', label: 'Email' },
    phone:         { dbCol: 'phone',          type: 'string', label: 'Phone' },
    status:        { dbCol: 'status',         type: 'enum',   label: 'Status' },
    createdAt:     { dbCol: 'created_at',     type: 'date',   label: 'Created At' },
  },
  work_permits: {
    id:              { dbCol: 'id',               type: 'string', label: 'ID' },
    permitType:      { dbCol: 'permit_type',      type: 'string', label: 'Permit Type' },
    status:          { dbCol: 'status',           type: 'enum',   label: 'Status' },
    permitNumber:    { dbCol: 'permit_number',    type: 'string', label: 'Permit No.' },
    applicationDate: { dbCol: 'application_date', type: 'date',   label: 'Applied' },
    approvalDate:    { dbCol: 'approval_date',    type: 'date',   label: 'Approved' },
    expiryDate:      { dbCol: 'expiry_date',      type: 'date',   label: 'Expiry' },
    createdAt:       { dbCol: 'created_at',       type: 'date',   label: 'Created At' },
  },
};

const TABLE_MAP: Record<string, string> = {
  employees:         'employees',
  applicants:        'applicants',
  documents:         'documents',
  compliance_alerts: 'compliance_alerts',
  agencies:          'agencies',
  work_permits:      'work_permits',
};

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ── Schema introspection ─────────────────────────────────────────────────

  getDataSources() {
    return Object.entries(DATA_SOURCE_FIELDS).map(([key, fields]) => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      fields: Object.entries(fields).map(([f, meta]) => ({
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
    if (!DATA_SOURCE_FIELDS[source]) throw new BadRequestException(`Unknown data source: ${source}`);

    const fieldMeta = DATA_SOURCE_FIELDS[source];
    const table     = TABLE_MAP[source];

    // ── Column selection ─────────────────────────────────────────────────
    const cols: any[] = report.columns.length
      ? report.columns
      : Object.entries(fieldMeta).map(([k, v]) => ({ columnName: k, displayName: (v as any).label, isAggregated: false, aggregationType: null, isGrouped: false }));

    const selectParts: string[] = [];
    for (const col of cols) {
      const meta = fieldMeta[col.columnName];
      if (!meta) continue;
      const dbCol = `"${meta.dbCol}"`;
      if (col.isAggregated && col.aggregationType) {
        selectParts.push(`${col.aggregationType}(${dbCol}) AS "${col.columnName}"`);
      } else {
        selectParts.push(`${dbCol} AS "${col.columnName}"`);
      }
    }
    if (selectParts.length === 0) selectParts.push('*');

    // ── WHERE clause ─────────────────────────────────────────────────────
    const conditions: Prisma.Sql[] = [Prisma.sql`"deleted_at" IS NULL`];

    for (const filter of (report.filters as any[])) {
      const meta = fieldMeta[filter.fieldName];
      if (!meta) continue; // whitelist: skip unknown fields

      const col    = Prisma.raw(`"${meta.dbCol}"`);
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

    const whereClause = Prisma.join(conditions, ' AND ');

    // ── GROUP BY ──────────────────────────────────────────────────────────
    const groupedCols = cols.filter((c: any) => c.isGrouped && fieldMeta[c.columnName]);
    const groupByClause = groupedCols.length
      ? Prisma.sql`GROUP BY ${Prisma.join(groupedCols.map((c: any) => Prisma.raw(`"${fieldMeta[c.columnName].dbCol}"`)), ', ')}`
      : Prisma.empty;

    // ── ORDER BY ──────────────────────────────────────────────────────────
    const sortParts = (report.sorting as any[])
      .filter((s: any) => fieldMeta[s.columnName])
      .map((s: any) => Prisma.raw(`"${fieldMeta[s.columnName].dbCol}" ${s.direction === 'DESC' ? 'DESC' : 'ASC'}`));
    const orderByClause = sortParts.length
      ? Prisma.sql`ORDER BY ${Prisma.join(sortParts, ', ')}`
      : Prisma.sql`ORDER BY "created_at" DESC`;

    // ── Count ─────────────────────────────────────────────────────────────
    const offset = (Number(page) - 1) * Number(limit);
    const countSql = Prisma.sql`SELECT COUNT(*) AS total FROM "${Prisma.raw(table)}" WHERE ${whereClause}`;
    const countResult: any[] = await this.prisma.$queryRaw(countSql);
    const total = groupedCols.length ? 0 : Number(countResult[0]?.total ?? 0);

    // ── Data ──────────────────────────────────────────────────────────────
    const dataSql = Prisma.sql`
      SELECT ${Prisma.raw(selectParts.join(', '))}
      FROM "${Prisma.raw(table)}"
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
        .filter((c: any) => fieldMeta[c.columnName])
        .map((c: any) => ({ key: c.columnName, label: c.displayName, type: fieldMeta[c.columnName]?.type ?? 'string' })),
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

  async getDashboard() {
    const now   = new Date();
    const ago30 = new Date(now); ago30.setDate(ago30.getDate() - 30);
    const fwd30 = new Date(now); fwd30.setDate(fwd30.getDate() + 30);

    const [
      totalEmp, activeEmp, newEmp, empByStatus,
      totalApp, newApp, appByStatus,
      openAlerts, critAlerts, expiringDocs,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { deletedAt: null, createdAt: { gte: ago30 } } }),
      this.prisma.employee.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { id: true } }),
      this.prisma.applicant.count({ where: { deletedAt: null } }),
      this.prisma.applicant.count({ where: { deletedAt: null, createdAt: { gte: ago30 } } }),
      this.prisma.applicant.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { id: true } }),
      this.prisma.complianceAlert.count({ where: { status: 'OPEN' } }),
      this.prisma.complianceAlert.count({ where: { status: 'OPEN', severity: 'CRITICAL' } }),
      this.prisma.document.count({ where: { deletedAt: null, expiryDate: { not: null, lte: fwd30, gte: now } } }),
    ]);

    return {
      employees:  { total: totalEmp, active: activeEmp, newThisMonth: newEmp, byStatus: empByStatus.map(e => ({ status: e.status, count: e._count.id })) },
      applicants: { total: totalApp, newThisMonth: newApp, byStatus: appByStatus.map(a => ({ status: a.status, count: a._count.id })) },
      compliance: { openAlerts, criticalAlerts: critAlerts, expiringDocuments: expiringDocs },
    };
  }

  // ── Excel ─────────────────────────────────────────────────────────────────

  private async toExcel(report: any, columns: any[], rows: any[]): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'TempWorks';
    wb.created = new Date();
    const ws = wb.addWorksheet(report.name.substring(0, 31));

    // Title
    const lastCol = String.fromCharCode(64 + Math.max(columns.length, 1));
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

    // Header
    const headerRow = ws.getRow(5);
    headerRow.height = 22;
    columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.label;
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF1D4ED8' } } };
    });

    // Data
    rows.forEach((row, ri) => {
      const wsRow = ws.getRow(ri + 6);
      columns.forEach((col, ci) => {
        const cell = wsRow.getCell(ci + 1);
        cell.value = this.formatValue(row[col.key]);
        if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } }, right: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      });
    });

    columns.forEach((col, i) => {
      ws.getColumn(i + 1).width = Math.max(col.label.length + 4, 12);
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

      const pageW  = (doc as any).page.width - 72;
      const colW   = Math.max(Math.floor(pageW / Math.max(columns.length, 1)), 55);
      const tblW   = colW * columns.length;
      const startX = ((doc as any).page.width - tblW) / 2;
      const rowH   = 16;
      const hdrH   = 20;
      let y = (doc as any).y;

      // Header
      doc.rect(startX, y, tblW, hdrH).fill('#2563EB');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
      columns.forEach((col, i) => {
        doc.text(col.label, startX + i * colW + 3, y + 6, { width: colW - 6, ellipsis: true });
      });
      y += hdrH;

      // Rows
      doc.font('Helvetica').fontSize(7);
      rows.forEach((row, ri) => {
        if (y + rowH > (doc as any).page.height - 36) { doc.addPage(); y = 36; }
        if (ri % 2 === 0) doc.rect(startX, y, tblW, rowH).fill('#F8FAFC');
        doc.fillColor('#0F172A');
        columns.forEach((col, i) => {
          doc.text(String(this.formatValue(row[col.key]) ?? ''), startX + i * colW + 3, y + 4, { width: colW - 6, ellipsis: true });
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
    const headerCells = columns.map(col =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: col.label, bold: true, color: 'FFFFFF', size: 20 })], spacing: { before: 80, after: 80 } })],
        shading: { fill: '2563EB' },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
    );

    const dataRows = rows.map((row, ri) =>
      new TableRow({
        children: columns.map(col =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(this.formatValue(row[col.key]) ?? ''), size: 18 })], spacing: { before: 60, after: 60 } })],
            shading: ri % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
          }),
        ),
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
    if (val instanceof Date) return val.toLocaleDateString();
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  }

  private safeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 60) + `_${Date.now()}`;
  }
}
