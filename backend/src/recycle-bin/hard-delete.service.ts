import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../logs/audit-log.service';
import { ENTITY_POLICIES } from './recycle-bin.service';

export interface HardDeleteResult {
  success: boolean;
  entityType: string;
  id: string;
  deleted: Record<string, number>;
  warnings: string[];
}

@Injectable()
export class HardDeleteService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async execute(entityType: string, id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const policy = ENTITY_POLICIES[entityType];
    if (!policy?.canHardDelete) {
      throw new ForbiddenException(`Hard delete is not permitted for entity type: ${entityType}`);
    }

    switch (entityType) {
      case 'APPLICANT':   return this.hardDeleteApplicant(id, actorId, reason);
      case 'EMPLOYEE':    return this.hardDeleteEmployee(id, actorId, reason);
      case 'USER':        return this.hardDeleteUser(id, actorId, reason);
      case 'AGENCY':      return this.hardDeleteAgency(id, actorId, reason);
      case 'DOCUMENT':    return this.hardDeleteDocument(id, actorId, reason);
      case 'DOCUMENT_TYPE': return this.hardDeleteDocumentType(id, actorId, reason);
      case 'JOB_AD':      return this.hardDeleteJobAd(id, actorId, reason);
      case 'FINANCIAL_RECORD': return this.hardDeleteFinancialRecord(id, actorId, reason);
      case 'ROLE':        return this.hardDeleteRole(id, actorId, reason);
      case 'NOTIFICATION': return this.hardDeleteNotification(id, actorId, reason);
      case 'REPORT':      return this.hardDeleteReport(id, actorId, reason);
      default:
        throw new BadRequestException(`No hard-delete handler for entity type: ${entityType}`);
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  private async hardDeleteApplicant(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.applicant.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Applicant ${id} not found`);

    const deleted: Record<string, number> = {};
    const warnings: string[] = [];

    await this.prisma.$transaction(async tx => {
      // Delete compliance alerts first (FK to documents)
      deleted.complianceAlerts = (await tx.complianceAlert.deleteMany({ where: { entityId: id } })).count;

      // Delete documents and their alerts
      const docs = await tx.document.findMany({ where: { entityId: id, entityType: 'APPLICANT' }, select: { id: true } });
      if (docs.length) {
        await tx.complianceAlert.deleteMany({ where: { documentId: { in: docs.map(d => d.id) } } });
        deleted.documents = (await tx.document.deleteMany({ where: { entityId: id, entityType: 'APPLICANT' } })).count;
      }

      // Delete financial attachments then records
      const frs = await tx.financialRecord.findMany({ where: { entityId: id, entityType: 'APPLICANT' }, select: { id: true } });
      if (frs.length) {
        deleted.financialAttachments = (await tx.financialRecordAttachment.deleteMany({
          where: { financialRecordId: { in: frs.map(r => r.id) } },
        })).count;
        deleted.financialRecords = (await tx.financialRecord.deleteMany({ where: { entityId: id, entityType: 'APPLICANT' } })).count;
      }

      // Delete visas
      deleted.visas = (await tx.visa.deleteMany({ where: { entityId: id } })).count;

      // applicant_financial_profiles and applicant_agency_history cascade from applicant
      deleted.applicant = (await tx.applicant.delete({ where: { id } })).id ? 1 : 0;
    });

    await this.logHardDelete('APPLICANT', id, actorId, deleted, reason).catch(() => {});
    warnings.push('Audit logs referencing this applicant are preserved as compliance records.');
    return { success: true, entityType: 'APPLICANT', id, deleted, warnings };
  }

  private async hardDeleteEmployee(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.employee.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Employee ${id} not found`);

    const deleted: Record<string, number> = {};
    const warnings: string[] = [];

    await this.prisma.$transaction(async tx => {
      // Compliance alerts for this entity
      deleted.complianceAlerts = (await tx.complianceAlert.deleteMany({ where: { entityId: id } })).count;

      // Documents and their alerts
      const docs = await tx.document.findMany({ where: { entityId: id, entityType: 'EMPLOYEE' }, select: { id: true } });
      if (docs.length) {
        await tx.complianceAlert.deleteMany({ where: { documentId: { in: docs.map(d => d.id) } } });
        deleted.documents = (await tx.document.deleteMany({ where: { entityId: id, entityType: 'EMPLOYEE' } })).count;
      }

      // Financial records and attachments
      const frs = await tx.financialRecord.findMany({ where: { entityId: id, entityType: 'EMPLOYEE' }, select: { id: true } });
      if (frs.length) {
        deleted.financialAttachments = (await tx.financialRecordAttachment.deleteMany({
          where: { financialRecordId: { in: frs.map(r => r.id) } },
        })).count;
        deleted.financialRecords = (await tx.financialRecord.deleteMany({ where: { entityId: id, entityType: 'EMPLOYEE' } })).count;
      }

      // Visas
      deleted.visas = (await tx.visa.deleteMany({ where: { entityId: id } })).count;

      // EmployeeWorkflowStages and WorkPermits cascade from Employee (onDelete: Cascade)
      // but Prisma deleteMany doesn't trigger cascades — we delete them explicitly
      deleted.workflowStages = (await tx.employeeStage.deleteMany({ where: { employeeId: id } })).count;
      deleted.workPermits = (await tx.workPermit.deleteMany({ where: { employeeId: id } })).count;

      deleted.employee = (await tx.employee.delete({ where: { id } })).id ? 1 : 0;
    });

    await this.logHardDelete('EMPLOYEE', id, actorId, deleted, reason).catch(() => {});
    warnings.push('Audit logs referencing this employee are preserved as compliance records.');
    return { success: true, entityType: 'EMPLOYEE', id, deleted, warnings };
  }

  private async hardDeleteUser(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.user.findUnique({ where: { id }, include: { role: { select: { name: true } } } });
    if (!record) throw new NotFoundException(`User ${id} not found`);

    // Cannot delete self
    if (id === actorId) {
      throw new ForbiddenException('You cannot hard-delete your own account');
    }

    // Cannot delete last System Admin
    if (record.role?.name === 'System Admin') {
      const adminCount = await this.prisma.user.count({
        where: { role: { name: 'System Admin' }, deletedAt: null },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot delete the last System Admin user');
      }
    }

    const deleted: Record<string, number> = {};
    await this.prisma.$transaction(async tx => {
      // Notifications cascade from user but we delete explicitly for count
      deleted.notifications = (await tx.notification.deleteMany({ where: { userId: id } })).count;
      // Null out audit log user references (preserve audit history, just orphan the FK)
      await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
      deleted.user = (await tx.user.delete({ where: { id } })).id ? 1 : 0;
    });

    await this.logHardDelete('USER', id, actorId, deleted, reason).catch(() => {});
    return {
      success: true, entityType: 'USER', id, deleted,
      warnings: ['Audit logs are preserved with user reference nulled out.'],
    };
  }

  private async hardDeleteAgency(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.agency.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Agency ${id} not found`);

    const activeEmployees = await this.prisma.employee.count({ where: { agencyId: id, deletedAt: null } });
    const activeUsers = await this.prisma.user.count({ where: { agencyId: id, deletedAt: null } });
    if (activeEmployees > 0 || activeUsers > 0) {
      throw new BadRequestException(
        `Cannot hard-delete agency: ${activeEmployees} active employee(s) and ${activeUsers} active user(s) still reference it. Reassign or delete them first.`,
      );
    }

    await this.prisma.$transaction(async tx => {
      // Null out soft-deleted employee agency references
      await tx.employee.updateMany({ where: { agencyId: id }, data: { agencyId: null } });
      // Null out applicant agency references
      await tx.applicant.updateMany({ where: { agencyId: id }, data: { agencyId: null } });
      await tx.agency.delete({ where: { id } });
    });

    await this.logHardDelete('AGENCY', id, actorId, { agency: 1 }, reason).catch(() => {});
    return { success: true, entityType: 'AGENCY', id, deleted: { agency: 1 }, warnings: [] };
  }

  private async hardDeleteDocument(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.document.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Document ${id} not found`);

    const deleted: Record<string, number> = {};
    await this.prisma.$transaction(async tx => {
      // Null out renewedFromId references on other documents
      await tx.document.updateMany({ where: { renewedFromId: id }, data: { renewedFromId: null } });
      deleted.complianceAlerts = (await tx.complianceAlert.deleteMany({ where: { documentId: id } })).count;
      deleted.document = (await tx.document.delete({ where: { id } })).id ? 1 : 0;
    });

    await this.logHardDelete('DOCUMENT', id, actorId, deleted, reason).catch(() => {});
    return { success: true, entityType: 'DOCUMENT', id, deleted, warnings: [] };
  }

  private async hardDeleteDocumentType(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.documentType.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`DocumentType ${id} not found`);

    const activeDocs = await this.prisma.document.count({ where: { documentTypeId: id, deletedAt: null } });
    if (activeDocs > 0) {
      throw new BadRequestException(
        `Cannot hard-delete document type: ${activeDocs} active document(s) reference it. Soft-delete or reassign them first.`,
      );
    }

    const deleted: Record<string, number> = {};
    await this.prisma.$transaction(async tx => {
      // Delete soft-deleted documents of this type
      const docs = await tx.document.findMany({ where: { documentTypeId: id }, select: { id: true } });
      if (docs.length) {
        await tx.complianceAlert.deleteMany({ where: { documentId: { in: docs.map(d => d.id) } } });
        deleted.documents = (await tx.document.deleteMany({ where: { documentTypeId: id } })).count;
      }
      deleted.typePermissions = (await tx.documentTypePermission.deleteMany({ where: { documentTypeId: id } })).count;
      deleted.documentType = (await tx.documentType.delete({ where: { id } })).id ? 1 : 0;
    });

    await this.logHardDelete('DOCUMENT_TYPE', id, actorId, deleted, reason).catch(() => {});
    return { success: true, entityType: 'DOCUMENT_TYPE', id, deleted, warnings: [] };
  }

  private async hardDeleteJobAd(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.jobAd.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`JobAd ${id} not found`);

    const deleted: Record<string, number> = {};
    await this.prisma.$transaction(async tx => {
      // Unlink applicants (set jobAdId to null) — don't delete the applicants
      const unlinked = await tx.applicant.updateMany({ where: { jobAdId: id }, data: { jobAdId: null } });
      deleted.unlinkedApplicants = unlinked.count;
      deleted.jobAd = (await tx.jobAd.delete({ where: { id } })).id ? 1 : 0;
    });

    await this.logHardDelete('JOB_AD', id, actorId, deleted, reason).catch(() => {});
    return {
      success: true, entityType: 'JOB_AD', id, deleted,
      warnings: [`${deleted.unlinkedApplicants} applicant(s) were unlinked (not deleted).`],
    };
  }

  private async hardDeleteFinancialRecord(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.financialRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`FinancialRecord ${id} not found`);

    const deleted: Record<string, number> = {};
    await this.prisma.$transaction(async tx => {
      deleted.attachments = (await tx.financialRecordAttachment.deleteMany({ where: { financialRecordId: id } })).count;
      deleted.financialRecord = (await tx.financialRecord.delete({ where: { id } })).id ? 1 : 0;
    });

    await this.logHardDelete('FINANCIAL_RECORD', id, actorId, deleted, reason).catch(() => {});
    return { success: true, entityType: 'FINANCIAL_RECORD', id, deleted, warnings: [] };
  }

  private async hardDeleteRole(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.role.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Role ${id} not found`);

    if (record.isSystem) {
      throw new ForbiddenException('System roles cannot be hard-deleted');
    }

    const assignedUsers = await this.prisma.user.count({ where: { roleId: id, deletedAt: null } });
    if (assignedUsers > 0) {
      throw new BadRequestException(
        `Cannot hard-delete role: ${assignedUsers} active user(s) are assigned this role. Reassign them first.`,
      );
    }

    const deleted: Record<string, number> = {};
    await this.prisma.$transaction(async tx => {
      deleted.rolePermissions = (await tx.rolePermission.deleteMany({ where: { roleId: id } })).count;
      deleted.docTypePermissions = (await tx.documentTypePermission.deleteMany({ where: { roleId: id } })).count;
      deleted.role = (await tx.role.delete({ where: { id } })).id ? 1 : 0;
    });

    await this.logHardDelete('ROLE', id, actorId, deleted, reason).catch(() => {});
    return { success: true, entityType: 'ROLE', id, deleted, warnings: [] };
  }

  private async hardDeleteNotification(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.notification.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Notification ${id} not found`);

    await this.prisma.notification.delete({ where: { id } });
    await this.logHardDelete('NOTIFICATION', id, actorId, { notification: 1 }, reason).catch(() => {});
    return { success: true, entityType: 'NOTIFICATION', id, deleted: { notification: 1 }, warnings: [] };
  }

  private async hardDeleteReport(id: string, actorId: string, reason?: string): Promise<HardDeleteResult> {
    const record = await this.prisma.report.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Report ${id} not found`);

    const deleted: Record<string, number> = {};
    await this.prisma.$transaction(async tx => {
      deleted.filters = (await tx.reportFilter.deleteMany({ where: { reportId: id } })).count;
      deleted.columns = (await tx.reportColumn.deleteMany({ where: { reportId: id } })).count;
      deleted.sorting = (await tx.reportSorting.deleteMany({ where: { reportId: id } })).count;
      deleted.report = (await tx.report.delete({ where: { id } })).id ? 1 : 0;
    });

    await this.logHardDelete('REPORT', id, actorId, deleted, reason).catch(() => {});
    return { success: true, entityType: 'REPORT', id, deleted, warnings: [] };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async logHardDelete(entity: string, entityId: string, actorId: string, deleted: Record<string, number>, reason?: string) {
    await this.auditLog.log({
      userId: actorId,
      action: 'HARD_DELETE',
      entity,
      entityId,
      changes: { deleted, reason: reason ?? null },
    });
  }
}
