import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { ConvertToEmployeeDto } from './dto/convert-to-employee.dto';
import { FilterApplicantsDto } from './dto/filter-applicants.dto';
import { UpsertFinancialProfileDto } from './dto/financial-profile.dto';
import { BulkActionDto, BulkActionType, AssignAgencyDto, ConvertLeadDto } from './dto/bulk-action.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class ApplicantsService {
  constructor(private prisma: PrismaService) {}

  private get include() {
    return {
      jobType: { select: { id: true, name: true } },
      agency: { select: { id: true, name: true } },
      currentWorkflowStage: { select: { id: true, name: true, color: true, order: true } },
    };
  }

  private get includeWithRelations() {
    return {
      ...this.include,
      financialProfile: true,
      agencyHistory: { orderBy: { assignedAt: 'desc' as const }, take: 50 },
    };
  }

  // ── List ──────────────────────────────────────────────────────────────────────

  async findAll(filter: FilterApplicantsDto, actor?: { role: string; agencyId?: string }) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc',
            tier, status, agencyId, nationality, jobTypeId } = filter;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };

    // Agency users can only see CANDIDATES (not LEADs)
    if (actor && this.isAgencyUser(actor.role)) {
      where.tier = 'CANDIDATE';
      // Agency users see only their own agency's applicants
      if (actor.agencyId) {
        where.agencyId = actor.agencyId;
      }
    } else {
      if (tier) where.tier = tier;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (agencyId && !this.isAgencyUser(actor?.role)) where.agencyId = agencyId;
    if (nationality) where.nationality = { contains: nationality, mode: 'insensitive' };
    if (jobTypeId) where.jobTypeId = jobTypeId;

    const validSort = ['firstName', 'lastName', 'email', 'status', 'tier', 'createdAt', 'nationality'];
    const orderField = validSort.includes(sortBy) ? sortBy : 'createdAt';

    const [items, total] = await Promise.all([
      this.prisma.applicant.findMany({
        where, skip, take: Number(limit),
        orderBy: { [orderField]: sortOrder },
        include: this.include,
      }),
      this.prisma.applicant.count({ where }),
    ]);

    return PaginatedResponse.create(items, total, page, limit);
  }

  // ── Find One ──────────────────────────────────────────────────────────────────

  async findOne(id: string, actor?: { role: string; agencyId?: string }) {
    const applicant = await this.prisma.applicant.findUnique({
      where: { id, deletedAt: null },
      include: this.includeWithRelations,
    });
    if (!applicant) throw new NotFoundException(`Applicant ${id} not found`);

    // Agency users can only see CANDIDATEs in their own agency
    if (actor && this.isAgencyUser(actor.role)) {
      if (applicant.tier === 'LEAD') throw new ForbiddenException('Access denied');
      if (actor.agencyId && applicant.agencyId && applicant.agencyId !== actor.agencyId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return applicant;
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async create(dto: CreateApplicantDto & { tier?: string }, actorId?: string) {
    const existing = await this.prisma.applicant.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Applicant with this email already exists');

    const applicant = await this.prisma.applicant.create({
      data: {
        ...dto,
        tier: (dto.tier as any) || 'LEAD',
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        workAuthorizationExpiry: dto.workAuthorizationExpiry ? new Date(dto.workAuthorizationExpiry) : undefined,
        preferredStartDate: dto.preferredStartDate ? new Date(dto.preferredStartDate) : undefined,
        status: dto.status || 'NEW',
      },
      include: this.include,
    });

    await this.auditLog(actorId, 'CREATE', applicant.id);

    return applicant;
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateApplicantDto, actorId?: string) {
    const existing = await this.findOne(id);
    if (dto.email && dto.email !== existing.email) {
      const dup = await this.prisma.applicant.findFirst({ where: { email: dto.email, NOT: { id } } });
      if (dup) throw new ConflictException('Email already in use');
    }
    const updateData: any = { ...dto };
    if (dto.dateOfBirth) updateData.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.workAuthorizationExpiry) updateData.workAuthorizationExpiry = new Date(dto.workAuthorizationExpiry);
    if (dto.preferredStartDate) updateData.preferredStartDate = new Date(dto.preferredStartDate);

    const applicant = await this.prisma.applicant.update({
      where: { id }, data: updateData, include: this.include,
    });
    await this.auditLog(actorId, 'UPDATE', id, dto as any);
    return applicant;
  }

  // ── Update Status ─────────────────────────────────────────────────────────────

  async updateStatus(id: string, status: string, actorId?: string) {
    await this.findOne(id);
    const applicant = await this.prisma.applicant.update({
      where: { id }, data: { status: status as any }, include: this.include,
    });
    await this.auditLog(actorId, 'STATUS_CHANGE', id, { status });
    return applicant;
  }

  // ── Remove ────────────────────────────────────────────────────────────────────

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.applicant.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditLog(actorId, 'DELETE', id);
    return { message: 'Applicant deleted' };
  }

  // ── Public Submit ─────────────────────────────────────────────────────────────

  async publicSubmit(dto: CreateApplicantDto & { applicationNotes?: string }) {
    const existing = await this.prisma.applicant.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An application with this email already exists');

    const { applicationNotes, applicationData, ...coreData } = dto as any;

    // Derive backward-compat fields from rich applicationData if present
    const appData = applicationData ?? {};
    const residencyStatus = coreData.residencyStatus
      || (appData.workPermit?.hasWorkPermit === 'yes' ? 'Work Permit'
        : appData.euResidence?.hasResidence === 'yes' ? 'EU Residence'
        : appData.euVisa?.hasVisa === 'yes' ? 'EU Visa'
        : 'Other');
    const availability = coreData.availability
      || appData.additionalInfo?.earliestStartDate
      || 'Immediate';

    // citizenship ↔ nationality: prefer citizenship, fallback to nationality
    const citizenship = coreData.citizenship || coreData.nationality || appData.personal?.citizenship;
    const nationality = coreData.nationality || citizenship;

    return this.prisma.applicant.create({
      data: {
        ...coreData,
        citizenship,
        nationality,
        tier: 'LEAD',
        status: 'NEW',
        residencyStatus,
        availability,
        hasDrivingLicense: coreData.hasDrivingLicense ?? (appData.drivingLicense?.hasDrivingLicense === 'yes'),
        dateOfBirth: coreData.dateOfBirth ? new Date(coreData.dateOfBirth) : undefined,
        workAuthorizationExpiry: coreData.workAuthorizationExpiry ? new Date(coreData.workAuthorizationExpiry) : undefined,
        preferredStartDate: (coreData.preferredStartDate || appData.additionalInfo?.earliestStartDate)
          ? new Date(coreData.preferredStartDate || appData.additionalInfo.earliestStartDate)
          : undefined,
        applicationData: appData,
        notes: coreData.notes || (applicationNotes ? `[Submitted] ${applicationNotes}` : undefined),
      },
      include: this.include,
    });
  }

  // ── Set Workflow Stage ────────────────────────────────────────────────────────

  async setCurrentStage(id: string, stageId: string | null, actorId?: string) {
    await this.findOne(id);
    if (stageId) {
      const stage = await this.prisma.workflowStage.findUnique({ where: { id: stageId } });
      if (!stage) throw new NotFoundException('Workflow stage not found');
    }
    const applicant = await this.prisma.applicant.update({
      where: { id },
      data: { currentWorkflowStageId: stageId },
      include: this.include,
    });
    await this.auditLog(actorId, 'WORKFLOW_STAGE_UPDATE', id, { currentWorkflowStageId: stageId });
    return applicant;
  }

  // ── Convert Lead → Candidate ──────────────────────────────────────────────────

  async convertLeadToCandidate(id: string, dto: ConvertLeadDto, actorId?: string) {
    const applicant = await this.findOne(id);
    if (applicant.tier === 'CANDIDATE') {
      throw new ConflictException('Applicant is already a Candidate');
    }

    // Resolve target agency: use provided agencyId, or system default, or keep existing
    let targetAgencyId: string | undefined = dto.agencyId ?? undefined;

    if (!targetAgencyId) {
      // Try to load default holding agency from SystemSetting
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'applicants.defaultHoldingAgencyId' },
      });
      if (setting?.value) targetAgencyId = setting.value;
    }

    const prevAgencyId = applicant.agencyId;
    const prevAgencyName = (applicant.agency as any)?.name ?? 'None';

    const updated = await this.prisma.applicant.update({
      where: { id },
      data: {
        tier: 'CANDIDATE',
        ...(targetAgencyId ? { agencyId: targetAgencyId } : {}),
      },
      include: this.includeWithRelations,
    });

    // Record agency history if agency changed
    if (targetAgencyId && targetAgencyId !== prevAgencyId) {
      const newAgency = await this.prisma.agency.findUnique({ where: { id: targetAgencyId } });
      // Close previous assignment
      if (prevAgencyId) {
        await this.prisma.applicantAgencyHistory.updateMany({
          where: { applicantId: id, removedAt: null },
          data: { removedAt: new Date() },
        });
      }
      // Open new assignment
      await this.prisma.applicantAgencyHistory.create({
        data: {
          id: this.uuid(),
          applicantId: id,
          agencyId: targetAgencyId,
          agencyName: newAgency?.name ?? 'Unknown',
          assignedById: actorId,
          reason: 'Lead converted to Candidate',
          notes: dto.notes,
        },
      });
    }

    await this.auditLog(actorId, 'CONVERT_LEAD_TO_CANDIDATE', id, {
      oldTier: 'LEAD', newTier: 'CANDIDATE',
      oldAgencyId: prevAgencyId, newAgencyId: targetAgencyId,
    });

    return updated;
  }

  // ── Reassign Agency ───────────────────────────────────────────────────────────

  async reassignAgency(id: string, dto: AssignAgencyDto, actorId?: string) {
    const applicant = await this.findOne(id);

    const newAgency = await this.prisma.agency.findUnique({ where: { id: dto.agencyId } });
    if (!newAgency) throw new NotFoundException('Agency not found');

    const prevAgencyId = applicant.agencyId;

    // Close previous open history entry
    if (prevAgencyId) {
      await this.prisma.applicantAgencyHistory.updateMany({
        where: { applicantId: id, removedAt: null },
        data: { removedAt: new Date() },
      });
    }

    // Record new assignment
    await this.prisma.applicantAgencyHistory.create({
      data: {
        id: this.uuid(),
        applicantId: id,
        agencyId: dto.agencyId,
        agencyName: newAgency.name,
        assignedById: actorId,
        reason: dto.reason,
        notes: dto.notes,
      },
    });

    const updated = await this.prisma.applicant.update({
      where: { id },
      data: { agencyId: dto.agencyId },
      include: this.includeWithRelations,
    });

    await this.auditLog(actorId, 'REASSIGN_AGENCY', id, {
      oldAgencyId: prevAgencyId, newAgencyId: dto.agencyId, reason: dto.reason,
    });

    return updated;
  }

  // ── Financial Profile ─────────────────────────────────────────────────────────

  async getFinancialProfile(id: string) {
    await this.findOne(id);
    const profile = await this.prisma.applicantFinancialProfile.findUnique({
      where: { applicantId: id },
    });
    return profile ?? null;
  }

  async upsertFinancialProfile(id: string, dto: UpsertFinancialProfileDto, actorId?: string) {
    const applicant = await this.findOne(id);
    if (applicant.tier !== 'CANDIDATE') {
      throw new ForbiddenException('Financial profile is only available for Candidates');
    }

    const data: any = { ...dto };
    if (dto.salaryAgreed !== undefined) data.salaryAgreed = dto.salaryAgreed;

    const profile = await this.prisma.applicantFinancialProfile.upsert({
      where: { applicantId: id },
      update: data,
      create: { id: this.uuid(), applicantId: id, ...data },
    });

    await this.auditLog(actorId, 'UPSERT_FINANCIAL_PROFILE', id, dto as any);
    return profile;
  }

  // ── Agency History ────────────────────────────────────────────────────────────

  async getAgencyHistory(id: string) {
    await this.findOne(id);
    return this.prisma.applicantAgencyHistory.findMany({
      where: { applicantId: id },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // ── Bulk Actions ──────────────────────────────────────────────────────────────

  async bulkAction(dto: BulkActionDto, actorId?: string) {
    const { ids, action, value } = dto;
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of ids) {
      try {
        switch (action) {
          case BulkActionType.STATUS_CHANGE:
            if (!value) throw new Error('value is required for STATUS_CHANGE');
            await this.prisma.applicant.update({ where: { id }, data: { status: value as any } });
            await this.auditLog(actorId, 'BULK_STATUS_CHANGE', id, { status: value });
            break;

          case BulkActionType.TIER_CHANGE:
            if (value !== 'LEAD' && value !== 'CANDIDATE') throw new Error('Invalid tier');
            await this.prisma.applicant.update({ where: { id }, data: { tier: value as any } });
            await this.auditLog(actorId, 'BULK_TIER_CHANGE', id, { tier: value });
            break;

          case BulkActionType.ASSIGN_AGENCY:
            if (!value) throw new Error('value (agencyId) is required for ASSIGN_AGENCY');
            await this.prisma.applicant.update({ where: { id }, data: { agencyId: value } });
            await this.auditLog(actorId, 'BULK_ASSIGN_AGENCY', id, { agencyId: value });
            break;

          case BulkActionType.DELETE:
            await this.prisma.applicant.update({ where: { id }, data: { deletedAt: new Date() } });
            await this.auditLog(actorId, 'BULK_DELETE', id);
            break;
        }
        results.push({ id, success: true });
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }

    return { processed: ids.length, results };
  }

  // ── CSV Export ────────────────────────────────────────────────────────────────

  async exportCsv(filter: FilterApplicantsDto, actor?: { role: string; agencyId?: string }): Promise<string> {
    // Fetch all matching records (no pagination limit)
    const bigFilter = { ...filter, limit: 10000, page: 1 };
    const result = await this.findAll(bigFilter as FilterApplicantsDto, actor);
    const items: any[] = result.data;

    const headers = [
      'ID', 'Tier', 'First Name', 'Last Name', 'Email', 'Phone', 'Nationality',
      'Status', 'Job Type', 'Agency', 'Residency Status', 'Has NI', 'NI Number',
      'Has Work Auth', 'Work Auth Type', 'Availability', 'Salary Expectation',
      'Preferred Start Date', 'Created At',
    ];

    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = items.map(a => [
      a.id, a.tier, a.firstName, a.lastName, a.email, a.phone, a.nationality,
      a.status, a.jobType?.name ?? '', a.agency?.name ?? '',
      a.residencyStatus, a.hasNationalInsurance, a.nationalInsuranceNumber ?? '',
      a.hasWorkAuthorization, a.workAuthorizationType ?? '',
      a.availability, a.salaryExpectation ?? '',
      a.preferredStartDate ? new Date(a.preferredStartDate).toISOString().split('T')[0] : '',
      new Date(a.createdAt).toISOString().split('T')[0],
    ].map(escape).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  // ── Convert Applicant → Employee ──────────────────────────────────────────────

  async convertToEmployee(id: string, dto: ConvertToEmployeeDto, actorId?: string) {
    const applicant = await this.findOne(id);

    if (applicant.tier !== 'CANDIDATE') {
      throw new ForbiddenException('Only Candidates can be converted to employees. Convert the Lead to a Candidate first.');
    }

    const existing = await this.prisma.employee.findFirst({
      where: { email: applicant.email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`An employee with email ${applicant.email} already exists`);
    }

    const stages = await this.prisma.workflowStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    // Generate employee number: E + YYYY + MM + 5-digit serial
    const employeeNumber = await this.generateEmployeeNumber();

    const employee = await this.prisma.employee.create({
      data: {
        employeeNumber,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        email: applicant.email,
        phone: applicant.phone,
        nationality: applicant.nationality,
        dateOfBirth: applicant.dateOfBirth ?? new Date('1990-01-01'),
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        country: dto.country,
        postalCode: dto.postalCode,
        licenseNumber: dto.licenseNumber,
        licenseCategory: dto.licenseCategory,
        yearsExperience: dto.yearsExperience ?? 0,
        emergencyContact: dto.emergencyContact,
        emergencyPhone: dto.emergencyPhone,
        notes: applicant.notes,
        status: 'ONBOARDING' as any,
        ...(applicant.agencyId ? { agencyId: applicant.agencyId } : {}),
        workflowStages: {
          create: stages.map((s: any) => ({ stageId: s.id, status: 'PENDING' })),
        },
      } as any,
      include: { agency: { select: { id: true, name: true } } },
    });

    // Re-assign documents from applicant to employee
    await this.prisma.document.updateMany({
      where: { entityType: 'APPLICANT', entityId: id, deletedAt: null },
      data: { entityType: 'EMPLOYEE', entityId: employee.id },
    });

    // Mark applicant as converted (soft delete + store employeeId)
    await this.prisma.applicant.update({
      where: { id },
      data: { deletedAt: new Date(), convertedToEmployeeId: employee.id },
    });

    await this.auditLog(actorId, 'CONVERT_TO_EMPLOYEE', id, {
      employeeId: employee.id, employeeNumber, email: applicant.email,
    });

    return { employee, employeeNumber, message: 'Applicant successfully converted to employee' };
  }

  // ── Private Helpers ───────────────────────────────────────────────────────────

  private isAgencyUser(role?: string): boolean {
    if (!role) return false;
    return role === 'Agency User' || role === 'Agency Manager';
  }

  private uuid(): string {
    return require('crypto').randomUUID();
  }

  private async auditLog(
    userId: string | undefined,
    action: string,
    entityId: string,
    changes?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { userId, action, entity: 'Applicant', entityId, changes: changes as any },
      });
    } catch {
      // Audit log must never crash the main flow
    }
  }

  private async generateEmployeeNumber(): Promise<string> {
    // Use a raw query to safely get the next serial number
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = String(now.getMonth() + 1).padStart(2, '0');

    const result: any[] = await this.prisma.$queryRaw`
      SELECT COALESCE(MAX(
        CAST(SUBSTRING("employeeNumber" FROM 8) AS INTEGER)
      ), 0) + 1 AS next_serial
      FROM employees
      WHERE "employeeNumber" IS NOT NULL
        AND "employeeNumber" LIKE ${'E' + yyyy + mm + '%'}
    `;

    const serial = result[0]?.next_serial ?? 1;
    return `E${yyyy}${mm}${String(serial).padStart(5, '0')}`;
  }
}
