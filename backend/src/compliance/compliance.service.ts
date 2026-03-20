import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class ComplianceService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
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
      this.prisma.complianceAlert.count(),
      this.prisma.complianceAlert.count({ where: { status: 'OPEN' } }),
      this.prisma.complianceAlert.count({ where: { status: 'OPEN', severity: 'CRITICAL' } }),
      this.prisma.complianceAlert.count({ where: { status: 'RESOLVED' } }),
      this.prisma.document.count({
        where: { deletedAt: null, expiryDate: { gte: now, lte: thirtyDays } },
      }),
      this.prisma.document.count({
        where: { deletedAt: null, expiryDate: { lt: now }, status: { not: 'EXPIRED' } },
      }),
      this.prisma.document.count({ where: { deletedAt: null, expiryDate: { gte: now, lte: thirtyDays } } }),
      this.prisma.document.count({ where: { deletedAt: null, expiryDate: { gte: now, lte: sevenDays } } }),
      this.prisma.complianceAlert.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.complianceAlert.findMany({
        where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
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
    const { page = 1, limit = 10 } = pagination;
    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (pagination.search) {
      where.message = { contains: pagination.search, mode: 'insensitive' };
    }
    const [items, total] = await Promise.all([
      this.prisma.complianceAlert.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        include: {
          document: { include: { documentType: true } },
          resolvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.complianceAlert.count({ where }),
    ]);
    return new PaginatedResponse(items, total, page, limit);
  }

  async updateAlert(id: string, dto: UpdateAlertDto, userId?: string) {
    const updateData: any = { ...dto };
    if (dto.status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
      updateData.resolvedById = userId;
    }
    const alert = await this.prisma.complianceAlert.update({
      where: { id },
      data: updateData,
      include: { document: true },
    });
    if (userId) {
      await this.prisma.auditLog.create({
        data: { userId, action: 'UPDATE_ALERT', entity: 'ComplianceAlert', entityId: id, changes: dto as any },
      });
    }
    return alert;
  }

  async getEmployeeCompliance(employeeId: string) {
    const [employee, documents, workPermits, visas, alerts] = await Promise.all([
      this.prisma.employee.findUnique({
        where: { id: employeeId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, email: true, status: true },
      }),
      this.prisma.document.findMany({
        where: { entityType: 'EMPLOYEE', entityId: employeeId, deletedAt: null },
        include: { documentType: true },
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.workPermit.findMany({
        where: { employeeId },
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.visa.findMany({
        where: { entityType: 'EMPLOYEE', entityId: employeeId },
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.complianceAlert.findMany({
        where: { entityType: 'EMPLOYEE', entityId: employeeId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
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
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);
    return this.prisma.document.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['REJECTED'] },
        expiryDate: { not: null, lte: threshold, gte: new Date() },
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
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringDocs = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        expiryDate: { not: null, lte: thirtyDays, gte: now },
      },
    });

    let created = 0;
    for (const doc of expiringDocs) {
      const daysLeft = Math.floor((doc.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const existing = await this.prisma.complianceAlert.findFirst({
        where: { documentId: doc.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, alertType: 'DOCUMENT_EXPIRY' },
      });
      if (!existing) {
        await this.prisma.complianceAlert.create({
          data: {
            entityType: doc.entityType,
            entityId: doc.entityId,
            documentId: doc.id,
            alertType: 'DOCUMENT_EXPIRY',
            severity: daysLeft <= 7 ? 'CRITICAL' : daysLeft <= 14 ? 'HIGH' : 'MEDIUM',
            message: `Document expires in ${daysLeft} days`,
            status: 'OPEN',
            dueDate: doc.expiryDate,
          },
        });
        created++;
      }
    }
    return { message: `Generated ${created} new compliance alerts`, total: expiringDocs.length };
  }
}
