import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { ConvertToEmployeeDto } from './dto/convert-to-employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
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

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const validSort = ['firstName', 'lastName', 'email', 'status', 'createdAt'];
    const orderField = validSort.includes(sortBy) ? sortBy : 'createdAt';
    const [items, total] = await Promise.all([
      this.prisma.applicant.findMany({ where, skip, take: Number(limit), orderBy: { [orderField]: sortOrder }, include: this.include }),
      this.prisma.applicant.count({ where }),
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async findOne(id: string) {
    const applicant = await this.prisma.applicant.findUnique({
      where: { id, deletedAt: null }, include: this.include,
    });
    if (!applicant) throw new NotFoundException(`Applicant ${id} not found`);
    return applicant;
  }

  async create(dto: CreateApplicantDto, createdById?: string) {
    const existing = await this.prisma.applicant.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Applicant with this email already exists');
    const applicant = await this.prisma.applicant.create({
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        workAuthorizationExpiry: dto.workAuthorizationExpiry ? new Date(dto.workAuthorizationExpiry) : undefined,
        preferredStartDate: dto.preferredStartDate ? new Date(dto.preferredStartDate) : undefined,
        status: dto.status || 'NEW',
      },
      include: this.include,
    });
    if (createdById) {
      await this.prisma.auditLog.create({
        data: { userId: createdById, action: 'CREATE', entity: 'Applicant', entityId: applicant.id },
      });
    }
    return applicant;
  }

  async update(id: string, dto: UpdateApplicantDto, updatedById?: string) {
    await this.findOne(id);
    if (dto.email) {
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
    if (updatedById) {
      await this.prisma.auditLog.create({
        data: { userId: updatedById, action: 'UPDATE', entity: 'Applicant', entityId: id, changes: dto as any },
      });
    }
    return applicant;
  }

  async updateStatus(id: string, status: string, updatedById?: string) {
    await this.findOne(id);
    const applicant = await this.prisma.applicant.update({
      where: { id }, data: { status: status as any }, include: this.include,
    });
    if (updatedById) {
      await this.prisma.auditLog.create({
        data: { userId: updatedById, action: 'STATUS_CHANGE', entity: 'Applicant', entityId: id, changes: { status } as any },
      });
    }
    return applicant;
  }

  async remove(id: string, deletedById?: string) {
    await this.findOne(id);
    await this.prisma.applicant.update({ where: { id }, data: { deletedAt: new Date() } });
    if (deletedById) {
      await this.prisma.auditLog.create({
        data: { userId: deletedById, action: 'DELETE', entity: 'Applicant', entityId: id },
      });
    }
    return { message: 'Applicant deleted' };
  }

  /** Public submission: create applicant only. No auth required. */
  async publicSubmit(dto: CreateApplicantDto & { jobTypeId?: string; applicationNotes?: string }) {
    const existing = await this.prisma.applicant.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An application with this email already exists');

    const { applicationNotes, ...applicantData } = dto;
    const applicant = await this.prisma.applicant.create({
      data: {
        ...applicantData,
        dateOfBirth: applicantData.dateOfBirth ? new Date(applicantData.dateOfBirth) : undefined,
        workAuthorizationExpiry: applicantData.workAuthorizationExpiry ? new Date(applicantData.workAuthorizationExpiry) : undefined,
        preferredStartDate: applicantData.preferredStartDate ? new Date(applicantData.preferredStartDate) : undefined,
        status: 'NEW',
        notes: applicantData.notes || (applicationNotes ? `[Submitted] ${applicationNotes}` : undefined),
      },
      include: this.include,
    });

    return applicant;
  }

  async setCurrentStage(id: string, stageId: string | null, updatedById?: string) {
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
    if (updatedById) {
      await this.prisma.auditLog.create({
        data: {
          userId: updatedById,
          action: 'WORKFLOW_STAGE_UPDATE',
          entity: 'Applicant',
          entityId: id,
          changes: { currentWorkflowStageId: stageId } as any,
        },
      });
    }
    return applicant;
  }

  async convertToEmployee(id: string, dto: ConvertToEmployeeDto, actorId?: string) {
    const applicant = await this.findOne(id);

    // Check no employee with same email exists
    const existing = await this.prisma.employee.findFirst({
      where: { email: applicant.email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`An employee with email ${applicant.email} already exists`);
    }

    // Initialize all active workflow stages for the new employee
    const stages = await this.prisma.workflowStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    // Create employee record from applicant data + supplied address fields
    const employee = await this.prisma.employee.create({
      data: {
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
          create: stages.map((stage: any) => ({ stageId: stage.id, status: 'PENDING' })),
        },
      } as any,
      include: { agency: { select: { id: true, name: true } } },
    });

    // Re-assign all documents from the applicant to the new employee
    await this.prisma.document.updateMany({
      where: { entityType: 'APPLICANT', entityId: id, deletedAt: null },
      data: { entityType: 'EMPLOYEE', entityId: employee.id },
    });

    // Soft-delete the applicant
    await this.prisma.applicant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId ?? employee.id,
        action: 'CONVERT_TO_EMPLOYEE',
        entity: 'Applicant',
        entityId: id,
        changes: { employeeId: employee.id, email: applicant.email } as any,
      },
    });

    return { employee, message: 'Applicant successfully converted to employee' };
  }
}
