import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalEmployees, activeEmployees, newEmployeesThisMonth,
      totalApplicants, newApplicantsThisMonth,
      openAlerts, criticalAlerts,
      expiringDocuments,
      employeesByStatus,
      applicantsByStatus,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.applicant.count({ where: { deletedAt: null } }),
      this.prisma.applicant.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.complianceAlert.count({ where: { status: 'OPEN' } }),
      this.prisma.complianceAlert.count({ where: { status: 'OPEN', severity: 'CRITICAL' } }),
      this.prisma.document.count({ where: { deletedAt: null, expiryDate: { gte: now, lte: thirtyDaysAhead } } }),
      this.prisma.employee.groupBy({ by: ['status'], _count: { id: true }, where: { deletedAt: null } }),
      this.prisma.applicant.groupBy({ by: ['status'], _count: { id: true }, where: { deletedAt: null } }),
    ]);

    return {
      employees: { total: totalEmployees, active: activeEmployees, newThisMonth: newEmployeesThisMonth, byStatus: employeesByStatus },
      applicants: { total: totalApplicants, newThisMonth: newApplicantsThisMonth, byStatus: applicantsByStatus },
      compliance: { openAlerts, criticalAlerts, expiringDocuments },
    };
  }

  async getEmployeeReport(pagination: any) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where: { deletedAt: null },
        skip,
        take: Number(limit),
        select: {
          id: true, firstName: true, lastName: true, email: true,
          nationality: true, status: true, licenseCategory: true,
          yearsExperience: true, createdAt: true,
          agency: { select: { name: true, country: true } },
          _count: { select: { workPermits: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where: { deletedAt: null } }),
    ]);
    return { data: employees, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getApplicationsReport(pagination: any) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const [applicants, total] = await Promise.all([
      this.prisma.applicant.findMany({
        where: { deletedAt: null },
        skip,
        take: Number(limit),
        select: {
          id: true, firstName: true, lastName: true, email: true,
          nationality: true, status: true, createdAt: true,
          jobType: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.applicant.count({ where: { deletedAt: null } }),
    ]);
    return { data: applicants, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDocumentsReport(pagination: any) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();
    const [documents, total, expiredCount, verifiedCount, pendingCount] = await Promise.all([
      this.prisma.document.findMany({
        where: { deletedAt: null },
        skip, take: Number(limit),
        include: { documentType: true, uploadedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where: { deletedAt: null } }),
      this.prisma.document.count({ where: { deletedAt: null, expiryDate: { lt: now } } }),
      this.prisma.document.count({ where: { deletedAt: null, status: 'VERIFIED' } }),
      this.prisma.document.count({ where: { deletedAt: null, status: 'PENDING' } }),
    ]);
    return { data: documents, total, expiredCount, verifiedCount, pendingCount, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getComplianceReport(pagination: any) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const [alerts, total] = await Promise.all([
      this.prisma.complianceAlert.findMany({
        skip, take: Number(limit),
        include: {
          document: { include: { documentType: true } },
          resolvedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.complianceAlert.count(),
    ]);
    const byStatus = await this.prisma.complianceAlert.groupBy({ by: ['status'], _count: { id: true } });
    const bySeverity = await this.prisma.complianceAlert.groupBy({ by: ['severity'], _count: { id: true } });
    return { data: alerts, total, byStatus, bySeverity, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAgenciesReport(pagination: any) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const [agencies, total] = await Promise.all([
      this.prisma.agency.findMany({
        where: { deletedAt: null },
        skip, take: Number(limit),
        include: { _count: { select: { employees: true, users: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.agency.count({ where: { deletedAt: null } }),
    ]);
    return { data: agencies, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async exportReport(type: string) {
    // Returns data for CSV/Excel export
    switch (type) {
      case 'employees':
        return this.prisma.employee.findMany({
          where: { deletedAt: null },
          select: {
            firstName: true, lastName: true, email: true, phone: true,
            nationality: true, status: true, licenseCategory: true, licenseNumber: true,
            yearsExperience: true, city: true, country: true, createdAt: true,
            agency: { select: { name: true } },
          },
          orderBy: { lastName: 'asc' },
        });
      case 'applicants':
        return this.prisma.applicant.findMany({
          where: { deletedAt: null },
          select: {
            firstName: true, lastName: true, email: true, phone: true,
            nationality: true, status: true, residencyStatus: true,
            availability: true, createdAt: true,
            jobType: { select: { name: true } },
          },
          orderBy: { lastName: 'asc' },
        });
      case 'documents':
        return this.prisma.document.findMany({
          where: { deletedAt: null },
          select: {
            name: true, entityType: true, entityId: true, status: true,
            issueDate: true, expiryDate: true, issuer: true, documentNumber: true, createdAt: true,
            documentType: { select: { name: true, category: true } },
          },
          orderBy: { expiryDate: 'asc' },
        });
      default:
        return { message: `Export type '${type}' not supported` };
    }
  }
}
