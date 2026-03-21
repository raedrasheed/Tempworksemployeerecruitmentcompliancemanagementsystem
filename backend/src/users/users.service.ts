import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../logs/audit-log.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  private async getRoleName(roleId: string): Promise<string | null> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });
    return role?.name ?? null;
  }

  async findAll(query: PaginationDto & { roleId?: string; agencyId?: string; status?: string }, callerRole?: string) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc', roleId, agencyId, status } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };

    if (callerRole !== 'System Admin') {
      where.AND = [{ role: { name: { not: 'System Admin' } } }];
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (roleId) where.roleId = roleId;
    if (agencyId) where.agencyId = agencyId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true, email: true, firstName: true, lastName: true, phone: true,
          status: true, lastLoginAt: true, createdAt: true,
          roleId: true, agencyId: true,
          role: { select: { id: true, name: true } },
          agency: { select: { id: true, name: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return PaginatedResponse.create(data, total, page, limit);
  }

  async findOne(id: string, callerRole?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        agency: { select: { id: true, name: true, country: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    if (callerRole !== 'System Admin' && (user as any).role?.name === 'System Admin') {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }

  async create(dto: CreateUserDto, callerRole?: string, callerAgencyId?: string, actorId?: string) {
    if (callerRole !== 'System Admin' && dto.roleId) {
      const roleName = await this.getRoleName(dto.roleId);
      if (roleName === 'System Admin') {
        throw new ForbiddenException('Only System Admins can create System Admin users');
      }
    }

    if (callerRole === 'Agency Manager') {
      if (!callerAgencyId) throw new ForbiddenException('Agency Manager has no agency assigned');
      dto.agencyId = callerAgencyId;
    }

    const existing = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    if (existing) throw new ConflictException('User with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roleId: dto.roleId,
        agencyId: dto.agencyId,
        status: (dto.status as any) || 'ACTIVE',
      },
      include: { role: { select: { id: true, name: true } }, agency: { select: { id: true, name: true } } },
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'User',
      entityId: user.id,
      changes: { email: user.email, role: (user as any).role?.name },
    });

    const { passwordHash: ph, refreshToken, ...result } = user as any;
    return result;
  }

  async update(id: string, dto: UpdateUserDto, callerRole?: string, actorId?: string) {
    const existing = await this.findOne(id, callerRole);

    if (callerRole !== 'System Admin' && existing.role?.name === 'System Admin') {
      throw new ForbiddenException('Only System Admins can edit System Admin users');
    }

    if (callerRole !== 'System Admin' && dto.roleId) {
      const roleName = await this.getRoleName(dto.roleId);
      if (roleName === 'System Admin') {
        throw new ForbiddenException('Only System Admins can assign the System Admin role');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: dto as any,
      include: { role: { select: { id: true, name: true } }, agency: { select: { id: true, name: true } } },
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      changes: dto as any,
    });

    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }

  async remove(id: string, callerRole?: string, actorId?: string) {
    const existing = await this.findOne(id, callerRole);

    if (callerRole !== 'System Admin' && existing.role?.name === 'System Admin') {
      throw new ForbiddenException('Only System Admins can delete System Admin users');
    }

    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditLog.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'User',
      entityId: id,
      changes: { email: existing.email },
    });

    return { message: 'User deleted successfully' };
  }

  async updateProfile(userId: string, data: any, actorId?: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { firstName: data.firstName, lastName: data.lastName, phone: data.phone },
      include: { role: { select: { id: true, name: true } } },
    });

    await this.auditLog.log({
      userId: actorId || userId,
      action: 'UPDATE_PROFILE',
      entity: 'User',
      entityId: userId,
      changes: { firstName: data.firstName, lastName: data.lastName, phone: data.phone },
    });

    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }
}
