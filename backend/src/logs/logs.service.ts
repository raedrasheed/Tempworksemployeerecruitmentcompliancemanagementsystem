import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

/** Roles that can see ALL logs with no restrictions */
const FULL_ACCESS_ROLES = ['System Admin', 'HR Manager', 'Compliance Officer'];

export interface CallerScope {
  role: string;
  userId: string;
  agencyId?: string;
}

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Resolve the set of userIds whose logs the caller may see.
   * Returns undefined  → no restriction (full access)
   * Returns string[]   → restrict to these userIds only
   */
  private async resolveVisibleUserIds(scope: CallerScope): Promise<string[] | undefined> {
    if (FULL_ACCESS_ROLES.includes(scope.role)) return undefined; // full access

    if (scope.role === 'Agency Manager' && scope.agencyId) {
      // Agency Manager sees their own logs + all users in their agency
      const agencyUsers = await this.prisma.user.findMany({
        where: { agencyId: scope.agencyId, deletedAt: null },
        select: { id: true },
      });
      return agencyUsers.map(u => u.id);
    }

    // Everyone else: only their own activity
    return [scope.userId];
  }

  async findAll(
    pagination: PaginationDto,
    filters: {
      userId?: string;
      entity?: string;
      entityId?: string;
      action?: string;
      fromDate?: string;
      toDate?: string;
    } = {},
    scope?: CallerScope,
  ) {
    const { page = 1, limit = 20, search } = pagination;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };

    // ── Scope restriction ────────────────────────────────────────────────────
    if (scope) {
      const visibleIds = await this.resolveVisibleUserIds(scope);
      if (visibleIds !== undefined) {
        // If caller also passed a userId filter, intersect with their visible set
        if (filters.userId) {
          where.userId = visibleIds.includes(filters.userId) ? filters.userId : '__none__';
        } else {
          where.userId = { in: visibleIds };
        }
      } else if (filters.userId) {
        where.userId = filters.userId;
      }
    } else if (filters.userId) {
      where.userId = filters.userId;
    }

    // ── Other filters ────────────────────────────────────────────────────────
    if (filters.entity) where.entity = filters.entity;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
    }
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return PaginatedResponse.create(items, total, page, limit);
  }

  async getStats(scope?: CallerScope) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Build the base scope filter
    let scopeWhere: any = { deletedAt: null };
    if (scope) {
      const visibleIds = await this.resolveVisibleUserIds(scope);
      if (visibleIds !== undefined) {
        scopeWhere = { userId: { in: visibleIds } };
      }
    }

    const [total, last24hCount, last7dCount, byEntity, byAction, topUsers] = await Promise.all([
      this.prisma.auditLog.count({ where: scopeWhere }),
      this.prisma.auditLog.count({ where: { ...scopeWhere, createdAt: { gte: last24h } } }),
      this.prisma.auditLog.count({ where: { ...scopeWhere, createdAt: { gte: last7d } } }),
      this.prisma.auditLog.groupBy({
        by: ['entity'],
        where: scopeWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: scopeWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        _count: { id: true },
        where: { ...scopeWhere, userId: { not: null } },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    return { total, last24hCount, last7dCount, byEntity, byAction, topUsers };
  }

  async clearLogs(filters: { fromDate?: string; toDate?: string; entity?: string } = {}) {
    const where: any = {};
    if (filters.entity) where.entity = filters.entity;
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
    }
    where.deletedAt = null;
    const { count } = await this.prisma.auditLog.updateMany({ where, data: { deletedAt: new Date() } });
    return { deleted: count, message: `${count} log entries deleted` };
  }

  async deleteOne(id: string) {
    const log = await this.prisma.auditLog.findFirst({ where: { id, deletedAt: null } });
    if (!log) return { message: 'Not found' };
    await this.prisma.auditLog.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Log entry deleted' };
  }
}
