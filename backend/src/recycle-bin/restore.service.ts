import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../logs/audit-log.service';
import { ENTITY_POLICIES } from './recycle-bin.service';

export interface RestoreResult {
  success: boolean;
  entityType: string;
  id: string;
  restored: Record<string, number>;
  skipped: Record<string, string>;
  warnings: string[];
}

@Injectable()
export class RestoreService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  // ── Main restore entry point ────────────────────────────────────────────────

  async restore(entityType: string, id: string, actorId: string, withRelated: boolean, reason?: string): Promise<RestoreResult> {
    const policy = ENTITY_POLICIES[entityType];
    if (!policy) {
      throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
    if (!policy.canRestore) {
      throw new BadRequestException(`Restore is not permitted for entity type: ${entityType}`);
    }
    if (withRelated && !policy.canRestoreWithRelated) {
      throw new BadRequestException(`Restore-with-related is not permitted for entity type: ${entityType}`);
    }

    switch (entityType) {
      case 'APPLICANT':   return this.restoreApplicant(id, actorId, withRelated, reason);
      case 'EMPLOYEE':    return this.restoreEmployee(id, actorId, withRelated, reason);
      case 'USER':        return this.restoreUser(id, actorId, reason);
      case 'AGENCY':      return this.restoreAgency(id, actorId, reason);
      case 'DOCUMENT':    return this.restoreDocument(id, actorId, reason);
      case 'DOCUMENT_TYPE': return this.restoreDocumentType(id, actorId, reason);
      case 'JOB_AD':      return this.restoreJobAd(id, actorId, reason);
      case 'FINANCIAL_RECORD': return this.restoreFinancialRecord(id, actorId, withRelated, reason);
      case 'ROLE':        return this.restoreRole(id, actorId, reason);
      case 'REPORT':      return this.restoreReport(id, actorId, reason);
      default:
        throw new BadRequestException(`No restore handler for entity type: ${entityType}`);
    }
  }

  // ── Restore handlers ────────────────────────────────────────────────────────

  private async restoreApplicant(id: string, actorId: string, withRelated: boolean, reason?: string): Promise<RestoreResult> {
    const record = await this.prisma.applicant.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Applicant ${id} not found`);
    if (!record.deletedAt) throw new ConflictException('Applicant is not deleted');

    // Check unique email conflict
    const emailConflict = await this.prisma.applicant.findFirst({
      where: { email: record.email, deletedAt: null, id: { not: id } },
    });
    if (emailConflict) {
      throw new ConflictException(`Cannot restore: email ${record.email} is already in use by another applicant`);
    }

    const restored: Record<string, number> = { applicant: 0 };
    const skipped: Record<string, string> = {};
    const warnings: string[] = [];

    await this.prisma.$transaction(async tx => {
      await tx.applicant.update({ where: { id }, data: { deletedAt: null, deletedBy: null, deletionReason: null } });
      restored.applicant = 1;

      if (withRelated) {
        const docs = await tx.document.updateMany({
          where: { entityId: id, entityType: 'APPLICANT', deletedAt: { not: null } },
          data: { deletedAt: null, deletedBy: null, deletionReason: null },
        });
        restored.documents = docs.count;

        const frs = await tx.financialRecord.updateMany({
          where: { entityId: id, entityType: 'APPLICANT', deletedAt: { not: null } },
          data: { deletedAt: null, deletedBy: null, deletionReason: null },
        });
        restored.financialRecords = frs.count;

        // Restore attachments for restored financial records
        const frIds = await tx.financialRecord
          .findMany({ where: { entityId: id, entityType: 'APPLICANT' }, select: { id: true } })
          .then(rs => rs.map(r => r.id));
        if (frIds.length > 0) {
          const atts = await tx.financialRecordAttachment.updateMany({
            where: { financialRecordId: { in: frIds }, deletedAt: { not: null } },
            data: { deletedAt: null, deletedBy: null, deletionReason: null },
          });
          restored.financialAttachments = atts.count;
        }
      }
    });

    await this.logRestore('APPLICANT', id, actorId, restored, reason).catch(() => {});
    return { success: true, entityType: 'APPLICANT', id, restored, skipped, warnings };
  }

  private async restoreEmployee(id: string, actorId: string, withRelated: boolean, reason?: string): Promise<RestoreResult> {
    const record = await this.prisma.employee.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Employee ${id} not found`);
    if (!record.deletedAt) throw new ConflictException('Employee is not deleted');

    const emailConflict = await this.prisma.employee.findFirst({
      where: { email: record.email, deletedAt: null, id: { not: id } },
    });
    if (emailConflict) {
      throw new ConflictException(`Cannot restore: email ${record.email} is already in use by another employee`);
    }

    const restored: Record<string, number> = { employee: 0 };
    const skipped: Record<string, string> = {};
    const warnings: string[] = [];

    await this.prisma.$transaction(async tx => {
      await tx.employee.update({ where: { id }, data: { deletedAt: null, deletedBy: null, deletionReason: null } });
      restored.employee = 1;

      if (withRelated) {
        const docs = await tx.document.updateMany({
          where: { entityId: id, entityType: 'EMPLOYEE', deletedAt: { not: null } },
          data: { deletedAt: null, deletedBy: null, deletionReason: null },
        });
        restored.documents = docs.count;

        const frs = await tx.financialRecord.updateMany({
          where: { entityId: id, entityType: 'EMPLOYEE', deletedAt: { not: null } },
          data: { deletedAt: null, deletedBy: null, deletionReason: null },
        });
        restored.financialRecords = frs.count;
      }

      warnings.push('WorkPermit and EmployeeWorkflowStage records use cascade-delete and cannot be restored independently.');
    });

    await this.logRestore('EMPLOYEE', id, actorId, restored, reason).catch(() => {});
    return { success: true, entityType: 'EMPLOYEE', id, restored, skipped, warnings };
  }

  private async restoreUser(id: string, actorId: string, reason?: string): Promise<RestoreResult> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`User ${id} not found`);
    if (!record.deletedAt) throw new ConflictException('User is not deleted');

    const emailConflict = await this.prisma.user.findFirst({
      where: { email: record.email, deletedAt: null, id: { not: id } },
    });
    if (emailConflict) {
      throw new ConflictException(`Cannot restore: email ${record.email} is already in use by another user`);
    }

    // Check that the role still exists (not deleted)
    const role = await this.prisma.role.findUnique({ where: { id: record.roleId } });
    if (!role || role.deletedAt) {
      throw new ConflictException(`Cannot restore: user's role no longer exists. Assign a valid role first.`);
    }

    // Check that the agency still exists
    const agency = await this.prisma.agency.findUnique({ where: { id: record.agencyId } });
    if (!agency || agency.deletedAt) {
      throw new ConflictException(`Cannot restore: user's agency no longer exists. Reassign agency first.`);
    }

    await this.prisma.user.update({ where: { id }, data: { deletedAt: null, deletedBy: null, deletionReason: null } });
    await this.logRestore('USER', id, actorId, { user: 1 }, reason).catch(() => {});
    return { success: true, entityType: 'USER', id, restored: { user: 1 }, skipped: {}, warnings: [] };
  }

  private async restoreAgency(id: string, actorId: string, reason?: string): Promise<RestoreResult> {
    const record = await this.prisma.agency.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Agency ${id} not found`);
    if (!record.deletedAt) throw new ConflictException('Agency is not deleted');

    await this.prisma.agency.update({ where: { id }, data: { deletedAt: null, deletedBy: null, deletionReason: null } });
    await this.logRestore('AGENCY', id, actorId, { agency: 1 }, reason).catch(() => {});
    return { success: true, entityType: 'AGENCY', id, restored: { agency: 1 }, skipped: {}, warnings: [] };
  }

  private async restoreDocument(id: string, actorId: string, reason?: string): Promise<RestoreResult> {
    const record = await this.prisma.document.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Document ${id} not found`);
    if (!record.deletedAt) throw new ConflictException('Document is not deleted');

    // Verify the parent entity still exists
    const parentExists = await this.checkParentEntityExists(record.entityType as string, record.entityId);
    const warnings: string[] = [];
    if (!parentExists) {
      warnings.push(`Parent entity (${record.entityType} ${record.entityId}) is soft-deleted or no longer exists.`);
    }

    await this.prisma.document.update({ where: { id }, data: { deletedAt: null, deletedBy: null, deletionReason: null } });
    await this.logRestore('DOCUMENT', id, actorId, { document: 1 }, reason).catch(() => {});
    return { success: true, entityType: 'DOCUMENT', id, restored: { document: 1 }, skipped: {}, warnings };
  }

  private async restoreDocumentType(id: string, actorId: string, reason?: string): Promise<RestoreResult> {
    const record = await this.prisma.documentType.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`DocumentType ${id} not found`);
    if (!record.deletedAt) throw new ConflictException('DocumentType is not deleted');

    // Check name uniqueness
    const nameConflict = await this.prisma.documentType.findFirst({
      where: { name: record.name, deletedAt: null, id: { not: id } },
    });
    if (nameConflict) {
      throw new ConflictException(`Cannot restore: a document type named "${record.name}" already exists`);
    }

    await this.prisma.documentType.update({ where: { id }, data: { deletedAt: null, deletedBy: null, deletionReason: null } });
    await this.logRestore('DOCUMENT_TYPE', id, actorId, { documentType: 1 }, reason).catch(() => {});
    return { success: true, entityType: 'DOCUMENT_TYPE', id, restored: { documentType: 1 }, skipped: {}, warnings: [] };
  }

  private async restoreJobAd(id: string, actorId: string, reason?: string): Promise<RestoreResult> {
    const record = await this.prisma.jobAd.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`JobAd ${id} not found`);
    if (!record.deletedAt) throw new ConflictException('JobAd is not deleted');

    // Check slug uniqueness
    const slugConflict = await this.prisma.jobAd.findFirst({
      where: { slug: record.slug, deletedAt: null, id: { not: id } },
    });
    const warnings: string[] = [];
    if (slugConflict) {
      warnings.push(`Slug "${record.slug}" is already taken. The job ad will be restored but may need slug update.`);
    }

    await this.prisma.jobAd.update({
      where: { id },
      data: { deletedAt: null, deletedBy: null, deletionReason: null, status: 'DRAFT' },
    });
    await this.logRestore('JOB_AD', id, actorId, { jobAd: 1 }, reason).catch(() => {});
    return { success: true, entityType: 'JOB_AD', id, restored: { jobAd: 1 }, skipped: {}, warnings };
  }

  private async restoreFinancialRecord(id: string, actorId: string, withRelated: boolean, reason?: string): Promise<RestoreResult> {
    const record = await this.prisma.financialRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`FinancialRecord ${id} not found`);
    if (!record.deletedAt) throw new ConflictException('FinancialRecord is not deleted');

    const restored: Record<string, number> = {};

    await this.prisma.$transaction(async tx => {
      await tx.financialRecord.update({ where: { id }, data: { deletedAt: null, deletedBy: null, deletionReason: null } });
      restored.financialRecord = 1;

      if (withRelated) {
        const atts = await tx.financialRecordAttachment.updateMany({
          where: { financialRecordId: id, deletedAt: { not: null } },
          data: { deletedAt: null, deletedBy: null, deletionReason: null },
        });
        restored.attachments = atts.count;
      }
    });

    await this.logRestore('FINANCIAL_RECORD', id, actorId, restored, reason).catch(() => {});
    return { success: true, entityType: 'FINANCIAL_RECORD', id, restored, skipped: {}, warnings: [] };
  }

  private async restoreRole(id: string, actorId: string, reason?: string): Promise<RestoreResult> {
    const record = await this.prisma.role.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Role ${id} not found`);
    if (!record.deletedAt) throw new ConflictException('Role is not deleted');

    const nameConflict = await this.prisma.role.findFirst({
      where: { name: record.name, deletedAt: null, id: { not: id } },
    });
    if (nameConflict) {
      throw new ConflictException(`Cannot restore: a role named "${record.name}" already exists`);
    }

    await this.prisma.role.update({ where: { id }, data: { deletedAt: null, deletedBy: null, deletionReason: null } });
    await this.logRestore('ROLE', id, actorId, { role: 1 }, reason).catch(() => {});
    return { success: true, entityType: 'ROLE', id, restored: { role: 1 }, skipped: {}, warnings: [] };
  }

  private async restoreReport(id: string, actorId: string, reason?: string): Promise<RestoreResult> {
    const record = await this.prisma.report.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Report ${id} not found`);
    if (!record.deletedAt) throw new ConflictException('Report is not deleted');

    const nameConflict = await this.prisma.report.findFirst({
      where: { name: record.name, deletedAt: null, id: { not: id } },
    });
    const warnings: string[] = [];
    if (nameConflict) {
      warnings.push(`Report name "${record.name}" is already in use. Rename after restoring.`);
    }

    await this.prisma.report.update({ where: { id }, data: { deletedAt: null, deletedBy: null, deletionReason: null } });
    await this.logRestore('REPORT', id, actorId, { report: 1 }, reason).catch(() => {});
    return { success: true, entityType: 'REPORT', id, restored: { report: 1 }, skipped: {}, warnings };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async checkParentEntityExists(entityType: string, entityId: string): Promise<boolean> {
    if (entityType === 'APPLICANT') {
      const a = await this.prisma.applicant.findUnique({ where: { id: entityId }, select: { deletedAt: true } });
      return !!a && !a.deletedAt;
    }
    if (entityType === 'EMPLOYEE') {
      const e = await this.prisma.employee.findUnique({ where: { id: entityId }, select: { deletedAt: true } });
      return !!e && !e.deletedAt;
    }
    return true; // unknown type: allow
  }

  private async logRestore(entity: string, entityId: string, actorId: string, restored: Record<string, number>, reason?: string) {
    await this.auditLog.log({
      userId: actorId,
      action: 'RESTORE',
      entity,
      entityId,
      changes: { restored, reason: reason ?? null },
    });
  }
}
