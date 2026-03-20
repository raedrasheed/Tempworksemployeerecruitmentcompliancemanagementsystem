import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { roleId?: string; agencyId?: string; status?: string }) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc', roleId, agencyId, status } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };
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
        include: { role: true, agency: { select: { id: true, name: true } } },
        select: {
          id: true, email: true, firstName: true, lastName: true, phone: true,
          status: true, lastLoginAt: true, createdAt: true,
          role: { select: { id: true, name: true } },
          agency: { select: { id: true, name: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return PaginatedResponse.create(data, total, page, limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        agency: { select: { id: true, name: true, country: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }

  async create(dto: CreateUserDto) {
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

    const { passwordHash: ph, refreshToken, ...result } = user as any;
    return result;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto as any,
      include: { role: { select: { id: true, name: true } }, agency: { select: { id: true, name: true } } },
    });
    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'User deleted successfully' };
  }

  async updateProfile(userId: string, data: any) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { firstName: data.firstName, lastName: data.lastName, phone: data.phone },
      include: { role: { select: { id: true, name: true } } },
    });
    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }
}
