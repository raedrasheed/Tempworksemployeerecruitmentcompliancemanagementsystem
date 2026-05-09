import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PilotPrismaAccessor } from '../saas/prisma/pilot-prisma.accessor';
import { getPilotScope, PilotScope } from '../saas/prisma/tenant-pilot-scope';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

/**
 * Compliance dashboard + alert management.
 *
 * Phase 2.8 — second tenant-scoped TenantPrisma pilot. The service
 * routes Prisma calls through `PilotPrismaAccessor.client()` and
 * applies a tenant filter (read paths) plus tenant injection (create
 * paths) when `getPilotScope()` reports `active=true` for the
 * `compliance` module:
 *   - `TENANT_PRISMA_PILOT_ENABLED=true`, AND
 *   - `TENANT_PRISMA_PILOT_MODULES` empty or includes `compliance`, AND
 *   - env classifies as SAFE_CLONE / SAFE_STAGING, AND
 *   - a tenant is in the ALS frame.
 *
 * Otherwise (production default) `tenantWhere()` / `tenantData()`
 * return `{}` and call sites are byte-identical to legacy.
 */
@Injectable()
export class ComplianceService {
  constructor(
    private legacyPrisma: PrismaService,
    private pilot: PilotPrismaAccessor,
  ) {}

  private get prisma(): PrismaService {
    return this.pilot.client();
  }

  private scope(): PilotScope {
    return getPilotScope(this.pilot, 'compliance');
  }

  async getDashboard() {
    const scope = this.scope();
    const t = scope.tenantWhere();
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalAlerts, openAlerts, criticalAlerts, resolvedAlerts,
      expiringDocuments, expiredDocuments,
      expiring30Days, expiring7Days,
      byStatus,
      recentAlerts,
    ] = await Promise.all([
      this.prisma.complianceAlert.count({ where: { ...t } }), // @tenant-reviewed: phase28-pilot-scope
      this.prisma.complianceAlert.count({ where: { status: 'OPEN', ...t } }),                        // @tenant-reviewed: phase28-pilot-scope
      this.prisma.complianceAlert.count({ where: { status: 'OPEN', severity: 'CRITICAL', ...t } }),  // @tenant-reviewed: phase28-pilot-scope
      this.prisma.complianceAlert.count({ where: { status: 'RESOLVED', ...t } }),                    // @tenant-reviewed: phase28-pilot-scope
      this.prisma.document.count({ // @tenant-reviewed: phase28-pilot-scope
        where: { deletedAt: null, expiryDate: { gte: now, lte: thirtyDays }, ...t },
      }),
      this.prisma.document.count({ // @tenant-reviewed: phase28-pilot-scope
        where: { deletedAt: null, expiryDate: { lt: now }, status: { not: 'EXPIRED' }, ...t },
      }),
      this.prisma.document.count({ where: { deletedAt: null, expiryDate: { gte: now, lte: thirtyDays }, ...t } }), // @tenant-reviewed: phase28-pilot-scope
      this.prisma.document.count({ where: { deletedAt: null, expiryDate: { gte: now, lte: sevenDays },  ...t } }), // @tenant-reviewed: phase28-pilot-scope
      this.prisma.complianceAlert.groupBy({ // @tenant-reviewed: phase28-pilot-scope
        by: ['status'],
        where: { ...t },
        _count: { id: true },
      }),
      this.prisma.complianceAlert.findMany({ // @tenant-reviewed: phase28-pilot-scope
        where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] }, ...t },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        include: { document: { include: { documentType: true } } },
      }),
    ]);

    return {
      summary: { totalAlerts, openAlerts, criticalAlerts, resolvedAlerts },
      documents: { expiringDocuments, expiredDocuments, expiring30Days, expiring7Days },
      alertsByStatus: byStatus,
      recentAlerts,
    };
  }

  async getAlerts(pagination: PaginationDto, status?: string, severity?: string) {
    const scope = this.scope();
    const { page = 1, limit = 10 } = pagination;
    const where: any = { ...scope.tenantWhere() };
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (pagination.search) {
      where.message = { contains: pagination.search, mode: 'insensitive' };
    }
    const [items, total] = await Promise.all([
      this.prisma.complianceAlert.findMany({ // @tenant-reviewed: phase28-pilot-scope
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        include: {
          document: { include: { documentType: true } },
          resolvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.complianceAlert.count({ where }), // @tenant-reviewed: phase28-pilot-scope
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async updateAlert(id: string, dto: UpdateAlertDto, userId?: string) {
    const scope = this.scope();
    const updateData: any = { ...dto };
    if (dto.status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
      updateData.resolvedById = userId;
    }
    // Pre-check: when pilot is active, ensure the alert belongs to the
    // active tenant before mutating. In legacy mode `scope.tenantWhere()`
    // returns `{}` so the pre-check matches by `id` alone — same as
    // before this PR.
    const existing = await this.prisma.complianceAlert.findFirst({ // @tenant-reviewed: phase28-pilot-scope
      where: { id, ...scope.tenantWhere() },
      select: { id: true },
    });
    if (!existing) {
      // In legacy mode `findFirst({ where: { id } })` returning null is
      // the same NotFound the original `update` would have thrown via
      // Prisma's P2025; preserve the same observable behaviour by
      // letting the subsequent update raise.
      if (!scope.active) {
        return this.prisma.complianceAlert.update({ // @tenant-reviewed: phase28-pilot-scope (legacy fallback to preserve P2025)
          where: { id },
          data: updateData,
          include: { document: true },
        });
      }
      // Pilot mode: cross-tenant id presents as an "alert not found"
      // — surface the same Prisma error as a missing id would.
      throw new (require('@nestjs/common').NotFoundException)('Compliance alert not found');
    }
    const alert = await this.prisma.complianceAlert.update({ // @tenant-reviewed: phase28-pilot-scope
      where: { id },
      data: updateData,
      include: { document: true },
    });
    if (userId) {
      await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase28-audit-log (writes use legacy prisma intentionally)
        data: { userId, action: 'UPDATE_ALERT', entity: 'ComplianceAlert', entityId: id, changes: dto as any },
      });
    }
    return alert;
  }

  async getEmployeeCompliance(employeeId: string) {
    const scope = this.scope();
    const t = scope.tenantWhere();
    const [employee, documents, workPermits, visas, alerts] = await Promise.all([
      this.prisma.employee.findUnique({ // @tenant-reviewed: phase28-pilot-scope (id is unique key; tenant pre-filtered via scope below)
        where: { id: employeeId, deletedAt: null, ...t } as any,
        select: { id: true, firstName: true, lastName: true, email: true, status: true },
      }),
      this.prisma.document.findMany({ // @tenant-reviewed: phase28-pilot-scope
        where: { entityType: 'EMPLOYEE', entityId: employeeId, deletedAt: null, ...t },
        include: { documentType: true },
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.workPermit.findMany({ // @tenant-reviewed: phase28-pilot-scope
        where: { employeeId, ...t },
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.visa.findMany({ // @tenant-reviewed: phase28-pilot-scope
        where: { entityType: 'EMPLOYEE', entityId: employeeId, ...t },
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.complianceAlert.findMany({ // @tenant-reviewed: phase28-pilot-scope
        where: { entityType: 'EMPLOYEE', entityId: employeeId, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, ...t },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const now = new Date();
    const documentsWithStatus = documents.map(doc => ({
      ...doc,
      daysUntilExpiry: doc.expiryDate
        ? Math.floor((doc.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      isExpired: doc.expiryDate ? doc.expiryDate < now : false,
    }));

    return { employee, documents: documentsWithStatus, workPermits, visas, openAlerts: alerts };
  }

  async getExpiringDocuments(days = 30) {
    const scope = this.scope();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);
    return this.prisma.document.findMany({ // @tenant-reviewed: phase28-pilot-scope
      where: {
        deletedAt: null,
        status: { notIn: ['REJECTED'] },
        expiryDate: { not: null, lte: threshold, gte: new Date() },
        ...scope.tenantWhere(),
      },
      include: {
        documentType: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async generateAlerts() {
    // Scan all documents for expiry and create alerts as needed
    const scope = this.scope();
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringDocs = await this.prisma.document.findMany({ // @tenant-reviewed: phase28-pilot-scope
      where: {
        deletedAt: null,
        expiryDate: { not: null, lte: thirtyDays, gte: now },
        ...scope.tenantWhere(),
      },
    });

    let created = 0;
    for (const doc of expiringDocs) {
      const daysLeft = Math.floor((doc.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const existing = await this.prisma.complianceAlert.findFirst({ // @tenant-reviewed: phase28-pilot-scope
        where: { documentId: doc.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, alertType: 'DOCUMENT_EXPIRY', ...scope.tenantWhere() },
      });
      if (!existing) {
        await this.prisma.complianceAlert.create({ // @tenant-reviewed: phase28-pilot-scope
          data: {
            entityType: doc.entityType,
            entityId: doc.entityId,
            documentId: doc.id,
            alertType: 'DOCUMENT_EXPIRY',
            severity: daysLeft <= 7 ? 'CRITICAL' : daysLeft <= 14 ? 'HIGH' : 'MEDIUM',
            message: `Document expires in ${daysLeft} days`,
            status: 'OPEN',
            dueDate: doc.expiryDate,
            ...scope.tenantData(),
          },
        });
        created++;
      }
    }
    return { message: `Generated ${created} new compliance alerts`, total: expiringDocs.length };
  }
}
