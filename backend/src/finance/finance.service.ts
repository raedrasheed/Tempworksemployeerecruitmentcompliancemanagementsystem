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
import { StorageService } from '../common/storage/storage.service';
import * as ExcelJS from 'exceljs';

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
    private readonly storage: StorageService,
  ) {}

  // ── Prisma include helpers ───────────────────────────────────────────────────

  private get recordInclude() {
    return {
      paidByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy:  { select: { id: true, firstName: true, lastName: true, email: true } },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' as const } },
      // Oldest-first so the expanded panel reads chronologically.
      deductions: {
        orderBy: { deductionDate: 'asc' as const },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      },
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

  /** Configurable transaction types surfaced by the constants endpoint.
   *  The list lives in the DB (seeded once with the hardcoded defaults)
   *  so System Admins can manage it from Settings without a deploy. */
  async listTransactionTypes(): Promise<Array<{ id: string; name: string; sortOrder: number }>> {
    try {
      return await (this.prisma as any).financeTransactionType.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, sortOrder: true },
      });
    } catch {
      // Prisma client may not have been regenerated yet on first boot
      // of this feature — fall back to the hardcoded defaults rather
      // than blowing up the whole finance UI.
      return [];
    }
  }

  async findOne(id: string) {
    const record = await this.prisma.financialRecord.findUnique({
      where: { id, deletedAt: null },
      include: this.recordInclude,
    });
    if (!record) throw new NotFoundException(`Financial record ${id} not found`);
    return record;
  }

  /** Returns the full audit trail for a financial record — who did what
   *  (CREATE / UPDATE / STATUS / DEDUCTION_ADDED / DEDUCTION_REMOVED /
   *  ATTACHMENT_ADDED / ATTACHMENT_REMOVED / DELETE) and when. Used by
   *  the profile's ledger expand panel to show a change history. */
  async getHistory(id: string) {
    // Cheap existence check so we return 404 rather than an empty list
    // when the id is wrong.
    const record = await this.prisma.financialRecord.findUnique({
      where: { id }, select: { id: true },
    });
    if (!record) throw new NotFoundException(`Financial record ${id} not found`);

    const logs = await this.prisma.auditLog.findMany({
      where: { entity: 'FinancialRecord', entityId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return logs.map(l => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt,
      changes: l.changes,
      user: l.user
        ? {
            id: l.user.id,
            name: [l.user.firstName, l.user.lastName].filter(Boolean).join(' '),
            email: l.user.email,
          }
        : null,
      userEmail: l.userEmail,
    }));
  }

  async create(dto: CreateFinancialRecordDto, actorId?: string) {
    if (!['APPLICANT', 'EMPLOYEE', 'AGENCY'].includes(dto.entityType)) {
      throw new BadRequestException('entityType must be APPLICANT, EMPLOYEE or AGENCY');
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

    // Build a compact before/after diff so the history panel can show
    // exactly which fields the operator touched rather than the whole
    // submitted DTO (which may contain unchanged fields).
    const TRACKED = [
      'transactionDate', 'transactionType', 'description', 'currency',
      'paymentMethod', 'paidByName', 'companyDisbursedAmount',
      'employeeOrAgencyPaidAmount', 'notes',
    ] as const;
    const diff: Record<string, { from: any; to: any }> = {};
    for (const k of TRACKED) {
      const before = (existing as any)[k];
      const after = (dto as any)[k];
      if (after === undefined) continue;
      const norm = (v: any) => v instanceof Date ? v.toISOString() : v == null ? null : typeof v === 'object' ? JSON.stringify(v) : v;
      if (norm(before) !== norm(after)) diff[k] = { from: before ?? null, to: after ?? null };
    }
    await this.auditLog(actorId, 'FINANCIAL_RECORD_UPDATED', id, {
      changed: Object.keys(diff),
      diff,
    });

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

  // ── Deductions (partial + multi) ────────────────────────────────────────────
  // Each call appends a row to financial_record_deductions and keeps
  // the parent record's aggregate fields (deductionAmount / date /
  // payrollReference / status) in sync so legacy consumers that still
  // read them unchanged don't regress.

  async addDeduction(
    recordId: string,
    dto: { amount: number; deductionDate: string; payrollReference?: string; notes?: string },
    actorId?: string,
  ) {
    const record = await this.findOne(recordId);
    if ((record as any).deletedAt) throw new BadRequestException('Record is deleted');

    const amount = Number(dto.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Deduction amount must be a positive number');
    }

    const existingSum = (record as any).deductions?.reduce(
      (s: number, d: any) => s + Number(d.amount ?? 0),
      0,
    ) ?? Number(record.deductionAmount ?? 0);
    const disbursed = Number(record.companyDisbursedAmount);
    const newSum = existingSum + amount;
    if (newSum > disbursed) {
      throw new BadRequestException(
        `Deductions would exceed the disbursed amount (${disbursed.toFixed(2)}). Remaining: ${(disbursed - existingSum).toFixed(2)}.`,
      );
    }

    const deductionDate = new Date(dto.deductionDate);
    if (isNaN(deductionDate.getTime())) {
      throw new BadRequestException('Invalid deductionDate');
    }

    await (this.prisma as any).financialRecordDeduction.create({
      data: {
        financialRecordId: recordId,
        amount,
        deductionDate,
        payrollReference: dto.payrollReference ?? null,
        notes: dto.notes ?? null,
        createdById: actorId ?? null,
      },
    });

    // Status flips to DEDUCTED when the sum reaches the disbursed
    // amount (within rounding tolerance); otherwise PARTIAL so the
    // expanded panel can still show "Add another deduction".
    const nextStatus = Math.abs(newSum - disbursed) < 0.005 ? 'DEDUCTED' : 'PARTIAL';

    const updated = await this.prisma.financialRecord.update({
      where: { id: recordId },
      data: {
        deductionAmount: newSum,
        deductionDate,
        payrollReference: dto.payrollReference ?? record.payrollReference,
        status: nextStatus,
      },
      include: this.recordInclude,
    });

    await this.auditLog(actorId, 'FINANCIAL_RECORD_DEDUCTION_ADDED', recordId, {
      amount, deductionDate: dto.deductionDate, payrollReference: dto.payrollReference,
      runningTotal: newSum, nextStatus,
    });

    if (nextStatus === 'DEDUCTED') {
      const entityName = await this.resolveEntityNameForNotif(record.entityType, record.entityId);
      this.notifications.notifyUsersByRoles(
        FINANCE_ROLES,
        NOTIF_EVENTS.FINANCIAL_RECORD_DEDUCTED,
        'Record Fully Deducted',
        `A financial record for ${entityName} has been fully deducted (${record.currency} ${newSum.toFixed(2)}).`,
        record.entityType,
        record.entityId,
      ).catch(e => this.logger.error('Notification error (deduct):', e));
    }

    return updated;
  }

  async removeDeduction(deductionId: string, actorId?: string) {
    const deduction = await (this.prisma as any).financialRecordDeduction.findUnique({
      where: { id: deductionId },
    });
    if (!deduction) throw new NotFoundException('Deduction not found');

    const recordId: string = deduction.financialRecordId;
    await (this.prisma as any).financialRecordDeduction.delete({ where: { id: deductionId } });

    // Recompute aggregates from whatever remains.
    const remaining = await (this.prisma as any).financialRecordDeduction.findMany({
      where: { financialRecordId: recordId },
      orderBy: { deductionDate: 'desc' },
    });
    const newSum = remaining.reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0);
    const record = await this.prisma.financialRecord.findUnique({ where: { id: recordId } });
    const disbursed = Number(record?.companyDisbursedAmount ?? 0);
    const nextStatus = newSum === 0
      ? 'PENDING'
      : Math.abs(newSum - disbursed) < 0.005
        ? 'DEDUCTED'
        : 'PARTIAL';
    const latest = remaining[0];

    const updated = await this.prisma.financialRecord.update({
      where: { id: recordId },
      data: {
        deductionAmount: newSum > 0 ? newSum : null,
        deductionDate: latest?.deductionDate ?? null,
        payrollReference: latest?.payrollReference ?? null,
        status: nextStatus,
      },
      include: this.recordInclude,
    });

    await this.auditLog(actorId, 'FINANCIAL_RECORD_DEDUCTION_REMOVED', recordId, {
      removedAmount: Number(deduction.amount),
      runningTotal: newSum,
      nextStatus,
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

    const upload = await this.storage.uploadFile(file.buffer, {
      keyPrefix: `finance/${recordId}/attachments`,
      contentType: file.mimetype,
      originalName: file.originalname,
      inline: file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'),
    });

    const attachment = await this.prisma.financialRecordAttachment.create({
      data: {
        financialRecordId: recordId,
        name: file.originalname,
        fileUrl: upload.url,
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

    if ((att as any).fileUrl) {
      await this.storage.deleteFileByUrlOrKey((att as any).fileUrl);
    }

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

    // Column definitions — tuned for payroll accountant use. The
    // "deduction" columns are now summaries over the deductions[]
    // sidecar (total + count + last date/ref), with the full breakdown
    // living on a second "Deductions" sheet built below.
    sheet.columns = [
      { header: 'Record ID',                key: 'id',               width: 18 },
      { header: 'Name',                     key: 'entityName',       width: 24 },
      { header: 'Stage At Creation',        key: 'stageAtCreation',  width: 14 },
      { header: 'Entity Type',              key: 'entityType',       width: 12 },
      { header: 'Entity ID',               key: 'entityId',          width: 18 },
      { header: 'Transaction Date & Time',  key: 'transactionDate',  width: 22 },
      { header: 'Transaction Type',         key: 'transactionType',  width: 24 },
      { header: 'Description',             key: 'description',       width: 30 },
      { header: 'Currency',                key: 'currency',           width: 10 },
      { header: 'Company Disbursed (€)',   key: 'companyDisbursed',  width: 20 },
      { header: 'Employee/Agency Paid (€)',key: 'empAgency',         width: 22 },
      { header: 'Payment Method',          key: 'paymentMethod',     width: 16 },
      { header: 'Paid By',                 key: 'paidBy',            width: 20 },
      { header: 'Status',                  key: 'status',            width: 12 },
      { header: 'Total Deducted (€)',      key: 'deductionAmount',   width: 20 },
      { header: 'Remaining (€)',           key: 'remaining',         width: 16 },
      { header: 'Deductions #',            key: 'deductionCount',    width: 12 },
      { header: 'Last Deduction Date',     key: 'deductionDate',     width: 18 },
      { header: 'Last Payroll Ref',        key: 'payrollReference',  width: 20 },
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
      const deductions: any[] = Array.isArray(rec.deductions) ? rec.deductions : [];
      const totalDeducted = deductions.length > 0
        ? deductions.reduce((s, d) => s + Number(d.amount ?? 0), 0)
        : Number(rec.deductionAmount ?? 0);
      const remaining = Math.max(0, Number(rec.companyDisbursedAmount ?? 0) - totalDeducted);
      const lastDeduction = deductions.length > 0
        ? deductions.slice().sort(
            (a, b) => new Date(b.deductionDate).getTime() - new Date(a.deductionDate).getTime(),
          )[0]
        : null;

      const row = sheet.addRow({
        id:              rec.id,
        entityName:      rec.entityName ?? '',
        stageAtCreation: rec.stageAtCreation ?? '',
        entityType:      rec.entityType,
        entityId:        rec.entityId,
        transactionDate: rec.transactionDate
          ? `${new Date(rec.transactionDate).toLocaleDateString()} ${new Date(rec.transactionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : '',
        transactionType: rec.transactionType,
        description:     rec.description ?? '',
        currency:        rec.currency,
        companyDisbursed: Number(rec.companyDisbursedAmount ?? 0),
        empAgency:        Number(rec.employeeOrAgencyPaidAmount ?? 0),
        paymentMethod:   rec.paymentMethod ?? '',
        paidBy:          rec.paidByName ?? (rec.paidByUser ? `${rec.paidByUser.firstName} ${rec.paidByUser.lastName}` : ''),
        status:          rec.status,
        deductionAmount: totalDeducted > 0 ? totalDeducted : '',
        remaining:       remaining,
        deductionCount:  deductions.length,
        deductionDate:   lastDeduction?.deductionDate
          ? new Date(lastDeduction.deductionDate).toLocaleDateString()
          : rec.deductionDate ? new Date(rec.deductionDate).toLocaleDateString() : '',
        payrollReference: lastDeduction?.payrollReference ?? rec.payrollReference ?? '',
        notes:           rec.notes ?? '',
        createdAt:       new Date(rec.createdAt).toLocaleDateString(),
      });

      // Color by status — Partial gets its own shade so the sheet
      // visually matches the in-app status chips.
      const statusCell = row.getCell('status');
      if (rec.status === 'DEDUCTED') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        statusCell.font = { color: { argb: 'FF065F46' }, bold: true };
      } else if (rec.status === 'PARTIAL') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        statusCell.font = { color: { argb: 'FF1E40AF' }, bold: true };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        statusCell.font = { color: { argb: 'FF92400E' }, bold: true };
      }

      // Format currency columns
      ['companyDisbursed', 'empAgency', 'deductionAmount', 'remaining'].forEach((col) => {
        const cell = row.getCell(col);
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        }
      });
    }

    // Totals row (if there are records). Column letters map to the
    // new layout — J=companyDisbursed, K=empAgency, O=totalDeducted,
    // P=remaining. Keep them in sync if columns are reordered above.
    if (records.length > 0) {
      const dataStart = 2;
      const dataEnd   = records.length + 1;
      sheet.addRow({});  // spacer
      const totalsRow = sheet.addRow({
        id:              'TOTALS',
        companyDisbursed: { formula: `SUM(J${dataStart}:J${dataEnd})` },
        empAgency:        { formula: `SUM(K${dataStart}:K${dataEnd})` },
        deductionAmount:  { formula: `SUM(O${dataStart}:O${dataEnd})` },
        remaining:        { formula: `SUM(P${dataStart}:P${dataEnd})` },
      });
      totalsRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      });
      ['J', 'K', 'O', 'P'].forEach((col) => {
        const cell = totalsRow.getCell(col);
        cell.numFmt = '#,##0.00';
      });
    }

    // Auto-filter on header row
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: sheet.columnCount },
    };

    // ── Deductions sheet ─────────────────────────────────────────────────────
    // One line per partial deduction so finance can pivot / filter /
    // reconcile against payroll runs directly in Excel.
    const dedSheet = workbook.addWorksheet('Deductions', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    dedSheet.columns = [
      { header: 'Deduction ID',        key: 'id',                width: 38 },
      { header: 'Record ID',           key: 'recordId',          width: 38 },
      { header: 'Name',                key: 'entityName',        width: 24 },
      { header: 'Transaction Type',    key: 'transactionType',   width: 24 },
      { header: 'Transaction Desc',    key: 'description',       width: 30 },
      { header: 'Currency',            key: 'currency',          width: 10 },
      { header: 'Deduction Amount',    key: 'amount',            width: 18 },
      { header: 'Deduction Date',      key: 'deductionDate',     width: 16 },
      { header: 'Payroll Reference',   key: 'payrollReference',  width: 20 },
      { header: 'Notes',               key: 'notes',             width: 30 },
      { header: 'Logged By',           key: 'loggedBy',          width: 22 },
      { header: 'Logged At',           key: 'loggedAt',          width: 18 },
    ];
    dedSheet.getRow(1).eachCell((cell) => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border    = { bottom: { style: 'thin', color: { argb: 'FFB45309' } } };
    });
    dedSheet.getRow(1).height = 28;

    let dedCount = 0;
    for (const rec of records as any[]) {
      for (const d of (rec.deductions ?? []) as any[]) {
        const row = dedSheet.addRow({
          id:               d.id,
          recordId:         rec.id,
          entityName:       rec.entityName ?? '',
          transactionType:  rec.transactionType,
          description:      rec.description ?? '',
          currency:         rec.currency,
          amount:           Number(d.amount ?? 0),
          deductionDate:    d.deductionDate ? new Date(d.deductionDate).toLocaleDateString() : '',
          payrollReference: d.payrollReference ?? '',
          notes:            d.notes ?? '',
          loggedBy:         d.createdBy ? `${d.createdBy.firstName ?? ''} ${d.createdBy.lastName ?? ''}`.trim() : '',
          loggedAt:         d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '',
        });
        const amt = row.getCell('amount');
        amt.numFmt    = '#,##0.00';
        amt.alignment = { horizontal: 'right' };
        dedCount++;
      }
    }

    if (dedCount > 0) {
      const dataStart = 2;
      const dataEnd   = dedCount + 1;
      dedSheet.addRow({});
      const totalsRow = dedSheet.addRow({
        id:     'TOTAL',
        amount: { formula: `SUM(G${dataStart}:G${dataEnd})` },
      });
      totalsRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      });
      totalsRow.getCell('G').numFmt = '#,##0.00';
    } else {
      dedSheet.addRow({ id: 'No deductions recorded.' });
    }

    dedSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: dedSheet.columnCount },
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
    const agencyIds    = [...new Set(
      records.filter(r => r.entityType === 'AGENCY').map(r => r.entityId),
    )];

    const [applicants, employees, agencies] = await Promise.all([
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
      agencyIds.length
        ? this.prisma.agency.findMany({
            where: { id: { in: agencyIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const applicantMap = new Map<string, string>(applicants.map((a: any) => [a.id, `${a.firstName} ${a.lastName}`] as [string, string]));
    const employeeMap  = new Map<string, string>(employees.map((e: any)  => [e.id, `${e.firstName} ${e.lastName}`] as [string, string]));
    const agencyMap    = new Map<string, string>(agencies.map((g: any)   => [g.id, g.name] as [string, string]));

    return records.map(r => {
      let entityName = 'Unknown';
      if (r.entityType === 'APPLICANT') entityName = applicantMap.get(r.entityId) ?? 'Unknown Applicant';
      else if (r.entityType === 'EMPLOYEE') entityName = employeeMap.get(r.entityId) ?? 'Unknown Employee';
      else if (r.entityType === 'AGENCY') entityName = agencyMap.get(r.entityId) ?? 'Unknown Agency';
      return { ...r, entityName };
    });
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

    if (entityType === 'AGENCY') {
      // Agencies are not persons — no applicantId, no lifecycle stage.
      // Verify the agency exists so we don't orphan records on bad IDs.
      const ag = await this.prisma.agency.findUnique({
        where: { id: entityId },
        select: { id: true, deletedAt: true },
      });
      if (!ag || ag.deletedAt !== null) throw new NotFoundException(`Agency ${entityId} not found`);
      return { applicantId: null, stageAtCreation: 'AGENCY' };
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
      if (entityType === 'AGENCY') {
        const ag = await this.prisma.agency.findUnique({ where: { id: entityId }, select: { name: true } });
        return ag?.name ?? 'Unknown Agency';
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
