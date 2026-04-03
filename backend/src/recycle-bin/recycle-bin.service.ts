import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListDeletedDto } from './dto/list-deleted.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

// ── Deletion policy registry ──────────────────────────────────────────────────
// Defines what operations are permitted per entity type.
// canRestoreWithRelated: true only if related records have their own deletedAt
//   and can be safely re-activated alongside the parent.
export const ENTITY_POLICIES: Record<
  string,
  {
    canRestore: boolean;
    canRestoreWithRelated: boolean;
    canHardDelete: boolean;
    relatedEntities?: string[];
    notes?: string;
  }
> = {
  APPLICANT: {
    canRestore: true,
    canRestoreWithRelated: true,
    canHardDelete: true,
    relatedEntities: ['DOCUMENT', 'FINANCIAL_RECORD'],
    notes: 'Restoring with related restores documents & financial records for this applicant',
  },
  EMPLOYEE: {
    canRestore: true,
    canRestoreWithRelated: true,
    canHardDelete: true,
    relatedEntities: ['DOCUMENT', 'FINANCIAL_RECORD'],
    notes: 'Work permits/workflow stages use cascade-delete and cannot be independently restored',
  },
  USER: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Restores main user record only; role-permission mappings are managed separately',
  },
  AGENCY: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Hard delete blocked if active employees/users belong to the agency',
  },
  DOCUMENT: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Documents are leaf nodes; no related records to restore',
  },
  DOCUMENT_TYPE: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Hard delete blocked if live (non-deleted) documents reference this type',
  },
  JOB_AD: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Hard delete unlinks applicants before removing the job ad',
  },
  FINANCIAL_RECORD: {
    canRestore: true,
    canRestoreWithRelated: true,
    canHardDelete: true,
    relatedEntities: ['FINANCIAL_ATTACHMENT'],
    notes: 'Restoring with related also restores financial record attachments',
  },
  ROLE: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Hard delete blocked if users are currently assigned this role',
  },
  NOTIFICATION: {
    canRestore: false,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Notifications are transient; restore is not meaningful',
  },
  REPORT: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Report filters/columns/sorting cascade-delete with report; no separate restore needed',
  },
};

export interface DeletedRecord {
  entityType: string;
  id: string;
  displayName: string;
  businessId?: string;
  deletedAt: Date;
  deletedBy?: string;
  deletedByName?: string;
  deletionReason?: string;
  canRestore: boolean;
  canRestoreWithRelated: boolean;
  canHardDelete: boolean;
  relatedDeletedCount: number;
  extra?: Record<string, any>;
}

@Injectable()
export class RecycleBinService {
  constructor(private prisma: PrismaService) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  async findAll(filter: ListDeletedDto): Promise<PaginatedResponse<DeletedRecord>> {
    const { page = 1, limit = 20, sortOrder = 'desc', entityType } = filter;

    let records: DeletedRecord[] = [];

    if (entityType) {
      // Single entity type — paginate properly
      return this.findByEntityType(entityType, filter);
    }

    // All entity types — load up to 50 per type and combine
    const [
      applicants, employees, users, agencies, documents,
      docTypes, jobAds, financialRecords, roles, reports,
    ] = await Promise.all([
      this.getDeletedApplicants(filter, 50),
      this.getDeletedEmployees(filter, 50),
      this.getDeletedUsers(filter, 50),
      this.getDeletedAgencies(filter, 50),
      this.getDeletedDocuments(filter, 50),
      this.getDeletedDocumentTypes(filter, 50),
      this.getDeletedJobAds(filter, 50),
      this.getDeletedFinancialRecords(filter, 50),
      this.getDeletedRoles(filter, 50),
      this.getDeletedReports(filter, 50),
    ]);

    records = [
      ...applicants, ...employees, ...users, ...agencies, ...documents,
      ...docTypes, ...jobAds, ...financialRecords, ...roles, ...reports,
    ];

    records.sort((a, b) => {
      const diff = new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
      return sortOrder === 'desc' ? -diff : diff;
    });

    const total = records.length;
    const skip = (Number(page) - 1) * Number(limit);
    const data = records.slice(skip, skip + Number(limit));

    return PaginatedResponse.create(data, total, Number(page), Number(limit));
  }

  async getEntityCounts(): Promise<Record<string, number>> {
    const [
      applicants, employees, users, agencies, documents,
      docTypes, jobAds, financialRecords, roles, reports,
    ] = await Promise.all([
      this.prisma.applicant.count({ where: { deletedAt: { not: null } } }),
      this.prisma.employee.count({ where: { deletedAt: { not: null } } }),
      this.prisma.user.count({ where: { deletedAt: { not: null } } }),
      this.prisma.agency.count({ where: { deletedAt: { not: null } } }),
      this.prisma.document.count({ where: { deletedAt: { not: null } } }),
      this.prisma.documentType.count({ where: { deletedAt: { not: null } } }),
      this.prisma.jobAd.count({ where: { deletedAt: { not: null } } }),
      this.prisma.financialRecord.count({ where: { deletedAt: { not: null } } }),
      this.prisma.role.count({ where: { deletedAt: { not: null } } }),
      this.prisma.report.count({ where: { deletedAt: { not: null } } }),
    ]);

    return {
      APPLICANT: applicants,
      EMPLOYEE: employees,
      USER: users,
      AGENCY: agencies,
      DOCUMENT: documents,
      DOCUMENT_TYPE: docTypes,
      JOB_AD: jobAds,
      FINANCIAL_RECORD: financialRecords,
      ROLE: roles,
      REPORT: reports,
      total: applicants + employees + users + agencies + documents + docTypes
        + jobAds + financialRecords + roles + reports,
    };
  }

  async getRelatedDeletedData(entityType: string, id: string): Promise<{
    relatedRecords: DeletedRecord[];
    summary: Record<string, number>;
  }> {
    const relatedRecords: DeletedRecord[] = [];
    const summary: Record<string, number> = {};

    if (entityType === 'APPLICANT' || entityType === 'EMPLOYEE') {
      const entityTypeEnum = entityType === 'APPLICANT' ? 'APPLICANT' : 'EMPLOYEE';

      const docs = await this.prisma.document.findMany({
        where: { entityId: id, entityType: entityTypeEnum as any, deletedAt: { not: null } },
        include: { documentType: { select: { name: true } }, uploadedBy: { select: { firstName: true, lastName: true } } },
      });
      const financials = await this.prisma.financialRecord.findMany({
        where: { entityId: id, entityType: entityTypeEnum, deletedAt: { not: null } },
      });

      relatedRecords.push(...docs.map(d => this.mapDocument(d)));
      relatedRecords.push(...financials.map(f => this.mapFinancialRecord(f)));
      summary.DOCUMENT = docs.length;
      summary.FINANCIAL_RECORD = financials.length;
    }

    if (entityType === 'FINANCIAL_RECORD') {
      const attachments = await this.prisma.financialRecordAttachment.findMany({
        where: { financialRecordId: id, deletedAt: { not: null } },
      });
      summary.FINANCIAL_ATTACHMENT = attachments.length;
    }

    return {
      relatedRecords,
      summary,
    };
  }

  async previewHardDelete(entityType: string, id: string): Promise<{
    canDelete: boolean;
    blockedReason?: string;
    willDelete: Record<string, number>;
    totalRecords: number;
  }> {
    const policy = ENTITY_POLICIES[entityType];
    if (!policy?.canHardDelete) {
      return { canDelete: false, blockedReason: 'Hard delete not permitted for this entity type', willDelete: {}, totalRecords: 0 };
    }

    const willDelete: Record<string, number> = {};
    let blocked = false;
    let blockedReason = '';

    switch (entityType) {
      case 'APPLICANT': {
        willDelete.documents = await this.prisma.document.count({ where: { entityId: id, entityType: 'APPLICANT' } });
        willDelete.financialRecords = await this.prisma.financialRecord.count({ where: { entityId: id, entityType: 'APPLICANT' } });
        willDelete.financialAttachments = await this.countAttachmentsForEntity(id, 'APPLICANT');
        willDelete.complianceAlerts = await this.prisma.complianceAlert.count({ where: { entityId: id } });
        willDelete.visas = await this.prisma.visa.count({ where: { entityId: id } });
        willDelete.applicant = 1;
        break;
      }
      case 'EMPLOYEE': {
        willDelete.documents = await this.prisma.document.count({ where: { entityId: id, entityType: 'EMPLOYEE' } });
        willDelete.financialRecords = await this.prisma.financialRecord.count({ where: { entityId: id, entityType: 'EMPLOYEE' } });
        willDelete.financialAttachments = await this.countAttachmentsForEntity(id, 'EMPLOYEE');
        willDelete.complianceAlerts = await this.prisma.complianceAlert.count({ where: { entityId: id } });
        willDelete.workflowStages = await this.prisma.employeeWorkflowStage.count({ where: { employeeId: id } });
        willDelete.workPermits = await this.prisma.workPermit.count({ where: { employeeId: id } });
        willDelete.visas = await this.prisma.visa.count({ where: { entityId: id } });
        willDelete.employee = 1;
        break;
      }
      case 'USER': {
        const user = await this.prisma.user.findUnique({ where: { id }, include: { role: { select: { name: true } } } });
        if (user?.role?.name === 'System Admin') {
          const adminCount = await this.prisma.user.count({
            where: { role: { name: 'System Admin' }, deletedAt: null },
          });
          if (adminCount <= 1) {
            blocked = true;
            blockedReason = 'Cannot delete the last System Admin user';
          }
        }
        willDelete.notifications = await this.prisma.notification.count({ where: { userId: id } });
        willDelete.user = 1;
        break;
      }
      case 'AGENCY': {
        const activeEmployees = await this.prisma.employee.count({ where: { agencyId: id, deletedAt: null } });
        const activeUsers = await this.prisma.user.count({ where: { agencyId: id, deletedAt: null } });
        if (activeEmployees > 0 || activeUsers > 0) {
          blocked = true;
          blockedReason = `Agency has ${activeEmployees} active employee(s) and ${activeUsers} active user(s). Reassign or delete them first.`;
        }
        willDelete.agency = 1;
        break;
      }
      case 'DOCUMENT': {
        willDelete.complianceAlerts = await this.prisma.complianceAlert.count({ where: { documentId: id } });
        willDelete.document = 1;
        break;
      }
      case 'DOCUMENT_TYPE': {
        const activeDocs = await this.prisma.document.count({ where: { documentTypeId: id, deletedAt: null } });
        if (activeDocs > 0) {
          blocked = true;
          blockedReason = `${activeDocs} active document(s) reference this type. Archive or delete them first.`;
        }
        willDelete.deletedDocuments = await this.prisma.document.count({ where: { documentTypeId: id } });
        willDelete.documentType = 1;
        break;
      }
      case 'JOB_AD': {
        willDelete.linkedApplicants = await this.prisma.applicant.count({ where: { jobAdId: id } });
        willDelete.jobAd = 1;
        break;
      }
      case 'FINANCIAL_RECORD': {
        willDelete.attachments = await this.prisma.financialRecordAttachment.count({ where: { financialRecordId: id } });
        willDelete.financialRecord = 1;
        break;
      }
      case 'ROLE': {
        const assignedUsers = await this.prisma.user.count({ where: { roleId: id, deletedAt: null } });
        if (assignedUsers > 0) {
          blocked = true;
          blockedReason = `${assignedUsers} active user(s) are assigned this role. Reassign them first.`;
        }
        willDelete.rolePermissions = await this.prisma.rolePermission.count({ where: { roleId: id } });
        willDelete.role = 1;
        break;
      }
      case 'REPORT': {
        willDelete.filters = await this.prisma.reportFilter.count({ where: { reportId: id } });
        willDelete.columns = await this.prisma.reportColumn.count({ where: { reportId: id } });
        willDelete.sorting = await this.prisma.reportSorting.count({ where: { reportId: id } });
        willDelete.report = 1;
        break;
      }
      default:
        willDelete.record = 1;
    }

    const totalRecords = Object.values(willDelete).reduce((s, n) => s + n, 0);
    return {
      canDelete: !blocked,
      blockedReason: blocked ? blockedReason : undefined,
      willDelete,
      totalRecords,
    };
  }

  // ── Entity-type queries ─────────────────────────────────────────────────────

  private async findByEntityType(entityType: string, filter: ListDeletedDto): Promise<PaginatedResponse<DeletedRecord>> {
    const { page = 1, limit = 20, sortOrder = 'desc' } = filter;
    const skip = (Number(page) - 1) * Number(limit);

    let data: DeletedRecord[] = [];
    let total = 0;

    switch (entityType) {
      case 'APPLICANT': {
        const where = this.buildApplicantWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.applicant.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapApplicant(r))),
          this.prisma.applicant.count({ where }),
        ]);
        break;
      }
      case 'EMPLOYEE': {
        const where = this.buildEmployeeWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.employee.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapEmployee(r))),
          this.prisma.employee.count({ where }),
        ]);
        break;
      }
      case 'USER': {
        const where = this.buildUserWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.user.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapUser(r))),
          this.prisma.user.count({ where }),
        ]);
        break;
      }
      case 'AGENCY': {
        const where = this.buildAgencyWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.agency.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapAgency(r))),
          this.prisma.agency.count({ where }),
        ]);
        break;
      }
      case 'DOCUMENT': {
        const where = this.buildDocumentWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.document.findMany({
            where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit),
            include: { documentType: { select: { name: true } }, uploadedBy: { select: { firstName: true, lastName: true } } },
          }).then(rs => rs.map(r => this.mapDocument(r))),
          this.prisma.document.count({ where }),
        ]);
        break;
      }
      case 'DOCUMENT_TYPE': {
        const where = this.buildDocumentTypeWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.documentType.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapDocumentType(r))),
          this.prisma.documentType.count({ where }),
        ]);
        break;
      }
      case 'JOB_AD': {
        const where = this.buildJobAdWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.jobAd.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapJobAd(r))),
          this.prisma.jobAd.count({ where }),
        ]);
        break;
      }
      case 'FINANCIAL_RECORD': {
        const where = this.buildFinancialRecordWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.financialRecord.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapFinancialRecord(r))),
          this.prisma.financialRecord.count({ where }),
        ]);
        break;
      }
      case 'ROLE': {
        const where = this.buildRoleWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.role.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapRole(r))),
          this.prisma.role.count({ where }),
        ]);
        break;
      }
      case 'REPORT': {
        const where = this.buildReportWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.report.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapReport(r))),
          this.prisma.report.count({ where }),
        ]);
        break;
      }
    }

    // Enrich with related deleted counts
    data = await this.enrichRelatedCounts(data);

    return PaginatedResponse.create(data, total, Number(page), Number(limit));
  }

  // ── Batch loaders (for "all types" view) ───────────────────────────────────

  private async getDeletedApplicants(f: ListDeletedDto, max: number) {
    const where = this.buildApplicantWhere(f);
    const rs = await this.prisma.applicant.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapApplicant(r));
  }

  private async getDeletedEmployees(f: ListDeletedDto, max: number) {
    const where = this.buildEmployeeWhere(f);
    const rs = await this.prisma.employee.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapEmployee(r));
  }

  private async getDeletedUsers(f: ListDeletedDto, max: number) {
    const where = this.buildUserWhere(f);
    const rs = await this.prisma.user.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapUser(r));
  }

  private async getDeletedAgencies(f: ListDeletedDto, max: number) {
    const where = this.buildAgencyWhere(f);
    const rs = await this.prisma.agency.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapAgency(r));
  }

  private async getDeletedDocuments(f: ListDeletedDto, max: number) {
    const where = this.buildDocumentWhere(f);
    const rs = await this.prisma.document.findMany({
      where, orderBy: { deletedAt: 'desc' }, take: max,
      include: { documentType: { select: { name: true } }, uploadedBy: { select: { firstName: true, lastName: true } } },
    });
    return rs.map(r => this.mapDocument(r));
  }

  private async getDeletedDocumentTypes(f: ListDeletedDto, max: number) {
    const where = this.buildDocumentTypeWhere(f);
    const rs = await this.prisma.documentType.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapDocumentType(r));
  }

  private async getDeletedJobAds(f: ListDeletedDto, max: number) {
    const where = this.buildJobAdWhere(f);
    const rs = await this.prisma.jobAd.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapJobAd(r));
  }

  private async getDeletedFinancialRecords(f: ListDeletedDto, max: number) {
    const where = this.buildFinancialRecordWhere(f);
    const rs = await this.prisma.financialRecord.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapFinancialRecord(r));
  }

  private async getDeletedRoles(f: ListDeletedDto, max: number) {
    const where = this.buildRoleWhere(f);
    const rs = await this.prisma.role.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapRole(r));
  }

  private async getDeletedReports(f: ListDeletedDto, max: number) {
    const where = this.buildReportWhere(f);
    const rs = await this.prisma.report.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapReport(r));
  }

  // ── WHERE clause builders ───────────────────────────────────────────────────

  private baseDeletedWhere(f: ListDeletedDto) {
    const w: any = { deletedAt: { not: null } };
    if (f.deletedFrom || f.deletedTo) {
      w.deletedAt = { not: null };
      if (f.deletedFrom) w.deletedAt.gte = new Date(f.deletedFrom);
      if (f.deletedTo) w.deletedAt.lte = new Date(f.deletedTo);
    }
    if (f.deletedById) w.deletedBy = f.deletedById;
    return w;
  }

  private buildApplicantWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { firstName: { contains: f.search, mode: 'insensitive' } },
        { lastName: { contains: f.search, mode: 'insensitive' } },
        { email: { contains: f.search, mode: 'insensitive' } },
        { leadNumber: { contains: f.search, mode: 'insensitive' } },
        { candidateNumber: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildEmployeeWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { firstName: { contains: f.search, mode: 'insensitive' } },
        { lastName: { contains: f.search, mode: 'insensitive' } },
        { email: { contains: f.search, mode: 'insensitive' } },
        { employeeNumber: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildUserWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { firstName: { contains: f.search, mode: 'insensitive' } },
        { lastName: { contains: f.search, mode: 'insensitive' } },
        { email: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildAgencyWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { name: { contains: f.search, mode: 'insensitive' } },
        { email: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildDocumentWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { name: { contains: f.search, mode: 'insensitive' } },
        { docId: { contains: f.search, mode: 'insensitive' } },
        { documentNumber: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildDocumentTypeWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { name: { contains: f.search, mode: 'insensitive' } },
        { category: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildJobAdWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { title: { contains: f.search, mode: 'insensitive' } },
        { slug: { contains: f.search, mode: 'insensitive' } },
        { category: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildFinancialRecordWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { transactionType: { contains: f.search, mode: 'insensitive' } },
        { description: { contains: f.search, mode: 'insensitive' } },
        { paidByName: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildRoleWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { name: { contains: f.search, mode: 'insensitive' } },
        { description: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildReportWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { name: { contains: f.search, mode: 'insensitive' } },
        { description: { contains: f.search, mode: 'insensitive' } },
        { dataSource: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  // ── Mappers ─────────────────────────────────────────────────────────────────

  mapApplicant(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.APPLICANT;
    return {
      entityType: 'APPLICANT',
      id: r.id,
      displayName: `${r.firstName} ${r.lastName}`,
      businessId: r.candidateNumber ?? r.leadNumber ?? undefined,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { email: r.email, tier: r.tier, status: r.status },
    };
  }

  mapEmployee(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.EMPLOYEE;
    return {
      entityType: 'EMPLOYEE',
      id: r.id,
      displayName: `${r.firstName} ${r.lastName}`,
      businessId: r.employeeNumber ?? undefined,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { email: r.email, status: r.status },
    };
  }

  mapUser(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.USER;
    return {
      entityType: 'USER',
      id: r.id,
      displayName: `${r.firstName} ${r.lastName}`,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { email: r.email },
    };
  }

  mapAgency(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.AGENCY;
    return {
      entityType: 'AGENCY',
      id: r.id,
      displayName: r.name,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { country: r.country, email: r.email },
    };
  }

  mapDocument(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.DOCUMENT;
    return {
      entityType: 'DOCUMENT',
      id: r.id,
      displayName: r.name,
      businessId: r.docId ?? undefined,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: {
        documentType: r.documentType?.name ?? 'Unknown',
        entityType: r.entityType,
        entityId: r.entityId,
        status: r.status,
      },
    };
  }

  mapDocumentType(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.DOCUMENT_TYPE;
    return {
      entityType: 'DOCUMENT_TYPE',
      id: r.id,
      displayName: r.name,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { category: r.category, code: r.code },
    };
  }

  mapJobAd(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.JOB_AD;
    return {
      entityType: 'JOB_AD',
      id: r.id,
      displayName: r.title,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { category: r.category, status: r.status, city: r.city },
    };
  }

  mapFinancialRecord(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.FINANCIAL_RECORD;
    return {
      entityType: 'FINANCIAL_RECORD',
      id: r.id,
      displayName: `${r.transactionType} — ${r.currency} ${Number(r.companyDisbursedAmount).toFixed(2)}`,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { entityType: r.entityType, entityId: r.entityId, status: r.status },
    };
  }

  mapRole(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.ROLE;
    return {
      entityType: 'ROLE',
      id: r.id,
      displayName: r.name,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { isSystem: r.isSystem },
    };
  }

  mapReport(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.REPORT;
    return {
      entityType: 'REPORT',
      id: r.id,
      displayName: r.name,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { dataSource: r.dataSource },
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async enrichRelatedCounts(records: DeletedRecord[]): Promise<DeletedRecord[]> {
    await Promise.all(
      records.map(async rec => {
        if (rec.entityType === 'APPLICANT' || rec.entityType === 'EMPLOYEE') {
          const entityTypeEnum = rec.entityType as any;
          const [docs, financials] = await Promise.all([
            this.prisma.document.count({ where: { entityId: rec.id, entityType: entityTypeEnum, deletedAt: { not: null } } }),
            this.prisma.financialRecord.count({ where: { entityId: rec.id, entityType: rec.entityType, deletedAt: { not: null } } }),
          ]);
          rec.relatedDeletedCount = docs + financials;
        } else if (rec.entityType === 'FINANCIAL_RECORD') {
          rec.relatedDeletedCount = await this.prisma.financialRecordAttachment.count({
            where: { financialRecordId: rec.id, deletedAt: { not: null } },
          });
        }
      }),
    );
    return records;
  }

  private async countAttachmentsForEntity(entityId: string, entityType: string): Promise<number> {
    const records = await this.prisma.financialRecord.findMany({
      where: { entityId, entityType },
      select: { id: true },
    });
    if (records.length === 0) return 0;
    return this.prisma.financialRecordAttachment.count({
      where: { financialRecordId: { in: records.map(r => r.id) } },
    });
  }
}
