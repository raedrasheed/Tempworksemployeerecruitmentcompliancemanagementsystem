import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll(callerRole?: string) {
    // Agency Managers may only assign the Agency User role
    const nameFilter = callerRole === 'Agency Manager' ? { name: 'Agency User' } : undefined;
    return this.prisma.role.findMany({
      where: nameFilter,
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Role with this name already exists');

    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissionIds
          ? { create: dto.permissionIds.map((id) => ({ permissionId: id })) }
          : undefined,
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async update(id: string, dto: Partial<CreateRoleDto>) {
    const role = await this.findOne(id);
    if (role.isSystem && dto.name && dto.name !== role.name) throw new BadRequestException('Cannot rename system roles');

    if (dto.permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      if (dto.permissionIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: dto.permissionIds.map((pid) => ({ roleId: id, permissionId: pid })),
        });
      }
    }

    return this.prisma.role.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.isSystem) throw new BadRequestException('Cannot delete system roles');
    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted successfully' };
  }

  async getPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  }

  async getPermissionsMatrix() {
    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({ include: { permissions: true } }),
      this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] }),
    ]);

    const matrix = roles.map((role) => ({
      role: { id: role.id, name: role.name },
      permissions: permissions.map((perm) => ({
        id: perm.id,
        name: perm.name,
        module: perm.module,
        action: perm.action,
        granted: role.permissions.some((rp) => rp.permissionId === perm.id),
      })),
    }));

    return { roles: roles.map((r) => ({ id: r.id, name: r.name })), permissions, matrix };
  }
}
