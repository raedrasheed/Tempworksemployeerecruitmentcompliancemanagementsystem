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
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Notifications can be restored or permanently deleted',
  },
  REPORT: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Report filters/columns/sorting cascade-delete with report; no separate restore needed',
  },
  VEHICLE: {
    canRestore: true,
    canRestoreWithRelated: true,
    canHardDelete: true,
    relatedEntities: ['VEHICLE_DOCUMENT', 'MAINTENANCE_RECORD'],
    notes: 'Restoring with related also restores soft-deleted vehicle documents and maintenance records',
  },
  VEHICLE_DOCUMENT: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Vehicle document leaf node; no related records to restore',
  },
  MAINTENANCE_RECORD: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Maintenance record leaf node; spare parts cascade-delete with the record',
  },
  MAINTENANCE_TYPE: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Hard delete blocked if active maintenance records reference this type',
  },
  WORKSHOP: {
    canRestore: true,
    canRestoreWithRelated: false,
    canHardDelete: true,
    notes: 'Hard delete blocked if active maintenance records reference this workshop',
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
      docTypes, jobAds, financialRecords, roles, notifications, reports,
      vehicles, vehicleDocs, maintenanceRecords, maintenanceTypes, workshops,
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
      this.getDeletedNotifications(filter, 50),
      this.getDeletedReports(filter, 50),
      this.getDeletedVehicles(filter, 50),
      this.getDeletedVehicleDocuments(filter, 50),
      this.getDeletedMaintenanceRecords(filter, 50),
      this.getDeletedMaintenanceTypes(filter, 50),
      this.getDeletedWorkshops(filter, 50),
    ]);

    records = [
      ...applicants, ...employees, ...users, ...agencies, ...documents,
      ...docTypes, ...jobAds, ...financialRecords, ...roles, ...notifications, ...reports,
      ...vehicles, ...vehicleDocs, ...maintenanceRecords, ...maintenanceTypes, ...workshops,
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
      docTypes, jobAds, financialRecords, roles, notifications, reports,
      vehicles, vehicleDocs, maintenanceRecords, maintenanceTypes, workshops,
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
      this.prisma.notification.count({ where: { deletedAt: { not: null } } }),
      this.prisma.report.count({ where: { deletedAt: { not: null } } }),
      this.prisma.vehicle.count({ where: { deletedAt: { not: null } } }),
      (this.prisma as any).vehicleDocument.count({ where: { deletedAt: { not: null } } }),
      (this.prisma as any).maintenanceRecord.count({ where: { deletedAt: { not: null } } }),
      (this.prisma as any).maintenanceType.count({ where: { deletedAt: { not: null } } }),
      (this.prisma as any).workshop.count({ where: { deletedAt: { not: null } } }),
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
      NOTIFICATION: notifications,
      REPORT: reports,
      VEHICLE: vehicles,
      VEHICLE_DOCUMENT: vehicleDocs,
      MAINTENANCE_RECORD: maintenanceRecords,
      MAINTENANCE_TYPE: maintenanceTypes,
      WORKSHOP: workshops,
      total: applicants + employees + users + agencies + documents + docTypes
        + jobAds + financialRecords + roles + notifications + reports
        + vehicles + vehicleDocs + maintenanceRecords + maintenanceTypes + workshops,
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

    if (entityType === 'VEHICLE') {
      const docs = await (this.prisma as any).vehicleDocument.findMany({
        where: { vehicleId: id, deletedAt: { not: null } },
      });
      const maint = await (this.prisma as any).maintenanceRecord.findMany({
        where: { vehicleId: id, deletedAt: { not: null } },
      });
      relatedRecords.push(...docs.map((d: any) => this.mapVehicleDocument(d)));
      relatedRecords.push(...maint.map((m: any) => this.mapMaintenanceRecord(m)));
      summary.VEHICLE_DOCUMENT = docs.length;
      summary.MAINTENANCE_RECORD = maint.length;
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
        willDelete.workflowStages = await this.prisma.employeeStage.count({ where: { employeeId: id } });
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
      case 'VEHICLE': {
        willDelete.documents = await (this.prisma as any).vehicleDocument.count({ where: { vehicleId: id } });
        willDelete.maintenanceRecords = await (this.prisma as any).maintenanceRecord.count({ where: { vehicleId: id } });
        willDelete.driverAssignments = await this.prisma.vehicleDriverAssignment.count({ where: { vehicleId: id } });
        willDelete.vehicle = 1;
        break;
      }
      case 'VEHICLE_DOCUMENT': {
        willDelete.vehicleDocument = 1;
        break;
      }
      case 'MAINTENANCE_RECORD': {
        willDelete.spareParts = await (this.prisma as any).maintenanceRecordSparePart.count({ where: { maintenanceRecordId: id } });
        willDelete.maintenanceRecord = 1;
        break;
      }
      case 'MAINTENANCE_TYPE': {
        const activeUsage = await (this.prisma as any).maintenanceRecord.count({
          where: { maintenanceTypeId: id, deletedAt: null },
        });
        if (activeUsage > 0) {
          blocked = true;
          blockedReason = `${activeUsage} active maintenance record(s) reference this type. Delete them first.`;
        }
        willDelete.maintenanceType = 1;
        break;
      }
      case 'WORKSHOP': {
        const activeUsage = await (this.prisma as any).maintenanceRecord.count({
          where: { workshopId: id, deletedAt: null },
        });
        if (activeUsage > 0) {
          blocked = true;
          blockedReason = `${activeUsage} active maintenance record(s) reference this workshop. Delete them first.`;
        }
        willDelete.workshop = 1;
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
      case 'NOTIFICATION': {
        const where = this.buildNotificationWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.notification.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapNotification(r))),
          this.prisma.notification.count({ where }),
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
      case 'VEHICLE': {
        const where = this.buildVehicleWhere(filter);
        [data, total] = await Promise.all([
          this.prisma.vehicle.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then(rs => rs.map(r => this.mapVehicle(r))),
          this.prisma.vehicle.count({ where }),
        ]);
        break;
      }
      case 'VEHICLE_DOCUMENT': {
        const where = this.buildVehicleDocWhere(filter);
        [data, total] = await Promise.all([
          (this.prisma as any).vehicleDocument.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then((rs: any[]) => rs.map(r => this.mapVehicleDocument(r))),
          (this.prisma as any).vehicleDocument.count({ where }),
        ]);
        break;
      }
      case 'MAINTENANCE_RECORD': {
        const where = this.buildMaintenanceRecordWhere(filter);
        [data, total] = await Promise.all([
          (this.prisma as any).maintenanceRecord.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then((rs: any[]) => rs.map(r => this.mapMaintenanceRecord(r))),
          (this.prisma as any).maintenanceRecord.count({ where }),
        ]);
        break;
      }
      case 'MAINTENANCE_TYPE': {
        const where = this.buildMaintenanceTypeWhere(filter);
        [data, total] = await Promise.all([
          (this.prisma as any).maintenanceType.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then((rs: any[]) => rs.map((r: any) => this.mapMaintenanceType(r))),
          (this.prisma as any).maintenanceType.count({ where }),
        ]);
        break;
      }
      case 'WORKSHOP': {
        const where = this.buildWorkshopWhere(filter);
        [data, total] = await Promise.all([
          (this.prisma as any).workshop.findMany({ where, orderBy: { deletedAt: sortOrder }, skip, take: Number(limit) })
            .then((rs: any[]) => rs.map((r: any) => this.mapWorkshop(r))),
          (this.prisma as any).workshop.count({ where }),
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

  private async getDeletedNotifications(f: ListDeletedDto, max: number) {
    const where = this.buildNotificationWhere(f);
    const rs = await this.prisma.notification.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapNotification(r));
  }

  private async getDeletedVehicles(f: ListDeletedDto, max: number) {
    const where = this.buildVehicleWhere(f);
    const rs = await this.prisma.vehicle.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map(r => this.mapVehicle(r));
  }

  private async getDeletedVehicleDocuments(f: ListDeletedDto, max: number) {
    const where = this.buildVehicleDocWhere(f);
    const rs = await (this.prisma as any).vehicleDocument.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map((r: any) => this.mapVehicleDocument(r));
  }

  private async getDeletedMaintenanceRecords(f: ListDeletedDto, max: number) {
    const where = this.buildMaintenanceRecordWhere(f);
    const rs = await (this.prisma as any).maintenanceRecord.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map((r: any) => this.mapMaintenanceRecord(r));
  }

  private async getDeletedMaintenanceTypes(f: ListDeletedDto, max: number) {
    const where = this.buildMaintenanceTypeWhere(f);
    const rs = await (this.prisma as any).maintenanceType.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map((r: any) => this.mapMaintenanceType(r));
  }

  private async getDeletedWorkshops(f: ListDeletedDto, max: number) {
    const where = this.buildWorkshopWhere(f);
    const rs = await (this.prisma as any).workshop.findMany({ where, orderBy: { deletedAt: 'desc' }, take: max });
    return rs.map((r: any) => this.mapWorkshop(r));
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

  private buildVehicleWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { registrationNumber: { contains: f.search, mode: 'insensitive' } },
        { make: { contains: f.search, mode: 'insensitive' } },
        { model: { contains: f.search, mode: 'insensitive' } },
        { vin: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildVehicleDocWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { name: { contains: f.search, mode: 'insensitive' } },
        { documentType: { contains: f.search, mode: 'insensitive' } },
        { issuer: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildMaintenanceRecordWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { description: { contains: f.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: f.search, mode: 'insensitive' } },
        { technicianName: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildMaintenanceTypeWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { name: { contains: f.search, mode: 'insensitive' } },
        { description: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildWorkshopWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { name: { contains: f.search, mode: 'insensitive' } },
        { city: { contains: f.search, mode: 'insensitive' } },
        { contactName: { contains: f.search, mode: 'insensitive' } },
        { email: { contains: f.search, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  private buildNotificationWhere(f: ListDeletedDto) {
    const w = this.baseDeletedWhere(f);
    if (f.search) {
      w.OR = [
        { title: { contains: f.search, mode: 'insensitive' } },
        { message: { contains: f.search, mode: 'insensitive' } },
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

  mapVehicle(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.VEHICLE;
    return {
      entityType: 'VEHICLE',
      id: r.id,
      displayName: `${r.make} ${r.model} (${r.registrationNumber})`,
      businessId: r.registrationNumber,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { type: r.type, status: r.status, vin: r.vin },
    };
  }

  mapVehicleDocument(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.VEHICLE_DOCUMENT;
    return {
      entityType: 'VEHICLE_DOCUMENT',
      id: r.id,
      displayName: r.name,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { documentType: r.documentType, vehicleId: r.vehicleId, issuer: r.issuer },
    };
  }

  mapMaintenanceType(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.MAINTENANCE_TYPE;
    return {
      entityType: 'MAINTENANCE_TYPE',
      id: r.id,
      displayName: r.name,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { description: r.description },
    };
  }

  mapMaintenanceRecord(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.MAINTENANCE_RECORD;
    return {
      entityType: 'MAINTENANCE_RECORD',
      id: r.id,
      displayName: r.description ?? r.invoiceNumber ?? `Maintenance ${r.id.slice(0, 8)}`,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { status: r.status, vehicleId: r.vehicleId, cost: r.cost },
    };
  }

  mapWorkshop(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.WORKSHOP;
    return {
      entityType: 'WORKSHOP',
      id: r.id,
      displayName: r.name,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { city: r.city, contactName: r.contactName, phone: r.phone, email: r.email },
    };
  }

  mapNotification(r: any): DeletedRecord {
    const policy = ENTITY_POLICIES.NOTIFICATION;
    return {
      entityType: 'NOTIFICATION',
      id: r.id,
      displayName: r.title,
      deletedAt: r.deletedAt,
      deletedBy: r.deletedBy ?? undefined,
      deletionReason: r.deletionReason ?? undefined,
      canRestore: policy.canRestore,
      canRestoreWithRelated: policy.canRestoreWithRelated,
      canHardDelete: policy.canHardDelete,
      relatedDeletedCount: 0,
      extra: { message: r.message, type: r.type, eventType: r.eventType, userId: r.userId },
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
        } else if (rec.entityType === 'VEHICLE') {
          const [docs, maint] = await Promise.all([
            (this.prisma as any).vehicleDocument.count({ where: { vehicleId: rec.id, deletedAt: { not: null } } }),
            (this.prisma as any).maintenanceRecord.count({ where: { vehicleId: rec.id, deletedAt: { not: null } } }),
          ]);
          rec.relatedDeletedCount = docs + maint;
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
