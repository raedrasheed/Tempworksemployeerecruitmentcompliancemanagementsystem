import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
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

  async listPublic(): Promise<{ id: string; name: string }[]> {
    return this.prisma.agency.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Returns true when the caller is an external agency-side user whose view
   * must be scoped to their own agency only (never another agency's data).
   */
  private isAgencyActor(actor?: { role?: string }) {
    return actor?.role === 'Agency User' || actor?.role === 'Agency Manager';
  }

  /** Throws when an agency user tries to reach an agency other than their own. */
  private assertAgencyAccess(agencyId: string, actor?: { role?: string; agencyId?: string }) {
    if (this.isAgencyActor(actor) && actor?.agencyId !== agencyId) {
      throw new ForbiddenException('You can only view your own agency');
    }
  }

  async findAll(pagination: PaginationDto, actor?: { role?: string; agencyId?: string }) {
    const { page = 1, limit = 10, search, sortBy = 'name', sortOrder = 'asc' } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { deletedAt: null };
    // Agency users can only see their own agency in the listing.
    if (this.isAgencyActor(actor)) {
      if (!actor?.agencyId) return PaginatedResponse.create([], 0, page, limit);
      where.id = actor.agencyId;
    }
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

  async findOne(id: string, actor?: { role?: string; agencyId?: string }) {
    this.assertAgencyAccess(id, actor);
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

  /** Derive the legacy `contactPerson` column from the structured name pieces
   *  when the client sends first/middle/last but omits the combined value.
   *  Keeps backwards compatibility for listing/search code that still reads
   *  the single column. */
  private deriveContactPerson(dto: Partial<CreateAgencyDto>): string | undefined {
    if (dto.contactPerson && dto.contactPerson.trim()) return dto.contactPerson.trim();
    const pieces = [dto.contactFirstName, dto.contactMiddleName, dto.contactLastName]
      .map(p => (p ?? '').trim())
      .filter(Boolean);
    return pieces.length ? pieces.join(' ') : undefined;
  }

  async create(dto: CreateAgencyDto, createdById?: string) {
    const contactPerson = this.deriveContactPerson(dto);
    if (!contactPerson) throw new BadRequestException('Contact person name is required');
    const agency = await this.prisma.agency.create({
      data: {
        ...dto,
        contactPerson,
        status: (dto.status as any) || 'ACTIVE',
      },
      include: this.include,
    });
    if (createdById) {
      await this.prisma.auditLog.create({
        data: { userId: createdById, action: 'CREATE', entity: 'Agency', entityId: agency.id },
      });
    }
    return agency;
  }

  /**
   * Agency fields that an Agency Manager is NEVER allowed to touch. The
   * list is the single source of truth — adding a future protected field
   * is a one-line change here.
   */
  static readonly PROTECTED_FIELDS_FOR_MANAGER: string[] = [
    'name', 'managerId', 'maxUsersPerAgency', 'status', 'deletedAt', 'deletedBy', 'deletionReason',
  ];

  async update(
    id: string,
    dto: UpdateAgencyDto,
    updatedById?: string,
    actor?: { role?: string; agencyId?: string },
  ) {
    const existing = await this.findOne(id);

    // Agency Manager scoping: can only edit their own agency, and protected
    // fields (name, managerId, status, maxUsersPerAgency, …) are stripped.
    if (actor?.role === 'Agency Manager') {
      if (actor.agencyId !== id) throw new ForbiddenException('You can only edit your own agency');
      for (const field of AgenciesService.PROTECTED_FIELDS_FOR_MANAGER) {
        delete (dto as any)[field];
      }
    }

    const data: any = { ...dto };
    const derived = this.deriveContactPerson(dto);
    if (derived !== undefined) data.contactPerson = derived;
    const agency = await this.prisma.agency.update({
      where: { id },
      data,
      include: this.include,
    });
    if (updatedById) {
      await this.prisma.auditLog.create({
        data: { userId: updatedById, action: 'UPDATE', entity: 'Agency', entityId: id },
      });
    }
    return agency;
  }

  async uploadLogo(id: string, file: Express.Multer.File, actorId?: string) {
    await this.findOne(id);
    if (!file) throw new BadRequestException('No logo file provided');
    // Files land under uploads/; the public URL follows the same `/uploads/<file>`
    // convention used by employee/applicant photo uploads.
    const logoUrl = `/uploads/${file.filename}`;
    const agency = await this.prisma.agency.update({
      where: { id },
      data: { logoUrl },
      include: this.include,
    });
    if (actorId) {
      await this.prisma.auditLog.create({
        data: { userId: actorId, action: 'UPDATE_LOGO', entity: 'Agency', entityId: id, changes: { logoUrl } as any },
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

  async getUsers(id: string, pagination: PaginationDto, actor?: { role?: string; agencyId?: string }) {
    this.assertAgencyAccess(id, actor);
    await this.findOne(id, actor);
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

  async getEmployees(id: string, pagination: PaginationDto, actor?: { role?: string; agencyId?: string }) {
    this.assertAgencyAccess(id, actor);
    await this.findOne(id, actor);
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

  async getStats(id: string, actor?: { role?: string; agencyId?: string }) {
    this.assertAgencyAccess(id, actor);
    await this.findOne(id, actor);
    const [users, employees, activeEmployees, pendingEmployees] = await Promise.all([
      this.prisma.user.count({ where: { agencyId: id, deletedAt: null } }),
      this.prisma.employee.count({ where: { agencyId: id, deletedAt: null } }),
      this.prisma.employee.count({ where: { agencyId: id, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { agencyId: id, deletedAt: null, status: 'PENDING' } }),
    ]);
    return { users, employees, activeEmployees, pendingEmployees };
  }

  // ── Agency-wide permission overrides (admin only) ───────────────────────────

  async listPermissionOverrides(agencyId: string) {
    await this.findOne(agencyId);
    return this.prisma.agencyPermissionOverride.findMany({
      where: { agencyId },
      orderBy: { permission: 'asc' },
    });
  }

  async setPermissionOverride(
    agencyId: string,
    permission: string,
    allow: boolean,
    actorId?: string,
  ) {
    await this.findOne(agencyId);
    const record = await this.prisma.agencyPermissionOverride.upsert({
      where:  { agencyId_permission: { agencyId, permission } },
      create: { agencyId, permission, allow },
      update: { allow },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId, action: allow ? 'AGENCY_PERMISSION_GRANT' : 'AGENCY_PERMISSION_REVOKE',
        entity: 'Agency', entityId: agencyId, changes: { permission, allow } as any,
      },
    });
    return record;
  }

  async removePermissionOverride(agencyId: string, permission: string, actorId?: string) {
    await this.findOne(agencyId);
    try {
      await this.prisma.agencyPermissionOverride.delete({
        where: { agencyId_permission: { agencyId, permission } },
      });
    } catch {
      throw new NotFoundException('Permission override not found');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actorId, action: 'AGENCY_PERMISSION_OVERRIDE_REMOVED',
        entity: 'Agency', entityId: agencyId, changes: { permission } as any,
      },
    });
    return { message: 'Permission override removed' };
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
