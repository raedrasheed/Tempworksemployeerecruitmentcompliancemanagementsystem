import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIF_EVENTS } from '../notifications/notification-events';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { UpdateFinancialRecordDto } from './dto/update-financial-record.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { FilterFinancialRecordsDto } from './dto/filter-financial-records.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';
import * as ExcelJS from 'exceljs';
import { join, extname } from 'path';
import { promises as fs } from 'fs';

// Roles that receive financial notifications
const FINANCE_ROLES = ['System Admin', 'Finance', 'HR Manager'];
// High-balance threshold in EUR (also check SystemSetting key 'notifications.highBalanceThreshold')
const DEFAULT_HIGH_BALANCE_THRESHOLD = 500;

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

    // Attach entity (applicant / employee) name to each record so the
    // global dashboard can show who the disbursement belongs to.
    const enriched = await this.attachEntityNames(items);

    return PaginatedResponse.create(enriched, total, page, limit);
  }

  // ── Totals for one entity (current stage) ───────────────────────────────────

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

  // ── All records + totals for a person across ALL lifecycle stages ────────────

  /**
   * Returns all financial records for a person identified by their stable
   * applicantId, regardless of which stage they are at now.
   *
   * This is the correct cross-lifecycle view: it works whether the person
   * is still a Lead/Candidate (entityType=APPLICANT) or has been converted
   * to an Employee (entityType=EMPLOYEE, applicantId still set).
   *
   * Also returns the ApplicantFinancialProfile (banking/salary details) so
   * the Employee profile can display it after conversion.
   */
  async getPersonRecords(applicantId: string) {
    // Resolve applicant (include soft-deleted so converted persons are found)
    const applicant = await this.prisma.applicant.findUnique({
      where: { id: applicantId },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        tier: true, deletedAt: true, convertedToEmployeeId: true,
        leadNumber: true, candidateNumber: true,
        financialProfile: true,
      },
    });
    if (!applicant) throw new NotFoundException(`Applicant ${applicantId} not found`);

    // Resolve linked employee if converted
    let employee: any = null;
    if (applicant.convertedToEmployeeId) {
      employee = await this.prisma.employee.findUnique({
        where: { id: applicant.convertedToEmployeeId },
        select: {
          id: true, firstName: true, lastName: true, email: true,
          employeeNumber: true, status: true,
        },
      });
    }

    // All financial records across all stages for this person
    const records = await this.prisma.financialRecord.findMany({
      where: {
        applicantId,
        deletedAt: null,
      },
      orderBy: { transactionDate: 'desc' },
      include: this.recordInclude,
    });

    // Aggregate totals across all stages
    const agg = await this.prisma.financialRecord.aggregate({
      where: { applicantId, deletedAt: null },
      _sum: {
        companyDisbursedAmount:     true,
        employeeOrAgencyPaidAmount: true,
        deductionAmount:            true,
      },
      _count: { id: true },
    });

    const totalDisbursed = Number(agg._sum.companyDisbursedAmount     ?? 0);
    const totalDeducted  = Number(agg._sum.deductionAmount            ?? 0);
    const totalEmpAgency = Number(agg._sum.employeeOrAgencyPaidAmount ?? 0);
    const currentBalance = totalDisbursed - totalDeducted;

    // Stage breakdown for reporting
    const byStage = records.reduce((acc: Record<string, number>, r: any) => {
      const stage = r.stageAtCreation ?? 'UNKNOWN';
      acc[stage] = (acc[stage] ?? 0) + 1;
      return acc;
    }, {});

    return {
      applicant: {
        id: applicant.id,
        name: `${applicant.firstName} ${applicant.lastName}`,
        email: applicant.email,
        tier: applicant.tier,
        isConverted: !!applicant.convertedToEmployeeId,
        leadNumber: applicant.leadNumber,
        candidateNumber: applicant.candidateNumber,
      },
      employee: employee ? {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        employeeNumber: employee.employeeNumber,
        status: employee.status,
      } : null,
      financialProfile: applicant.financialProfile ?? null,
      records,
      totals: {
        totalDisbursed, totalDeducted, currentBalance, totalEmpAgency,
        recordCount: agg._count.id,
        byStage,
      },
    };
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

    // Verify entity exists and resolve stable applicantId + stageAtCreation
    const { applicantId, stageAtCreation } =
      await this.resolvePersonIdentity(dto.entityType, dto.entityId);

    const record = await this.prisma.financialRecord.create({
      data: {
        entityType:                 dto.entityType,
        entityId:                   dto.entityId,
        applicantId,
        stageAtCreation,
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
      applicantId, stageAtCreation,
      transactionType: dto.transactionType,
      companyDisbursedAmount: dto.companyDisbursedAmount,
    });

    // ── Notification ─────────────────────────────────────────────────────────
    const entityName = await this.resolveEntityNameForNotif(dto.entityType, dto.entityId);
    this.notifications.notifyUsersByRoles(
      FINANCE_ROLES,
      NOTIF_EVENTS.FINANCIAL_RECORD_CREATED,
      'New Financial Record Added',
      `A new financial record was added for ${entityName}: ${dto.transactionType}` +
        (dto.companyDisbursedAmount ? ` — ${dto.currency ?? 'EUR'} ${dto.companyDisbursedAmount}` : ''),
      dto.entityType,
      dto.entityId,
    ).catch(e => this.logger.error('Notification error (create):', e));

    // Check high balance after creation
    this.checkAndNotifyHighBalance(dto.entityType, dto.entityId).catch(
      e => this.logger.error('High balance check error:', e),
    );

    return record;
  }

  async update(id: string, dto: UpdateFinancialRecordDto, actorId?: string) {
    const existing = await this.findOne(id);
    const data: any = { ...dto };
    if (dto.transactionDate) data.transactionDate = new Date(dto.transactionDate);

    const updated = await this.prisma.financialRecord.update({
      where: { id }, data, include: this.recordInclude,
    });

    await this.auditLog(actorId, 'FINANCIAL_RECORD_UPDATED', id, dto as any);

    // ── Notification ─────────────────────────────────────────────────────────
    const entityName = await this.resolveEntityNameForNotif(existing.entityType, existing.entityId);
    this.notifications.notifyUsersByRoles(
      FINANCE_ROLES,
      NOTIF_EVENTS.FINANCIAL_RECORD_UPDATED,
      'Financial Record Updated',
      `A financial record was updated for ${entityName}.`,
      existing.entityType,
      existing.entityId,
    ).catch(e => this.logger.error('Notification error (update):', e));

    return updated;
  }

  async remove(id: string, actorId?: string) {
    const existing = await this.findOne(id);
    await this.prisma.financialRecord.update({
      where: { id }, data: { deletedAt: new Date() },
    });
    await this.auditLog(actorId, 'FINANCIAL_RECORD_DELETED', id);

    // ── Notification ─────────────────────────────────────────────────────────
    const entityName = await this.resolveEntityNameForNotif(existing.entityType, existing.entityId);
    this.notifications.notifyUsersByRoles(
      FINANCE_ROLES,
      NOTIF_EVENTS.FINANCIAL_RECORD_DELETED,
      'Financial Record Deleted',
      `A financial record was deleted for ${entityName}.`,
      existing.entityType,
      existing.entityId,
    ).catch(e => this.logger.error('Notification error (delete):', e));

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

    // ── Notification ─────────────────────────────────────────────────────────
    if (dto.status === 'DEDUCTED') {
      const entityName = await this.resolveEntityNameForNotif(record.entityType, record.entityId);
      const amount = dto.deductionAmount ?? record.companyDisbursedAmount;
      this.notifications.notifyUsersByRoles(
        FINANCE_ROLES,
        NOTIF_EVENTS.FINANCIAL_RECORD_DEDUCTED,
        'Record Marked for Deduction',
        `A financial record for ${entityName} has been marked as deducted` +
          (amount ? ` (${record.currency} ${amount})` : '') + '.',
        record.entityType,
        record.entityId,
      ).catch(e => this.logger.error('Notification error (deduct):', e));
    }

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
      { header: 'Name',                     key: 'entityName',       width: 24 },
      { header: 'Stage At Creation',        key: 'stageAtCreation',  width: 14 },
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
        entityName:      rec.entityName ?? '',
        stageAtCreation: rec.stageAtCreation ?? '',
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
        companyDisbursed: { formula: `SUM(J${dataStart}:J${dataEnd})` },
        empAgency:        { formula: `SUM(K${dataStart}:K${dataEnd})` },
        deductionAmount:  { formula: `SUM(O${dataStart}:O${dataEnd})` },
      });
      totalsRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      });
      ['J', 'K', 'O'].forEach((col) => {
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

  /**
   * Batch-resolve entity names for a list of records.
   * Groups IDs by entityType → one query per type → merges back.
   * Includes soft-deleted applicants so names still resolve after conversion.
   */
  private async attachEntityNames(records: any[]): Promise<any[]> {
    const applicantIds = [...new Set(
      records.filter(r => r.entityType === 'APPLICANT').map(r => r.entityId),
    )];
    const employeeIds  = [...new Set(
      records.filter(r => r.entityType === 'EMPLOYEE').map(r => r.entityId),
    )];

    const [applicants, employees] = await Promise.all([
      applicantIds.length
        // Include soft-deleted: after conversion the applicant is soft-deleted
        // but the name must still resolve for historical records
        ? this.prisma.applicant.findMany({
            where: { id: { in: applicantIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [],
      employeeIds.length
        ? this.prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [],
    ]);

    const applicantMap = new Map<string, string>(applicants.map((a: any) => [a.id, `${a.firstName} ${a.lastName}`] as [string, string]));
    const employeeMap  = new Map<string, string>(employees.map((e: any)  => [e.id, `${e.firstName} ${e.lastName}`] as [string, string]));

    return records.map(r => ({
      ...r,
      entityName: r.entityType === 'APPLICANT'
        ? (applicantMap.get(r.entityId) ?? 'Unknown Applicant')
        : (employeeMap.get(r.entityId)  ?? 'Unknown Employee'),
    }));
  }

  /**
   * Resolve the stable person identity for a new financial record.
   *
   * For APPLICANT entities: applicantId = entityId, stageAtCreation from tier.
   * For EMPLOYEE entities: resolve back to the originating applicant.
   *
   * Also validates the entity exists (throws NotFoundException if not).
   * NOTE: Does NOT filter by deletedAt — converted applicants are soft-deleted
   * but remain the stable person reference.
   */
  private async resolvePersonIdentity(
    entityType: string,
    entityId: string,
  ): Promise<{ applicantId: string | null; stageAtCreation: string }> {
    if (entityType === 'APPLICANT') {
      const a = await this.prisma.applicant.findUnique({
        where: { id: entityId },
        select: { firstName: true, lastName: true, tier: true, deletedAt: true },
      });
      if (!a || (a.deletedAt !== null))
        throw new NotFoundException(`Applicant ${entityId} not found or has been converted`);
      const stageAtCreation = (a.tier as string) === 'LEAD' ? 'LEAD' : 'CANDIDATE';
      return { applicantId: entityId, stageAtCreation };
    }

    if (entityType === 'EMPLOYEE') {
      const e = await this.prisma.employee.findUnique({
        where: { id: entityId, deletedAt: null },
        select: { firstName: true, lastName: true },
      });
      if (!e) throw new NotFoundException(`Employee ${entityId} not found`);

      // Try to find the originating applicant via convertedToEmployeeId
      const originApplicant = await this.prisma.applicant.findFirst({
        where: { convertedToEmployeeId: entityId },
        select: { id: true },
      });

      return {
        applicantId: originApplicant?.id ?? null,
        stageAtCreation: 'EMPLOYEE',
      };
    }

    throw new BadRequestException('Invalid entityType');
  }

  // ── Notification helpers ──────────────────────────────────────────────────────

  /** Resolve a short entity name for notification messages. */
  private async resolveEntityNameForNotif(entityType: string, entityId: string): Promise<string> {
    try {
      if (entityType === 'APPLICANT') {
        const a = await this.prisma.applicant.findUnique({ where: { id: entityId }, select: { firstName: true, lastName: true } });
        return a ? `${a.firstName} ${a.lastName}` : 'Unknown';
      }
      if (entityType === 'EMPLOYEE') {
        const e = await this.prisma.employee.findUnique({ where: { id: entityId }, select: { firstName: true, lastName: true } });
        return e ? `${e.firstName} ${e.lastName}` : 'Unknown';
      }
    } catch { /* ignore */ }
    return 'Unknown';
  }

  /**
   * Check if the current balance for an entity exceeds the high-balance threshold.
   * Fires FINANCIAL_HIGH_BALANCE notification if it does and no alert was sent in the last 24h.
   *
   * Threshold is read from SystemSetting 'notifications.highBalanceThreshold' (value in EUR).
   * Falls back to DEFAULT_HIGH_BALANCE_THRESHOLD (500 EUR).
   *
   * Spam prevention: only one alert per entity per 24 hours.
   */
  private async checkAndNotifyHighBalance(entityType: string, entityId: string): Promise<void> {
    const totals = await this.getTotals(entityType, entityId);
    if (totals.currentBalance <= 0) return;

    // Read threshold from system settings (if configured)
    let threshold = DEFAULT_HIGH_BALANCE_THRESHOLD;
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'notifications.highBalanceThreshold' },
        select: { value: true },
      });
      if (setting) threshold = parseFloat(setting.value) || DEFAULT_HIGH_BALANCE_THRESHOLD;
    } catch { /* use default */ }

    if (totals.currentBalance < threshold) return;

    // Spam guard
    const alreadySent = await this.notifications.wasHighBalanceAlertRecentlySent(entityId);
    if (alreadySent) return;

    const entityName = await this.resolveEntityNameForNotif(entityType, entityId);
    await this.notifications.notifyUsersByRoles(
      FINANCE_ROLES,
      NOTIF_EVENTS.FINANCIAL_HIGH_BALANCE,
      'High Balance Alert',
      `Outstanding balance for ${entityName} has reached ${totals.currentBalance.toFixed(2)} EUR` +
        ` (threshold: ${threshold} EUR).`,
      entityType,
      entityId,
    );
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
