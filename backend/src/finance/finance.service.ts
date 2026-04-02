import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { UpdateFinancialRecordDto } from './dto/update-financial-record.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { FilterFinancialRecordsDto } from './dto/filter-financial-records.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';
import * as ExcelJS from 'exceljs';
import { join, extname } from 'path';
import { promises as fs } from 'fs';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  // ── Prisma include helpers ───────────────────────────────────────────────────

  private get recordInclude() {
    return {
      paidByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy:  { select: { id: true, firstName: true, lastName: true, email: true } },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' as const } },
    };
  }

  // ── List / Global View ───────────────────────────────────────────────────────

  async findAll(filter: FilterFinancialRecordsDto) {
    const {
      page = 1, limit = 20, entityType, entityId, search, status,
      transactionType, currency, dateFrom, dateTo,
      sortBy = 'transactionDate', sortOrder = 'desc',
    } = filter as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };
    if (entityType) where.entityType = entityType;
    if (entityId)   where.entityId   = entityId;
    if (status)     where.status     = status;
    if (transactionType) where.transactionType = transactionType;
    if (currency)   where.currency   = currency;
    if (dateFrom || dateTo) {
      where.transactionDate = {};
      if (dateFrom) where.transactionDate.gte = new Date(dateFrom);
      if (dateTo)   where.transactionDate.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { description:      { contains: search, mode: 'insensitive' } },
        { payrollReference: { contains: search, mode: 'insensitive' } },
        { paidByName:       { contains: search, mode: 'insensitive' } },
        { notes:            { contains: search, mode: 'insensitive' } },
      ];
    }

    const validSort = [
      'transactionDate', 'companyDisbursedAmount', 'status',
      'transactionType', 'currency', 'createdAt',
    ];
    const orderField = validSort.includes(sortBy) ? sortBy : 'transactionDate';

    const [items, total] = await Promise.all([
      this.prisma.financialRecord.findMany({
        where, skip, take: Number(limit),
        orderBy: { [orderField]: sortOrder },
        include: this.recordInclude,
      }),
      this.prisma.financialRecord.count({ where }),
    ]);

    return PaginatedResponse.create(items, total, page, limit);
  }

  // ── Totals for one person ────────────────────────────────────────────────────

  /**
   * Balance calculation rules:
   *   totalDisbursed  = SUM(companyDisbursedAmount)
   *   totalDeducted   = SUM(deductionAmount WHERE deductionAmount IS NOT NULL)
   *   currentBalance  = totalDisbursed − totalDeducted
   *
   * employeeOrAgencyPaidAmount is NOT included in any balance figure —
   * it is informational/reconciliation data only.
   */
  async getTotals(entityType: string, entityId: string) {
    const agg = await this.prisma.financialRecord.aggregate({
      where: { entityType, entityId, deletedAt: null },
      _sum: {
        companyDisbursedAmount:     true,
        employeeOrAgencyPaidAmount: true,
        deductionAmount:            true,
      },
      _count: { id: true },
    });

    const totalDisbursed  = Number(agg._sum.companyDisbursedAmount     ?? 0);
    const totalDeducted   = Number(agg._sum.deductionAmount            ?? 0);
    const totalEmpAgency  = Number(agg._sum.employeeOrAgencyPaidAmount ?? 0);
    const currentBalance  = totalDisbursed - totalDeducted;
    const recordCount     = agg._count.id;

    return { totalDisbursed, totalDeducted, currentBalance, totalEmpAgency, recordCount };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const record = await this.prisma.financialRecord.findUnique({
      where: { id, deletedAt: null },
      include: this.recordInclude,
    });
    if (!record) throw new NotFoundException(`Financial record ${id} not found`);
    return record;
  }

  async create(dto: CreateFinancialRecordDto, actorId?: string) {
    if (!['APPLICANT', 'EMPLOYEE'].includes(dto.entityType)) {
      throw new BadRequestException('entityType must be APPLICANT or EMPLOYEE');
    }

    // Verify entity exists
    await this.resolveEntityName(dto.entityType, dto.entityId);

    const record = await this.prisma.financialRecord.create({
      data: {
        entityType:                 dto.entityType,
        entityId:                   dto.entityId,
        transactionDate:            new Date(dto.transactionDate),
        currency:                   dto.currency ?? 'EUR',
        transactionType:            dto.transactionType,
        description:                dto.description,
        paymentMethod:              dto.paymentMethod,
        paidByName:                 dto.paidByName,
        paidById:                   dto.paidById,
        companyDisbursedAmount:     dto.companyDisbursedAmount,
        employeeOrAgencyPaidAmount: dto.employeeOrAgencyPaidAmount ?? 0,
        status:                     'PENDING',
        notes:                      dto.notes,
        createdById:                actorId,
      },
      include: this.recordInclude,
    });

    await this.auditLog(actorId, 'FINANCIAL_RECORD_CREATED', record.id, {
      entityType: dto.entityType, entityId: dto.entityId,
      transactionType: dto.transactionType,
      companyDisbursedAmount: dto.companyDisbursedAmount,
    });

    return record;
  }

  async update(id: string, dto: UpdateFinancialRecordDto, actorId?: string) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.transactionDate) data.transactionDate = new Date(dto.transactionDate);

    const updated = await this.prisma.financialRecord.update({
      where: { id }, data, include: this.recordInclude,
    });

    await this.auditLog(actorId, 'FINANCIAL_RECORD_UPDATED', id, dto as any);
    return updated;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.financialRecord.update({
      where: { id }, data: { deletedAt: new Date() },
    });
    await this.auditLog(actorId, 'FINANCIAL_RECORD_DELETED', id);
    return { message: 'Financial record deleted' };
  }

  // ── Status / Deduction ───────────────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateStatusDto, actorId?: string) {
    const record = await this.findOne(id);

    // Validation: DEDUCTED requires a deductionAmount
    if (dto.status === 'DEDUCTED') {
      const deductionAmt = dto.deductionAmount ?? Number(record.deductionAmount ?? 0);
      if (deductionAmt <= 0) {
        throw new BadRequestException(
          'A positive deductionAmount is required when marking a record as DEDUCTED',
        );
      }
      if (deductionAmt > Number(record.companyDisbursedAmount)) {
        throw new BadRequestException(
          'deductionAmount cannot exceed companyDisbursedAmount',
        );
      }
    }

    const data: any = { status: dto.status };
    if (dto.deductionAmount !== undefined) data.deductionAmount = dto.deductionAmount;
    if (dto.deductionDate)    data.deductionDate    = new Date(dto.deductionDate);
    if (dto.payrollReference) data.payrollReference = dto.payrollReference;

    const updated = await this.prisma.financialRecord.update({
      where: { id }, data, include: this.recordInclude,
    });

    await this.auditLog(actorId, 'FINANCIAL_RECORD_STATUS_CHANGED', id, {
      oldStatus: record.status, newStatus: dto.status,
      deductionAmount: dto.deductionAmount,
      deductionDate: dto.deductionDate,
      payrollReference: dto.payrollReference,
    });

    return updated;
  }

  // ── Attachments ──────────────────────────────────────────────────────────────

  async addAttachment(
    recordId: string,
    file: Express.Multer.File,
    uploadedById?: string,
  ) {
    await this.findOne(recordId);

    const ts = Date.now();
    const ext = extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folder = join(file.destination, 'financial', recordId);
    const filename = `${ts}_${safeName}${ext === safeName.slice(-ext.length) ? '' : ext}`;

    await fs.mkdir(folder, { recursive: true });
    await fs.rename(file.path, join(folder, filename));

    const fileUrl = `/uploads/financial/${recordId}/${filename}`;

    const attachment = await this.prisma.financialRecordAttachment.create({
      data: {
        financialRecordId: recordId,
        name: file.originalname,
        fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedById,
      },
    });

    await this.auditLog(uploadedById, 'FINANCIAL_ATTACHMENT_ADDED', recordId, {
      attachmentId: attachment.id, name: file.originalname,
    });

    return attachment;
  }

  async removeAttachment(
    recordId: string,
    attachmentId: string,
    actorId?: string,
  ) {
    await this.findOne(recordId);
    const att = await this.prisma.financialRecordAttachment.findFirst({
      where: { id: attachmentId, financialRecordId: recordId, deletedAt: null },
    });
    if (!att) throw new NotFoundException('Attachment not found');

    await this.prisma.financialRecordAttachment.update({
      where: { id: attachmentId }, data: { deletedAt: new Date() },
    });

    await this.auditLog(actorId, 'FINANCIAL_ATTACHMENT_REMOVED', recordId, {
      attachmentId, name: att.name,
    });

    return { message: 'Attachment removed' };
  }

  // ── Excel Export ─────────────────────────────────────────────────────────────

  async exportExcel(filter: FilterFinancialRecordsDto): Promise<Buffer> {
    // Fetch all matching records (no pagination)
    const { data: records } = (await this.findAll({
      ...filter, limit: 100000, page: 1,
    } as any)) as any;

    const workbook  = new ExcelJS.Workbook();
    workbook.creator  = 'TempWorks Finance Module';
    workbook.created  = new Date();

    const sheet = workbook.addWorksheet('Financial Records', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Column definitions — tuned for payroll accountant use
    sheet.columns = [
      { header: 'Record ID',                key: 'id',               width: 18 },
      { header: 'Entity Type',              key: 'entityType',       width: 12 },
      { header: 'Entity ID',               key: 'entityId',          width: 18 },
      { header: 'Transaction Date',         key: 'transactionDate',  width: 16 },
      { header: 'Transaction Type',         key: 'transactionType',  width: 24 },
      { header: 'Description',             key: 'description',       width: 30 },
      { header: 'Currency',                key: 'currency',           width: 10 },
      { header: 'Company Disbursed (€)',   key: 'companyDisbursed',  width: 20 },
      { header: 'Employee/Agency Paid (€)',key: 'empAgency',         width: 22 },
      { header: 'Payment Method',          key: 'paymentMethod',     width: 16 },
      { header: 'Paid By',                 key: 'paidBy',            width: 20 },
      { header: 'Status',                  key: 'status',            width: 12 },
      { header: 'Deduction Amount (€)',    key: 'deductionAmount',   width: 20 },
      { header: 'Deduction Date',          key: 'deductionDate',     width: 16 },
      { header: 'Payroll Reference',       key: 'payrollReference',  width: 20 },
      { header: 'Notes',                   key: 'notes',             width: 30 },
      { header: 'Created At',             key: 'createdAt',          width: 16 },
    ];

    // Header styling
    sheet.getRow(1).eachCell((cell) => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border    = {
        bottom: { style: 'thin', color: { argb: 'FF1D4ED8' } },
      };
    });
    sheet.getRow(1).height = 32;

    // Data rows
    for (const rec of records as any[]) {
      const row = sheet.addRow({
        id:              rec.id,
        entityType:      rec.entityType,
        entityId:        rec.entityId,
        transactionDate: rec.transactionDate ? new Date(rec.transactionDate).toLocaleDateString() : '',
        transactionType: rec.transactionType,
        description:     rec.description ?? '',
        currency:        rec.currency,
        companyDisbursed: Number(rec.companyDisbursedAmount ?? 0),
        empAgency:        Number(rec.employeeOrAgencyPaidAmount ?? 0),
        paymentMethod:   rec.paymentMethod ?? '',
        paidBy:          rec.paidByName ?? (rec.paidByUser ? `${rec.paidByUser.firstName} ${rec.paidByUser.lastName}` : ''),
        status:          rec.status,
        deductionAmount: rec.deductionAmount != null ? Number(rec.deductionAmount) : '',
        deductionDate:   rec.deductionDate ? new Date(rec.deductionDate).toLocaleDateString() : '',
        payrollReference: rec.payrollReference ?? '',
        notes:           rec.notes ?? '',
        createdAt:       new Date(rec.createdAt).toLocaleDateString(),
      });

      // Color by status
      const statusCell = row.getCell('status');
      if (rec.status === 'DEDUCTED') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        statusCell.font = { color: { argb: 'FF065F46' }, bold: true };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        statusCell.font = { color: { argb: 'FF92400E' }, bold: true };
      }

      // Format currency columns
      ['companyDisbursed', 'empAgency', 'deductionAmount'].forEach((col) => {
        const cell = row.getCell(col);
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        }
      });
    }

    // Totals row (if there are records)
    if (records.length > 0) {
      const dataStart = 2;
      const dataEnd   = records.length + 1;
      sheet.addRow({});  // spacer
      const totalsRow = sheet.addRow({
        id:              'TOTALS',
        companyDisbursed: { formula: `SUM(H${dataStart}:H${dataEnd})` },
        empAgency:        { formula: `SUM(I${dataStart}:I${dataEnd})` },
        deductionAmount:  { formula: `SUM(M${dataStart}:M${dataEnd})` },
      });
      totalsRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      });
      ['H', 'I', 'M'].forEach((col) => {
        const cell = totalsRow.getCell(col);
        cell.numFmt = '#,##0.00';
      });
    }

    // Auto-filter on header row
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: sheet.columnCount },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ── Entity resolution ────────────────────────────────────────────────────────

  private async resolveEntityName(entityType: string, entityId: string): Promise<string> {
    if (entityType === 'APPLICANT') {
      const a = await this.prisma.applicant.findUnique({
        where: { id: entityId, deletedAt: null },
        select: { firstName: true, lastName: true },
      });
      if (!a) throw new NotFoundException(`Applicant ${entityId} not found`);
      return `${a.firstName} ${a.lastName}`;
    }
    if (entityType === 'EMPLOYEE') {
      const e = await this.prisma.employee.findUnique({
        where: { id: entityId, deletedAt: null },
        select: { firstName: true, lastName: true },
      });
      if (!e) throw new NotFoundException(`Employee ${entityId} not found`);
      return `${e.firstName} ${e.lastName}`;
    }
    throw new BadRequestException('Invalid entityType');
  }

  // ── Audit ────────────────────────────────────────────────────────────────────

  private async auditLog(
    userId: string | undefined,
    action: string,
    entityId: string,
    changes?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity: 'FinancialRecord',
          entityId,
          changes: changes as any,
        },
      });
    } catch {
      // Audit must never crash main flow
    }
  }
}
