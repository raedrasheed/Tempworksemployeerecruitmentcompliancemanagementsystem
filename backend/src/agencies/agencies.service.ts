import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class AgenciesService {
  constructor(private prisma: PrismaService) {}

  private get include() {
    return { _count: { select: { users: true, employees: true } } };
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10, search, sortBy = 'name', sortOrder = 'asc' } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
      ];
    }
    const validSort = ['name', 'country', 'status', 'createdAt'];
    const [items, total] = await Promise.all([
      this.prisma.agency.findMany({ where, skip, take: Number(limit), orderBy: { [validSort.includes(sortBy) ? sortBy : 'name']: sortOrder }, include: this.include }),
      this.prisma.agency.count({ where }),
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async findOne(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id, deletedAt: null },
      include: {
        ...this.include,
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!agency) throw new NotFoundException(`Agency ${id} not found`);
    return agency;
  }

  async create(dto: CreateAgencyDto, createdById?: string) {
    const agency = await this.prisma.agency.create({
      data: { ...dto, status: (dto.status as any) || 'ACTIVE' },
      include: this.include,
    });
    if (createdById) {
      await this.prisma.auditLog.create({
        data: { userId: createdById, action: 'CREATE', entity: 'Agency', entityId: agency.id },
      });
    }
    return agency;
  }

  async update(id: string, dto: UpdateAgencyDto, updatedById?: string) {
    await this.findOne(id);
    const agency = await this.prisma.agency.update({
      where: { id },
      data: dto as any,
      include: this.include,
    });
    if (updatedById) {
      await this.prisma.auditLog.create({
        data: { userId: updatedById, action: 'UPDATE', entity: 'Agency', entityId: id },
      });
    }
    return agency;
  }

  async remove(id: string, deletedById?: string) {
    await this.findOne(id);
    await this.prisma.agency.update({ where: { id }, data: { deletedAt: new Date() } });
    if (deletedById) {
      await this.prisma.auditLog.create({
        data: { userId: deletedById, action: 'DELETE', entity: 'Agency', entityId: id },
      });
    }
    return { message: 'Agency deleted' };
  }

  async getUsers(id: string, pagination: PaginationDto) {
    await this.findOne(id);
    const { page = 1, limit = 10 } = pagination;
    const where = { agencyId: id, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: { id: true, email: true, firstName: true, lastName: true, status: true, role: { select: { name: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async getEmployees(id: string, pagination: PaginationDto) {
    await this.findOne(id);
    const { page = 1, limit = 10 } = pagination;
    const where = { agencyId: id, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: { id: true, firstName: true, lastName: true, email: true, status: true, licenseCategory: true },
      }),
      this.prisma.employee.count({ where }),
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async getStats(id: string) {
    await this.findOne(id);
    const [users, employees, activeEmployees, pendingEmployees] = await Promise.all([
      this.prisma.user.count({ where: { agencyId: id, deletedAt: null } }),
      this.prisma.employee.count({ where: { agencyId: id, deletedAt: null } }),
      this.prisma.employee.count({ where: { agencyId: id, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { agencyId: id, deletedAt: null, status: 'PENDING' } }),
    ]);
    return { users, employees, activeEmployees, pendingEmployees };
  }

  async setManager(agencyId: string, userId: string, actorId?: string) {
    // Verify user belongs to this agency
    const user = await this.prisma.user.findFirst({ where: { id: userId, agencyId, deletedAt: null } });
    if (!user) throw new BadRequestException('User does not belong to this agency');

    await this.prisma.agency.update({
      where: { id: agencyId },
      data: { managerId: userId },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'SET_AGENCY_MANAGER',
        entity: 'Agency',
        entityId: agencyId,
        changes: { managerId: userId } as any,
      },
    });

    return this.findOne(agencyId);
  }
}
