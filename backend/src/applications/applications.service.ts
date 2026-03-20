import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService) {}

  private get include() {
    return {
      applicant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, nationality: true, status: true } },
      jobType: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (search) {
      where.OR = [
        { applicant: { firstName: { contains: search, mode: 'insensitive' } } },
        { applicant: { lastName: { contains: search, mode: 'insensitive' } } },
        { applicant: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.application.findMany({ where, skip, take: Number(limit), orderBy: { [sortBy === 'createdAt' ? 'createdAt' : 'status']: sortOrder }, include: this.include }),
      this.prisma.application.count({ where }),
    ]);
    return new PaginatedResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const app = await this.prisma.application.findUnique({ where: { id }, include: this.include });
    if (!app) throw new NotFoundException(`Application ${id} not found`);
    return app;
  }

  async create(dto: CreateApplicationDto, createdById?: string) {
    const applicant = await this.prisma.applicant.findUnique({ where: { id: dto.applicantId } });
    if (!applicant) throw new NotFoundException('Applicant not found');

    const application = await this.prisma.application.create({
      data: {
        applicantId: dto.applicantId,
        status: dto.status || 'DRAFT',
        jobTypeId: dto.jobTypeId,
        notes: dto.notes,
      },
      include: this.include,
    });
    if (createdById) {
      await this.prisma.auditLog.create({
        data: { userId: createdById, action: 'CREATE', entity: 'Application', entityId: application.id },
      });
    }
    return application;
  }

  async publicSubmit(dto: CreateApplicationDto) {
    // Public form submission - no auth required
    const applicant = await this.prisma.applicant.findUnique({ where: { id: dto.applicantId } });
    if (!applicant) throw new NotFoundException('Applicant not found');
    return this.prisma.application.create({
      data: {
        applicantId: dto.applicantId,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        jobTypeId: dto.jobTypeId,
        notes: dto.notes,
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdateApplicationDto, updatedById?: string) {
    await this.findOne(id);
    const updated = await this.prisma.application.update({
      where: { id },
      data: { ...dto, additionalNote: undefined } as any,
      include: this.include,
    });
    if (updatedById) {
      await this.prisma.auditLog.create({
        data: { userId: updatedById, action: 'UPDATE', entity: 'Application', entityId: id, changes: dto as any },
      });
    }
    return updated;
  }

  async updateStatus(id: string, status: string, reviewedById?: string) {
    await this.findOne(id);
    const reviewedStatuses = ['APPROVED', 'REJECTED', 'UNDER_REVIEW'];
    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: status as any,
        reviewedAt: reviewedStatuses.includes(status) ? new Date() : undefined,
        reviewedById: reviewedStatuses.includes(status) ? reviewedById : undefined,
        submittedAt: status === 'SUBMITTED' ? new Date() : undefined,
      },
      include: this.include,
    });
    if (reviewedById) {
      await this.prisma.auditLog.create({
        data: { userId: reviewedById, action: 'STATUS_CHANGE', entity: 'Application', entityId: id, changes: { status } as any },
      });
    }
    return updated;
  }

  async addNote(id: string, note: string, userId?: string) {
    const app = await this.findOne(id);
    const existingNotes = app.notes || '';
    const timestamp = new Date().toISOString();
    const updatedNotes = existingNotes
      ? `${existingNotes}\n---\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`;
    return this.prisma.application.update({
      where: { id }, data: { notes: updatedNotes }, include: this.include,
    });
  }

  async remove(id: string, deletedById?: string) {
    await this.findOne(id);
    await this.prisma.application.delete({ where: { id } });
    if (deletedById) {
      await this.prisma.auditLog.create({
        data: { userId: deletedById, action: 'DELETE', entity: 'Application', entityId: id },
      });
    }
    return { message: 'Application deleted' };
  }
}
