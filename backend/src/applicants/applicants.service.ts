import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class ApplicantsService {
  constructor(private prisma: PrismaService) {}

  private get include() {
    return {
      jobType: { select: { id: true, name: true } },
      applications: { orderBy: { createdAt: 'desc' as any }, take: 1 },
      _count: { select: { applications: true } },
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
        dateOfBirth: new Date(dto.dateOfBirth),
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

  async getApplication(applicantId: string) {
    await this.findOne(applicantId);
    return this.prisma.application.findMany({
      where: { applicantId },
      include: {
        jobType: true,
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Public combined submission: create applicant + application atomically. No auth required. */
  async publicSubmit(dto: CreateApplicantDto & { jobTypeId?: string; applicationNotes?: string }) {
    const existing = await this.prisma.applicant.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An application with this email already exists');

    const { jobTypeId, applicationNotes, ...applicantData } = dto;
    const applicant = await this.prisma.applicant.create({
      data: {
        ...applicantData,
        dateOfBirth: new Date(applicantData.dateOfBirth),
        workAuthorizationExpiry: applicantData.workAuthorizationExpiry ? new Date(applicantData.workAuthorizationExpiry) : undefined,
        preferredStartDate: applicantData.preferredStartDate ? new Date(applicantData.preferredStartDate) : undefined,
        status: 'NEW',
      },
    });

    const application = await this.prisma.application.create({
      data: {
        applicantId: applicant.id,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        jobTypeId: jobTypeId || undefined,
        notes: applicationNotes || undefined,
      },
      include: {
        applicant: { select: { id: true, firstName: true, lastName: true, email: true } },
        jobType: { select: { id: true, name: true } },
      },
    });

    return { applicant, application };
  }
}
