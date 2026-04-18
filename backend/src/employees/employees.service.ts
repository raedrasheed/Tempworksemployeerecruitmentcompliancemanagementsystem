import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';
import { promises as fs } from 'fs';
import { join, extname } from 'path';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  /**
   * External tenant = user attached to any agency that is not the
   * Tempworks root (`isSystem=true`). Such users are scoped to their
   * own agency regardless of their role name, so an HR Manager in an
   * external agency is treated the same as an Agency Manager.
   */
  private isExternalActor(actor?: { agencyId?: string; agencyIsSystem?: boolean }): boolean {
    return !!actor && !!actor.agencyId && actor.agencyIsSystem !== true;
  }

  async findAll(
    query: PaginationDto & { agencyId?: string; status?: string; nationality?: string; driversOnly?: boolean },
    actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean },
  ) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc', agencyId, status, nationality, driversOnly } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };

    // External tenants — every role inside a non-system agency — can
    // only see employees granted via EmployeeAgencyAccess with
    // canView=true. Employee.agencyId (origin) is intentionally
    // ignored. Tempworks-root users (isSystem=true) and System Admin
    // keep the global view.
    if (this.isExternalActor(actor)) {
      const grants = await this.prisma.employeeAgencyAccess.findMany({
        where: { agencyId: actor!.agencyId!, canView: true },
        select: { employeeId: true },
      });
      const allowedIds = grants.map(g => g.employeeId);
      if (allowedIds.length === 0) {
        return PaginatedResponse.create([], 0, page, limit);
      }
      where.id = { in: allowedIds };
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { licenseNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (agencyId) where.agencyId = agencyId;
    if (status) where.status = status;
    if (nationality) where.nationality = { contains: nationality, mode: 'insensitive' };
    if (driversOnly) {
      // Include employees who have a licence field OR any job type assigned
      // (job type covers cases like "Flatbed Driver" with no licence yet entered)
      where.OR = [
        ...(where.OR ?? []),
        { licenseNumber:  { not: null } },
        { licenseCategory: { not: null } },
        { jobTypeId:      { not: null } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where, skip, take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          agency:   { select: { id: true, name: true } },
          jobType:  { select: { id: true, name: true } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return PaginatedResponse.create(data, total, page, limit);
  }

  async findOne(
    id: string,
    actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean },
    opts?: { require?: 'view' | 'edit' },
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: {
        agency:   true,
        jobType:  { select: { id: true, name: true } },
        employeeStages: { include: { stage: true, assignedTo: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { stage: { order: 'asc' } } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (this.isExternalActor(actor)) {
      const grant = await this.prisma.employeeAgencyAccess.findUnique({
        where: { employeeId_agencyId: { employeeId: id, agencyId: actor!.agencyId! } },
      });
      if (!grant) throw new ForbiddenException('Access to this employee has not been granted to your agency');
      const need = opts?.require ?? 'view';
      if (need === 'view' && !grant.canView) {
        throw new ForbiddenException('View access to this employee has not been granted to your agency');
      }
      if (need === 'edit' && !grant.canEdit) {
        throw new ForbiddenException('Edit access to this employee has not been granted to your agency');
      }
    }

    return employee;
  }

  // ── Per-employee agency access grants (admin-only) ──────────────────────────

  async listAgencyAccess(employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.employeeAgencyAccess.findMany({
      where: { employeeId },
      include: { agency: { select: { id: true, name: true } } },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async grantAgencyAccess(
    employeeId: string,
    agencyId: string,
    dto: { notes?: string; canView?: boolean; canEdit?: boolean } = {},
    actorId?: string,
  ) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found');
    const agency = await this.prisma.agency.findFirst({ where: { id: agencyId, deletedAt: null } });
    if (!agency) throw new NotFoundException('Agency not found');
    const canView = dto.canView ?? true;
    const canEdit = dto.canEdit ?? true;
    // If the caller sets both flags to false we delete the row instead
    // of persisting a useless "no access" grant — keeps the table tidy
    // and makes revoke from the UI symmetric with delete.
    if (!canView && !canEdit) {
      await this.prisma.employeeAgencyAccess.deleteMany({
        where: { employeeId, agencyId },
      });
      return { employeeId, agencyId, canView: false, canEdit: false, deleted: true };
    }
    const grant = await this.prisma.employeeAgencyAccess.upsert({
      where:  { employeeId_agencyId: { employeeId, agencyId } },
      create: { employeeId, agencyId, notes: dto.notes, grantedById: actorId, canView, canEdit },
      update: { notes: dto.notes, grantedById: actorId, grantedAt: new Date(), canView, canEdit },
    });
    return grant;
  }

  async updateAgencyAccess(
    employeeId: string,
    agencyId: string,
    dto: { canView?: boolean; canEdit?: boolean; notes?: string },
    actorId?: string,
  ) {
    const existing = await this.prisma.employeeAgencyAccess.findUnique({
      where: { employeeId_agencyId: { employeeId, agencyId } },
    });
    if (!existing) throw new NotFoundException('No grant for that employee/agency pair');
    const canView = dto.canView ?? existing.canView;
    const canEdit = dto.canEdit ?? existing.canEdit;
    if (!canView && !canEdit) {
      await this.prisma.employeeAgencyAccess.delete({
        where: { employeeId_agencyId: { employeeId, agencyId } },
      });
      return { employeeId, agencyId, canView: false, canEdit: false, deleted: true };
    }
    return this.prisma.employeeAgencyAccess.update({
      where: { employeeId_agencyId: { employeeId, agencyId } },
      data: {
        canView, canEdit,
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        grantedById: actorId,
      },
    });
  }

  async revokeAgencyAccess(employeeId: string, agencyId: string) {
    try {
      await this.prisma.employeeAgencyAccess.delete({
        where: { employeeId_agencyId: { employeeId, agencyId } },
      });
    } catch {
      throw new NotFoundException('No grant for that employee/agency pair');
    }
    return { message: 'Access revoked' };
  }

  async create(dto: CreateEmployeeDto, _actorId?: string) {
    const existing = await this.prisma.employee.findFirst({ where: { email: dto.email, deletedAt: null } });
    if (existing) throw new ConflictException('Employee with this email already exists');

    // Get all workflow stages to initialize
    const stages = await this.prisma.stageTemplate.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });

    const employeeNumber = await this.generateEmployeeNumber();
    const { agencyId, ...rest } = dto;
    const employee = await this.prisma.employee.create({
      data: {
        ...rest,
        employeeNumber,
        dateOfBirth: new Date(dto.dateOfBirth),
        status: (dto.status as any) || 'PENDING',
        ...(agencyId ? { agencyId } : {}),
        employeeStages: {
          create: stages.map((stage) => ({
            stageId: stage.id,
            status: 'PENDING',
          })),
        },
      } as any,
      include: { agency: { select: { id: true, name: true } } },
    });

    return employee;
  }

  private async generateEmployeeNumber(): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `E${yyyy}${mm}`;

    const result: any[] = await this.prisma.$queryRaw`
      SELECT COALESCE(MAX(
        CAST(SUBSTRING("employeeNumber" FROM 8) AS INTEGER)
      ), 0) + 1 AS next_serial
      FROM employees
      WHERE "employeeNumber" IS NOT NULL
        AND "employeeNumber" LIKE ${prefix + '%'}
    `;

    const serial = result[0]?.next_serial ?? 1;
    return `${prefix}${String(serial).padStart(5, '0')}`;
  }

  async update(
    id: string,
    dto: Partial<CreateEmployeeDto>,
    _actorId?: string,
    actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean },
  ) {
    // Edit path: external tenants need a grant with canEdit=true.
    await this.findOne(id, actor, { require: 'edit' });
    const data: any = { ...dto };
    if (dto.dateOfBirth) data.dateOfBirth = new Date(dto.dateOfBirth);
    return this.prisma.employee.update({ where: { id }, data, include: { agency: { select: { id: true, name: true } } } });
  }

  async uploadPhoto(id: string, file: Express.Multer.File) {
    const employee = await this.prisma.employee.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
    if (!employee) throw new NotFoundException('Employee not found');
    const safeName  = `${employee.firstName}_${employee.lastName}`.replace(/[^a-zA-Z0-9\-]/g, '_').replace(/_+/g, '_');
    const shortId   = id.replace(/-/g, '');
    const folderName = `${safeName}_${shortId}`;
    const photoDir  = join(file.destination, folderName, 'photo');
    await fs.mkdir(photoDir, { recursive: true });
    const newFilename = `photo_${Date.now()}${extname(file.originalname)}`;
    await fs.rename(file.path, join(photoDir, newFilename));
    const photoUrl = `/uploads/${folderName}/photo/${newFilename}`;
    return this.prisma.employee.update({ where: { id }, data: { photoUrl }, include: { agency: { select: { id: true, name: true } } } });
  }

  /**
   * Get the banking/salary profile for a converted employee.
   * Looks up the ApplicantFinancialProfile via the employeeId link
   * that is set during Candidate→Employee conversion.
   * Returns null if the employee was not converted from an applicant
   * or if no financial profile was created at the candidate stage.
   */
  async getFinancialProfile(id: string) {
    await this.findOne(id);
    const profile = await (this.prisma as any).applicantFinancialProfile.findUnique({
      where: { employeeId: id },
    });
    return profile ?? null;
  }

  async remove(id: string, _actorId?: string, actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean }) {
    await this.findOne(id, actor, { require: 'edit' });
    await this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Employee deleted successfully' };
  }

  async updateStatus(id: string, status: string, _actorId?: string, actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean }) {
    await this.findOne(id, actor, { require: 'edit' });
    return this.prisma.employee.update({ where: { id }, data: { status: status as any } });
  }

  async getDocuments(id: string) {
    await this.findOne(id);
    return this.prisma.document.findMany({
      where: { entityType: 'EMPLOYEE', entityId: id, deletedAt: null },
      include: { documentType: true, uploadedBy: { select: { firstName: true, lastName: true } }, verifiedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkflow(id: string) {
    await this.findOne(id);
    return this.prisma.employeeStage.findMany({
      where: { employeeId: id },
      include: { stage: true, assignedTo: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { stage: { order: 'asc' } },
    });
  }

  async getCompliance(id: string) {
    await this.findOne(id);
    const [docs, alerts] = await Promise.all([
      this.prisma.document.findMany({ where: { entityType: 'EMPLOYEE', entityId: id, deletedAt: null }, include: { documentType: true } }),
      this.prisma.complianceAlert.findMany({ where: { entityType: 'EMPLOYEE', entityId: id }, orderBy: { severity: 'desc' } }),
    ]);
    return { documents: docs, alerts };
  }

  async getCertifications(id: string) {
    await this.findOne(id);
    return this.prisma.document.findMany({
      where: { entityType: 'EMPLOYEE', entityId: id, deletedAt: null, documentType: { category: 'certification' } },
      include: { documentType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTraining(id: string) {
    await this.findOne(id);
    const stages = await this.prisma.employeeStage.findMany({
      where: { employeeId: id, stage: { category: 'TRAINING' } },
      include: { stage: true },
    });
    return stages;
  }

  async getPerformance(id: string) {
    const employee = await this.findOne(id);
    const completedStages = await this.prisma.employeeStage.count({
      where: { employeeId: id, status: 'COMPLETED' },
    });
    const totalStages = await this.prisma.employeeStage.count({ where: { employeeId: id } });
    const validDocs = await this.prisma.document.count({ where: { entityType: 'EMPLOYEE', entityId: id, status: 'VERIFIED', deletedAt: null } });
    const totalDocs = await this.prisma.document.count({ where: { entityType: 'EMPLOYEE', entityId: id, deletedAt: null } });

    return {
      employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName },
      workflowCompletion: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
      documentCompliance: totalDocs > 0 ? Math.round((validDocs / totalDocs) * 100) : 0,
      completedStages,
      totalStages,
      validDocuments: validDocs,
      totalDocuments: totalDocs,
    };
  }
}
