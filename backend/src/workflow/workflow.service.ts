import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { CreateVisaDto } from './dto/create-visa.dto';
import { UpdateWorkflowStageDto } from './dto/update-workflow-stage.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  async getStages() {
    return this.prisma.stageTemplate.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { _count: { select: { employeeStages: true } } },
    });
  }

  async getOverview() {
    const stages = await this.prisma.stageTemplate.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    const overview = await Promise.all(
      stages.map(async (stage) => {
        const [pending, inProgress, completed, applicantsCount] = await Promise.all([
          this.prisma.employeeStage.count({ where: { stageId: stage.id, status: 'PENDING' } }),
          this.prisma.employeeStage.count({ where: { stageId: stage.id, status: 'IN_PROGRESS' } }),
          this.prisma.employeeStage.count({ where: { stageId: stage.id, status: 'COMPLETED' } }),
          this.prisma.applicant.count({ where: { currentWorkflowStageId: stage.id, deletedAt: null } }),
        ]);
        return {
          ...stage,
          pending,
          inProgress: inProgress + applicantsCount,
          completed,
          total: pending + inProgress + completed,
          applicants: applicantsCount,
        };
      }),
    );
    return overview;
  }

  async getAnalytics() {
    const [totalEmployees, stageBreakdown, recentActivity] = await Promise.all([
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.employeeStage.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.employeeStage.findMany({
        where: { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          stage: { select: { id: true, name: true, order: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ]);
    return { totalEmployees, stageBreakdown, recentActivity };
  }

  async updateEmployeeWorkflowStage(
    employeeId: string,
    stageId: string,
    dto: UpdateWorkflowStageDto,
    updatedById?: string,
  ) {
    const workflowEntry = await this.prisma.employeeStage.findUnique({
      where: { employeeId_stageId: { employeeId, stageId } },
      include: { stage: true },
    });
    if (!workflowEntry) throw new NotFoundException('Workflow stage not found for this employee');

    const updateData: any = {
      status: dto.status,
      notes: dto.notes,
      assignedToId: dto.assignedToId,
    };
    if (dto.status === 'IN_PROGRESS' && !workflowEntry.startedAt) {
      updateData.startedAt = new Date();
    }
    if (dto.status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    const updated = await this.prisma.employeeStage.update({
      where: { employeeId_stageId: { employeeId, stageId } },
      data: updateData,
      include: { stage: true, assignedTo: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (updatedById) {
      await this.prisma.auditLog.create({
        data: {
          userId: updatedById,
          action: 'WORKFLOW_STAGE_UPDATE',
          entity: 'EmployeeWorkflowStage',
          entityId: `${employeeId}:${stageId}`,
          changes: { status: dto.status } as any,
        },
      });
    }
    return updated;
  }

  async setEmployeeCurrentStage(employeeId: string, stageId: string, updatedById?: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found');

    const stage = await this.prisma.stageTemplate.findUnique({ where: { id: stageId } });
    if (!stage) throw new NotFoundException('Workflow stage not found');

    // Complete any currently IN_PROGRESS stages
    await this.prisma.employeeStage.updateMany({
      where: { employeeId, status: 'IN_PROGRESS' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Upsert the chosen stage as IN_PROGRESS
    const result = await this.prisma.employeeStage.upsert({
      where: { employeeId_stageId: { employeeId, stageId } },
      create: { employeeId, stageId, status: 'IN_PROGRESS', startedAt: new Date() },
      update: { status: 'IN_PROGRESS', startedAt: new Date(), completedAt: null },
      include: { stage: true },
    });

    if (updatedById) {
      await this.prisma.auditLog.create({
        data: {
          userId: updatedById,
          action: 'WORKFLOW_STAGE_UPDATE',
          entity: 'Employee',
          entityId: employeeId,
          changes: { currentStageId: stageId, currentStageName: stage.name } as any,
        },
      });
    }

    return result;
  }

  async getTimeline(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId, deletedAt: null },
      include: {
        employeeStages: {
          include: {
            stage: true,
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { stage: { order: 'asc' } },
        },
      },
    });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    return {
      employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, status: employee.status },
      timeline: employee.employeeStages,
    };
  }

  async getStageDetails(stageId: string) {
    const stage = await this.prisma.stageTemplate.findUnique({ where: { id: stageId } });
    if (!stage) throw new NotFoundException('Stage not found');

    const [applicants, employeeStages] = await Promise.all([
      this.prisma.applicant.findMany({
        where: { currentWorkflowStageId: stageId, deletedAt: null },
        include: { jobType: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.employeeStage.findMany({
        where: { stageId, status: 'IN_PROGRESS' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, email: true, nationality: true, photoUrl: true, status: true } },
        },
        orderBy: { startedAt: 'asc' },
      }),
    ]);

    // Build document checklist for each person if the stage has required docs
    const buildDocChecklist = async (entityType: string, entityId: string) => {
      if (stage.requirementsDocuments.length === 0) return [];
      const docs = await this.prisma.document.findMany({
        where: { entityType: entityType as any, entityId, deletedAt: null },
        include: { documentType: { select: { name: true } } },
      });
      return stage.requirementsDocuments.map(reqName => {
        const doc = (docs as any[]).find(d => d.documentType.name === reqName);
        return { name: reqName, status: doc?.status ?? 'MISSING', documentId: doc?.id ?? null };
      });
    };

    const enrichedApplicants = await Promise.all(
      applicants.map(async (a: any) => ({
        ...a,
        docChecklist: await buildDocChecklist('APPLICANT', a.id),
      })),
    );

    const enrichedEmployees = await Promise.all(
      employeeStages.map(async (es: any) => ({
        ...es.employee,
        startedAt: es.startedAt,
        stageStatus: es.status,
        docChecklist: await buildDocChecklist('EMPLOYEE', es.employee.id),
      })),
    );

    return {
      stage,
      applicants: enrichedApplicants,
      employees: enrichedEmployees,
      stats: {
        total: applicants.length + employeeStages.length,
        applicantsCount: applicants.length,
        employeesCount: employeeStages.length,
      },
    };
  }

  // Work Permits
  async findWorkPermits(pagination: PaginationDto, employeeId?: string) {
    const { page = 1, limit = 10 } = pagination;
    const where: any = employeeId ? { employeeId } : {};
    const [items, total] = await Promise.all([
      this.prisma.workPermit.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.workPermit.count({ where }),
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async createWorkPermit(dto: CreateWorkPermitDto, createdById?: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const permit = await this.prisma.workPermit.create({
      data: {
        ...dto,
        applicationDate: new Date(dto.applicationDate),
        approvalDate: dto.approvalDate ? new Date(dto.approvalDate) : undefined,
        expiryDate: new Date(dto.expiryDate),
        status: dto.status || 'PENDING',
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (createdById) {
      await this.prisma.auditLog.create({
        data: { userId: createdById, action: 'CREATE', entity: 'WorkPermit', entityId: permit.id },
      });
    }
    return permit;
  }

  async updateWorkPermit(id: string, dto: Partial<CreateWorkPermitDto>, updatedById?: string) {
    const permit = await this.prisma.workPermit.findUnique({ where: { id } });
    if (!permit) throw new NotFoundException('Work permit not found');
    const updateData: any = { ...dto };
    if (dto.applicationDate) updateData.applicationDate = new Date(dto.applicationDate);
    if (dto.approvalDate) updateData.approvalDate = new Date(dto.approvalDate);
    if (dto.expiryDate) updateData.expiryDate = new Date(dto.expiryDate);
    return this.prisma.workPermit.update({ where: { id }, data: updateData });
  }

  // Visas
  async findVisas(pagination: PaginationDto, entityId?: string) {
    const { page = 1, limit = 10 } = pagination;
    const where: any = entityId ? { entityId } : {};
    const [items, total] = await Promise.all([
      this.prisma.visa.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: { createdAt: 'desc' } }),
      this.prisma.visa.count({ where }),
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async createVisa(dto: CreateVisaDto, createdById?: string) {
    const visa = await this.prisma.visa.create({
      data: {
        ...dto,
        entityType: dto.entityType as any,
        applicationDate: new Date(dto.applicationDate),
        appointmentDate: dto.appointmentDate ? new Date(dto.appointmentDate) : undefined,
        approvalDate: dto.approvalDate ? new Date(dto.approvalDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        status: dto.status || 'PENDING',
      },
    });
    if (createdById) {
      await this.prisma.auditLog.create({
        data: { userId: createdById, action: 'CREATE', entity: 'Visa', entityId: visa.id },
      });
    }
    return visa;
  }

  async updateVisa(id: string, dto: Partial<CreateVisaDto>, updatedById?: string) {
    const visa = await this.prisma.visa.findUnique({ where: { id } });
    if (!visa) throw new NotFoundException('Visa not found');
    const updateData: any = { ...dto };
    if (dto.applicationDate) updateData.applicationDate = new Date(dto.applicationDate);
    if (dto.appointmentDate) updateData.appointmentDate = new Date(dto.appointmentDate);
    if (dto.approvalDate) updateData.approvalDate = new Date(dto.approvalDate);
    if (dto.expiryDate) updateData.expiryDate = new Date(dto.expiryDate);
    return this.prisma.visa.update({ where: { id }, data: updateData });
  }
}
