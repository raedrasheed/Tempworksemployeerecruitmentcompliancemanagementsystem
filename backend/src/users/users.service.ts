import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../logs/audit-log.service';
import { EmailService } from '../email/email.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

// Fields that only System Admin / HR Manager can change
const ADMIN_ONLY_FIELDS: (keyof UpdateUserDto)[] = [
  'email', 'roleId', 'agencyId', 'status', 'firstName', 'lastName',
  'startDate', 'department', 'jobTitle',
];

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private emailService: EmailService,
    private authService: AuthService,
  ) {}

  private async getRoleName(roleId: string): Promise<string | null> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });
    return role?.name ?? null;
  }

  // ---------------------------------------------------------------------------
  // User number sequence
  // ---------------------------------------------------------------------------
  private async getNextUserNumber(): Promise<string> {
    // Use a raw upsert approach: find-or-create then increment atomically
    try {
      // Try to increment an existing sequence row
      const existing = await this.prisma.userNumberSequence.findFirst();
      if (existing) {
        const updated = await this.prisma.userNumberSequence.update({
          where: { id: existing.id },
          data: { current: { increment: 1 } },
        });
        const n = updated.current;
        return n > 9999 ? `U${n}` : `U${String(n).padStart(4, '0')}`;
      } else {
        // Seed the sequence: start at 1
        const created = await this.prisma.userNumberSequence.create({
          data: { current: 1 },
        });
        const n = created.current;
        return n > 9999 ? `U${n}` : `U${String(n).padStart(4, '0')}`;
      }
    } catch {
      // Fallback: use active user count + 1
      const count = await this.prisma.user.count({ where: { deletedAt: null } });
      const n = count + 1;
      return n > 9999 ? `U${n}` : `U${String(n).padStart(4, '0')}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Full user select (no sensitive fields)
  // ---------------------------------------------------------------------------
  private get fullUserSelect() {
    return {
      id: true,
      userNumber: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      citizenship: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      country: true,
      postalCode: true,
      jobTitle: true,
      department: true,
      startDate: true,
      photoUrl: true,
      status: true,
      roleId: true,
      agencyId: true,
      preferredLanguage: true,
      timeZone: true,
      notificationPrefs: true,
      failedLoginAttempts: true,
      lockedAt: true,
      lastLoginAt: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Find all
  // ---------------------------------------------------------------------------
  async findAll(
    query: PaginationDto & { roleId?: string; agencyId?: string; status?: string },
    callerRole?: string,
    callerAgencyId?: string,
  ) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc', roleId, status } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };

    // Agency Managers can only see users inside their own agency
    if (callerRole === 'Agency Manager') {
      if (!callerAgencyId) throw new ForbiddenException('Agency Manager has no agency assigned');
      where.agencyId = callerAgencyId;
    } else {
      // Non-admins cannot see System Admin accounts
      if (callerRole !== 'System Admin') {
        where.AND = [{ role: { name: { not: 'System Admin' } } }];
      }
      // Allow explicit agencyId filter for admins/HR
      if (query.agencyId) where.agencyId = query.agencyId;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { userNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (roleId) where.roleId = roleId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        select: {
          ...this.fullUserSelect,
          role: { select: { id: true, name: true } },
          agency: { select: { id: true, name: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return PaginatedResponse.create(data, total, page, limit);
  }

  // ---------------------------------------------------------------------------
  // Find one
  // ---------------------------------------------------------------------------
  async findOne(id: string, callerRole?: string, callerAgencyId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        agency: { select: { id: true, name: true, country: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Agency Managers can only view users inside their own agency
    if (callerRole === 'Agency Manager' && user.agencyId !== callerAgencyId) {
      throw new NotFoundException('User not found');
    }

    if (callerRole !== 'System Admin' && (user as any).role?.name === 'System Admin') {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Create user — sets PENDING status, empty password, sends activation email
  // ---------------------------------------------------------------------------
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

      // Enforce max users per agency limit using per-agency setting
      const agency = await this.prisma.agency.findUnique({ where: { id: callerAgencyId }, select: { maxUsersPerAgency: true } });
      const maxUsers = (agency as any)?.maxUsersPerAgency ?? 10;
      const currentCount = await this.prisma.user.count({ where: { agencyId: callerAgencyId, deletedAt: null } });
      if (currentCount >= maxUsers) {
        throw new ForbiddenException(`Agency has reached the maximum user limit of ${maxUsers}. Contact a System Administrator to increase the limit.`);
      }
    }

    const existing = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (existing) throw new ConflictException('User with this email already exists');

    // Generate user number
    const userNumber = await this.getNextUserNumber();

    // Hash password if provided, otherwise empty hash (activated via email)
    let passwordHash = '';
    let initialStatus: string = dto.status || 'PENDING';
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12);
      if (!dto.status) initialStatus = 'ACTIVE';
    }

    // Create user with all fields
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        phone: dto.phone,
        roleId: dto.roleId,
        agencyId: dto.agencyId,
        status: initialStatus as any,
        userNumber,
        createdById: actorId,
        // Profile fields
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender as any,
        citizenship: dto.citizenship,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        country: dto.country,
        postalCode: dto.postalCode,
        jobTitle: dto.jobTitle,
        department: dto.department,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        // Preferences
        preferredLanguage: dto.preferredLanguage,
        timeZone: dto.timeZone,
      },
      include: { role: { select: { id: true, name: true } }, agency: { select: { id: true, name: true } } },
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'User',
      entityId: user.id,
      changes: {
        email: user.email,
        role: (user as any).role?.name,
        userNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
    });

    // Generate activation token and send email (fire-and-forget) only when no password was provided
    if (!dto.password) {
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const token = await this.authService.generateUserActivationToken(user.id);
        this.emailService
          .sendActivationEmail(
            user.email,
            `${user.firstName} ${user.lastName}`,
            token,
            frontendUrl,
          )
          .catch(() => undefined);
      } catch {
        // Activation email failure must not fail user creation
      }
    }

    const { passwordHash: ph, refreshToken, ...result } = user as any;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
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

    // Strip admin-only fields if caller is not System Admin or HR Manager
    const isAdminOrHR = callerRole === 'System Admin' || callerRole === 'HR Manager';
    const updateData: any = { ...dto };
    if (!isAdminOrHR) {
      for (const field of ADMIN_ONLY_FIELDS) {
        delete updateData[field];
      }
    }

    // Convert date strings to Date objects
    if (updateData.dateOfBirth) updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: { select: { id: true, name: true } }, agency: { select: { id: true, name: true } } },
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      changes: updateData,
    });

    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Update profile (self-edit — restricted fields only)
  // ---------------------------------------------------------------------------
  async updateProfile(userId: string, dto: UpdateProfileDto, actorId?: string) {
    // Only allow the explicitly safe self-edit fields
    const safeData: any = {};
    if (dto.phone !== undefined) safeData.phone = dto.phone;
    if (dto.dateOfBirth !== undefined) safeData.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) safeData.gender = dto.gender;
    if (dto.citizenship !== undefined) safeData.citizenship = dto.citizenship;
    if (dto.addressLine1 !== undefined) safeData.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 !== undefined) safeData.addressLine2 = dto.addressLine2;
    if (dto.city !== undefined) safeData.city = dto.city;
    if (dto.country !== undefined) safeData.country = dto.country;
    if (dto.postalCode !== undefined) safeData.postalCode = dto.postalCode;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: safeData,
      include: { role: { select: { id: true, name: true } } },
    });

    await this.auditLog.log({
      userId: actorId || userId,
      action: 'UPDATE_PROFILE',
      entity: 'User',
      entityId: userId,
      changes: safeData,
    });

    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Update preferences
  // ---------------------------------------------------------------------------
  async updatePreferences(userId: string, dto: UpdatePreferencesDto, actorId?: string) {
    const updateData: any = {};
    if (dto.preferredLanguage !== undefined) updateData.preferredLanguage = dto.preferredLanguage;
    if (dto.timeZone !== undefined) updateData.timeZone = dto.timeZone;
    if (dto.notificationPrefs !== undefined) updateData.notificationPrefs = dto.notificationPrefs;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { role: { select: { id: true, name: true } } },
    });

    await this.auditLog.log({
      userId: actorId || userId,
      action: 'UPDATE_PREFERENCES',
      entity: 'User',
      entityId: userId,
      changes: updateData,
    });

    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Upload photo
  // ---------------------------------------------------------------------------
  async uploadPhoto(userId: string, photoUrl: string, actorId?: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { photoUrl },
      include: { role: { select: { id: true, name: true } } },
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'UPLOAD_PHOTO',
      entity: 'User',
      entityId: userId,
      changes: { photoUrl },
    });

    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Unlock user
  // ---------------------------------------------------------------------------
  async unlockUser(userId: string, actorId?: string) {
    const existing = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('User not found');

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedAt: null },
      include: { role: { select: { id: true, name: true } } },
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'USER_UNLOCKED',
      entity: 'User',
      entityId: userId,
      changes: { failedLoginAttempts: 0, lockedAt: null },
    });

    const { passwordHash, refreshToken, ...result } = user as any;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Grant/revoke permission override
  // ---------------------------------------------------------------------------
  async setPermissionOverride(userId: string, permission: string, granted: boolean, actorId?: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const override = await this.prisma.agencyUserPermission.upsert({
      where: { userId_permission: { userId, permission } },
      create: { userId, permission, granted, grantedById: actorId },
      update: { granted, grantedById: actorId },
    });

    await this.auditLog.log({
      userId: actorId,
      action: granted ? 'PERMISSION_GRANTED' : 'PERMISSION_REVOKED',
      entity: 'User',
      entityId: userId,
      changes: { permission, granted },
    });

    return override;
  }

  async removePermissionOverride(userId: string, permission: string, actorId?: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    try {
      await this.prisma.agencyUserPermission.delete({
        where: { userId_permission: { userId, permission } },
      });
    } catch {
      throw new NotFoundException('Permission override not found');
    }

    await this.auditLog.log({
      userId: actorId,
      action: 'PERMISSION_OVERRIDE_REMOVED',
      entity: 'User',
      entityId: userId,
      changes: { permission },
    });

    return { message: 'Permission override removed' };
  }

  async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        permissionOverrides: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const rolePermissions = (user as any).role?.permissions?.map((rp: any) => ({
      permission: rp.permission?.name,
      source: 'role',
      granted: true,
    })) ?? [];

    const overrides = (user as any).permissionOverrides?.map((po: any) => ({
      permission: po.permission,
      source: 'override',
      granted: po.granted,
    })) ?? [];

    return { rolePermissions, overrides };
  }

  // ---------------------------------------------------------------------------
  // Remove (soft delete)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Bulk import (CSV)
  // ---------------------------------------------------------------------------
  async bulkImport(records: any[], actorId?: string): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowLabel = `Row ${i + 1}`;

      // Validate required fields
      if (!record.email || !record.firstName || !record.lastName || !record.roleId) {
        failed++;
        errors.push(`${rowLabel}: Missing required fields (email, firstName, lastName, roleId)`);
        continue;
      }

      // Check for duplicate email
      const existing = await this.prisma.user.findFirst({ where: { email: record.email } });
      if (existing) {
        failed++;
        errors.push(`${rowLabel}: User with email ${record.email} already exists`);
        continue;
      }

      try {
        const userNumber = await this.getNextUserNumber();
        await this.prisma.user.create({
          data: {
            email: record.email,
            passwordHash: '',
            firstName: record.firstName,
            middleName: record.middleName,
            lastName: record.lastName,
            phone: record.phone,
            roleId: record.roleId,
            agencyId: record.agencyId,
            status: 'PENDING',
            userNumber,
            createdById: actorId,
            dateOfBirth: record.dateOfBirth ? new Date(record.dateOfBirth) : undefined,
            gender: record.gender,
            citizenship: record.citizenship,
            jobTitle: record.jobTitle,
            department: record.department,
          },
        });
        success++;
      } catch (err: any) {
        failed++;
        errors.push(`${rowLabel}: ${err.message}`);
      }
    }

    if (success > 0) {
      await this.auditLog.log({
        userId: actorId,
        action: 'BULK_IMPORT',
        entity: 'User',
        entityId: 'bulk',
        changes: { success, failed, total: records.length },
      });
    }

    return { success, failed, errors };
  }

  // ---------------------------------------------------------------------------
  // Bulk export
  // ---------------------------------------------------------------------------
  async bulkExport(query: any, callerRole?: string, callerAgencyId?: string): Promise<any[]> {
    const where: any = { deletedAt: null };

    if (callerRole === 'Agency Manager') {
      if (!callerAgencyId) throw new ForbiddenException('Agency Manager has no agency assigned');
      where.agencyId = callerAgencyId;
    } else if (callerRole !== 'System Admin') {
      where.AND = [{ role: { name: { not: 'System Admin' } } }];
      if (query.agencyId) where.agencyId = query.agencyId;
    } else {
      if (query.agencyId) where.agencyId = query.agencyId;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.roleId) where.roleId = query.roleId;
    if (query.status) where.status = query.status;

    const users = await this.prisma.user.findMany({
      where,
      select: {
        ...this.fullUserSelect,
        role: { select: { id: true, name: true } },
        agency: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Ensure no sensitive fields leaked (already excluded via select)
    return users;
  }

  async getActivationLink(userId: string): Promise<{ url: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.status !== 'PENDING' && user.status !== 'INACTIVE') {
      throw new BadRequestException('Activation link is only available for PENDING or INACTIVE accounts');
    }

    // Invalidate old unused tokens and generate a fresh one
    await this.prisma.activationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = await this.authService.generateUserActivationToken(userId);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return { url: `${frontendUrl}/activate?token=${token}` };
  }
}
