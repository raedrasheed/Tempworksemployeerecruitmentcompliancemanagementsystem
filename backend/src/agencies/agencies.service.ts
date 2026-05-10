import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { PilotPrismaAccessor } from '../saas/prisma/pilot-prisma.accessor';
import { getPilotScope, PilotScope } from '../saas/prisma/tenant-pilot-scope';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

/**
 * Phase 2.35 — Agencies reads-first TenantPrisma pilot.
 *
 * READ paths route through `pilot.client()` and spread
 * `tenantWherePlusSystem()` (active tenant OR `isSystem=true`) when
 * the pilot scope is active. Production default (flag off) is
 * byte-identical to pre-2.35.
 *
 * `listPublic()` stays globally visible — it is the public agency
 * dropdown for the apply form.
 *
 * WRITE / mutation / storage paths (`create`, `update`, `remove`,
 * `uploadLogo`, `setPermissionOverride`, `removePermissionOverride`,
 * `setManager`) stay on `legacyPrisma` and are tagged
 * `phase235-excluded-mutation` or `phase235-excluded-storage`.
 *
 * See `SAAS_PHASE2_AGENCIES_SYSTEM_AGENCY_DECISION.md` for the
 * `OR isSystem: true` rationale.
 */
@Injectable()
export class AgenciesService {
  constructor(
    private legacyPrisma: PrismaService,
    private storage: StorageService,
    private pilot: PilotPrismaAccessor,
  ) {}

  /** Pilot-aware Prisma surface used by READ paths only. Mutation
   *  paths use `legacyPrisma` directly. */
  private get prisma(): PrismaService {
    return this.pilot.client();
  }

  private scope(): PilotScope {
    return getPilotScope(this.pilot, 'agencies');
  }

  /**
   * Phase 2.35 — tenant-scope predicate that ALSO admits system
   * agencies. In legacy mode returns `{}` (byte-identical). In pilot
   * mode returns `{ OR: [{ tenantId: <active> }, { isSystem: true }] }`
   * which composes additively into the caller's `where` clause.
   */
  private tenantWhereOrSystem(): Record<string, unknown> {
    const s = this.scope();
    if (!s.active) return {};
    // Wrap in AND so a caller's existing top-level `OR` (e.g. search
    // filter on `findAll`) does not collide with this OR clause.
    return { AND: [{ OR: [{ tenantId: s.tenantId }, { isSystem: true }] }] };
  }

  private get include() {
    return { _count: { select: { users: true, employees: true } } };
  }

  async listPublic(): Promise<{ id: string; name: string }[]> {
    // @tenant-reviewed: phase235-global (public apply-form dropdown — every tenant must be enumerable)
    return this.legacyPrisma.agency.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * External tenant = user attached to any agency that is not the
   * Tempworks root (`isSystem=true`). All such users are scoped to
   * their own agency regardless of role name, so HR Managers and
   * Agency Managers in external agencies are treated identically.
   */
  private isExternalActor(actor?: { agencyId?: string; agencyIsSystem?: boolean }) {
    return !!actor && !!actor.agencyId && actor.agencyIsSystem !== true;
  }

  /** Throws when an external tenant tries to reach an agency other than their own. */
  private assertAgencyAccess(agencyId: string, actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean }) {
    if (this.isExternalActor(actor) && actor?.agencyId !== agencyId) {
      throw new ForbiddenException('You can only view your own agency');
    }
  }

  async findAll(pagination: PaginationDto, actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean }) {
    const { page = 1, limit = 10, search, sortBy = 'name', sortOrder = 'asc' } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { deletedAt: null, ...this.tenantWhereOrSystem() }; // @tenant-reviewed: phase235-pilot-scope
    // Agency users can only see their own agency in the listing.
    if (this.isExternalActor(actor)) {
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
      this.prisma.agency.findMany({ where, skip, take: Number(limit), orderBy: { [validSort.includes(sortBy) ? sortBy : 'name']: sortOrder }, include: this.include }), // @tenant-reviewed: phase235-pilot-scope
      this.prisma.agency.count({ where }), // @tenant-reviewed: phase235-pilot-scope
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async findOne(id: string, actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean }) {
    this.assertAgencyAccess(id, actor);
    const agency = await this.prisma.agency.findFirst({ // @tenant-reviewed: phase235-pilot-scope (was findUnique; migrated to findFirst to compose tenant predicate)
      where: { id, deletedAt: null, ...this.tenantWhereOrSystem() },
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

  async create(dto: CreateAgencyDto, createdById?: string, actorRole?: string) {
    const contactPerson = this.deriveContactPerson(dto);
    if (!contactPerson) throw new BadRequestException('Contact person name is required');
    // isSystem can only be set by System Admin — strip it from any
    // create payload originating from a lower-privileged caller.
    if (actorRole !== 'System Admin' && 'isSystem' in (dto as any)) {
      delete (dto as any).isSystem;
    }
    const agency = await this.legacyPrisma.agency.create({ // @tenant-reviewed: phase235-excluded-mutation
      data: {
        ...dto,
        contactPerson,
        status: (dto.status as any) || 'ACTIVE',
      },
      include: this.include,
    });
    if (createdById) {
      await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase235-excluded-mutation (audit kept legacy until agencies opts into TenantAuditLogService)
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
    // Business-identity fields Agency Manager must never change.
    'name', 'country', 'status',
    // Admin-only fields.
    'managerId', 'maxUsersPerAgency', 'isSystem',
    'deletedAt', 'deletedBy', 'deletionReason',
  ];

  async update(
    id: string,
    dto: UpdateAgencyDto,
    updatedById?: string,
    actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean },
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

    // isSystem is a tenancy-model switch (makes every user of this agency
    // global-scope) and must only be flipped by System Admins, regardless
    // of which caller reached PATCH /agencies/:id.
    if (actor?.role !== 'System Admin' && 'isSystem' in (dto as any)) {
      delete (dto as any).isSystem;
    }

    const data: any = { ...dto };
    const derived = this.deriveContactPerson(dto);
    if (derived !== undefined) data.contactPerson = derived;
    const agency = await this.legacyPrisma.agency.update({ // @tenant-reviewed: phase235-excluded-mutation
      where: { id },
      data,
      include: this.include,
    });
    if (updatedById) {
      await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase235-excluded-mutation
        data: { userId: updatedById, action: 'UPDATE', entity: 'Agency', entityId: id },
      });
    }
    return agency;
  }

  async uploadLogo(id: string, file: Express.Multer.File, actorId?: string) {
    const existing = await this.findOne(id);
    if (!file) throw new BadRequestException('No logo file provided');

    const upload = await this.storage.uploadFile(file.buffer, {
      keyPrefix: `agencies/${id}/logos`,
      contentType: file.mimetype,
      originalName: file.originalname,
      inline: true,
    });

    const agency = await this.legacyPrisma.agency.update({ // @tenant-reviewed: phase235-excluded-storage
      where: { id },
      data: { logoUrl: upload.url },
      include: this.include,
    });

    if ((existing as any)?.logoUrl && (existing as any).logoUrl !== upload.url) {
      await this.storage.deleteFileByUrlOrKey((existing as any).logoUrl);
    }

    if (actorId) {
      await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase235-excluded-storage
        data: { userId: actorId, action: 'UPDATE_LOGO', entity: 'Agency', entityId: id, changes: { logoUrl: upload.url } as any },
      });
    }
    return agency;
  }

  async remove(id: string, deletedById?: string) {
    await this.findOne(id);
    await this.legacyPrisma.agency.update({ where: { id }, data: { deletedAt: new Date() } }); // @tenant-reviewed: phase235-excluded-mutation
    if (deletedById) {
      await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase235-excluded-mutation
        data: { userId: deletedById, action: 'DELETE', entity: 'Agency', entityId: id },
      });
    }
    return { message: 'Agency deleted' };
  }

  async getUsers(id: string, pagination: PaginationDto, actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean }) {
    this.assertAgencyAccess(id, actor);
    await this.findOne(id, actor);
    const { page = 1, limit = 10 } = pagination;
    const where = { agencyId: id, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ // @tenant-reviewed: phase235-pilot-scope-precheck (parent agency gated by findOne above)
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: {
          id: true, email: true, firstName: true, lastName: true, status: true,
          // Include the approval state + per-user manager override flags so
          // the frontend can gate Edit/Delete/Approve buttons the same way
          // the standalone Users list does.
          agencyId: true,
          approvalStatus: true,
          approvedAt: true,
          allowManagerEdit: true,
          allowManagerDelete: true,
          role: { select: { id: true, name: true } },
        },
      }),
      this.prisma.user.count({ where }), // @tenant-reviewed: phase235-pilot-scope-precheck
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async getEmployees(id: string, pagination: PaginationDto, actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean }) {
    this.assertAgencyAccess(id, actor);
    await this.findOne(id, actor);
    const { page = 1, limit = 10 } = pagination;
    const where: any = { agencyId: id, deletedAt: null };

    // Any external tenant — regardless of role — must have an explicit
    // per-employee grant with canView=true; origin agency alone never
    // grants access, and a read-access-only-revoked grant still blocks.
    if (this.isExternalActor(actor)) {
      const grants = await this.prisma.employeeAgencyAccess.findMany({ // @tenant-reviewed: phase235-pilot-scope-precheck
        where: { agencyId: actor!.agencyId!, canView: true },
        select: { employeeId: true },
      });
      const allowedIds = grants.map(g => g.employeeId);
      if (allowedIds.length === 0) return PaginatedResponse.create([], 0, page, limit);
      where.id = { in: allowedIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({ // @tenant-reviewed: phase235-pilot-scope-precheck
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: { id: true, firstName: true, lastName: true, email: true, status: true, licenseCategory: true },
      }),
      this.prisma.employee.count({ where }), // @tenant-reviewed: phase235-pilot-scope-precheck
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async getStats(id: string, actor?: { role?: string; agencyId?: string; agencyIsSystem?: boolean }) {
    this.assertAgencyAccess(id, actor);
    await this.findOne(id, actor);

    // Build the employee-scope the same way getEmployees does so stats
    // don't leak a count larger than the external tenant can open.
    const employeeWhere: any = { agencyId: id, deletedAt: null };
    if (this.isExternalActor(actor)) {
      const grants = await this.prisma.employeeAgencyAccess.findMany({ // @tenant-reviewed: phase235-pilot-scope-precheck
        where: { agencyId: actor!.agencyId!, canView: true },
        select: { employeeId: true },
      });
      const allowedIds = grants.map(g => g.employeeId);
      if (allowedIds.length === 0) {
        const users = await this.prisma.user.count({ where: { agencyId: id, deletedAt: null } }); // @tenant-reviewed: phase235-pilot-scope-precheck
        return { users, employees: 0, activeEmployees: 0, pendingEmployees: 0 };
      }
      employeeWhere.id = { in: allowedIds };
    }
    const [users, employees, activeEmployees, pendingEmployees] = await Promise.all([
      this.prisma.user.count({ where: { agencyId: id, deletedAt: null } }),                                       // @tenant-reviewed: phase235-pilot-scope-precheck
      this.prisma.employee.count({ where: employeeWhere }),                                                       // @tenant-reviewed: phase235-pilot-scope-precheck
      this.prisma.employee.count({ where: { ...employeeWhere, status: 'ACTIVE' } }),                              // @tenant-reviewed: phase235-pilot-scope-precheck
      this.prisma.employee.count({ where: { ...employeeWhere, status: 'PENDING' } }),                             // @tenant-reviewed: phase235-pilot-scope-precheck
    ]);
    return { users, employees, activeEmployees, pendingEmployees };
  }

  // ── Agency-wide permission overrides (admin only) ───────────────────────────

  async listPermissionOverrides(agencyId: string) {
    await this.findOne(agencyId);
    return this.prisma.agencyPermissionOverride.findMany({ // @tenant-reviewed: phase235-pilot-scope-precheck
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
    const record = await this.legacyPrisma.agencyPermissionOverride.upsert({ // @tenant-reviewed: phase235-excluded-mutation
      where:  { agencyId_permission: { agencyId, permission } },
      create: { agencyId, permission, allow },
      update: { allow },
    });
    await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase235-excluded-mutation
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
      await this.legacyPrisma.agencyPermissionOverride.delete({ // @tenant-reviewed: phase235-excluded-mutation
        where: { agencyId_permission: { agencyId, permission } },
      });
    } catch {
      throw new NotFoundException('Permission override not found');
    }
    await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase235-excluded-mutation
      data: {
        userId: actorId, action: 'AGENCY_PERMISSION_OVERRIDE_REMOVED',
        entity: 'Agency', entityId: agencyId, changes: { permission } as any,
      },
    });
    return { message: 'Permission override removed' };
  }

  async setManager(agencyId: string, userId: string, actorId?: string) {
    // Verify user belongs to this agency
    const user = await this.legacyPrisma.user.findFirst({ where: { id: userId, agencyId, deletedAt: null } }); // @tenant-reviewed: phase235-excluded-mutation
    if (!user) throw new BadRequestException('User does not belong to this agency');

    await this.legacyPrisma.agency.update({ // @tenant-reviewed: phase235-excluded-mutation
      where: { id: agencyId },
      data: { managerId: userId },
    });

    await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase235-excluded-mutation
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
