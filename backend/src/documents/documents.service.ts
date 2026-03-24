import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { extname, join } from 'path';
import { promises as fs } from 'fs';
import AdmZip = require('adm-zip');
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { VerifyDocumentDto, VerifyActionEnum } from './dto/verify-document.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  /** Strip characters that are unsafe in filenames; collapse repeated underscores. */
  private sanitize(raw: string): string {
    return raw
      .replace(/[^a-zA-Z0-9\-]/g, '_') // replace everything except letters, digits, hyphens
      .replace(/_+/g, '_')              // collapse repeated underscores
      .replace(/^_|_$/g, '');           // trim leading/trailing underscores
  }

  /** Resolve a human-readable entity name from the entity type + id. */
  private async resolveEntityName(entityType: string, entityId: string): Promise<string> {
    try {
      switch (entityType) {
        case 'EMPLOYEE': {
          const e = await this.prisma.employee.findUnique({
            where: { id: entityId },
            select: { firstName: true, lastName: true },
          });
          return e ? `${e.firstName} ${e.lastName}` : '';
        }
        case 'APPLICANT': {
          const a = await this.prisma.applicant.findUnique({
            where: { id: entityId },
            select: { firstName: true, lastName: true },
          });
          return a ? `${a.firstName} ${a.lastName}` : '';
        }
        case 'AGENCY': {
          const ag = await this.prisma.agency.findUnique({
            where: { id: entityId },
            select: { name: true },
          });
          return ag ? ag.name : '';
        }
        case 'USER': {
          const u = await this.prisma.user.findUnique({
            where: { id: entityId },
            select: { firstName: true, lastName: true },
          });
          return u ? `${u.firstName} ${u.lastName}` : '';
        }
        default:
          return '';
      }
    } catch {
      return '';
    }
  }

  private get docInclude() {
    return {
      documentType: true,
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({ where, skip, take: Number(limit), orderBy: { [sortBy]: sortOrder }, include: this.docInclude }),
      this.prisma.document.count({ where }),
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id, deletedAt: null }, include: this.docInclude });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  async findByEntity(entityType: string, entityId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const where = { entityType: entityType as any, entityId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: this.docInclude }),
      this.prisma.document.count({ where }),
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  /** Public upload: resolve document type by name (case-insensitive), fall back to first available.
   *  Attributes the upload to the first System Admin user found in the DB. */
  async publicCreate(
    file: Express.Multer.File,
    entityId: string,
    name: string,
    documentTypeName: string,
  ) {
    let docType = await this.prisma.documentType.findFirst({
      where: { name: { equals: documentTypeName, mode: 'insensitive' } },
    });
    if (!docType) {
      docType = await this.prisma.documentType.findFirst({ orderBy: { createdAt: 'asc' } });
    }
    if (!docType) throw new BadRequestException('No document types configured');

    // Try System Admin first, then fall back to any active user
    let systemUser = await this.prisma.user.findFirst({
      where: { role: { name: 'System Admin' }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!systemUser) {
      systemUser = await this.prisma.user.findFirst({
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!systemUser) throw new BadRequestException('No users found to attribute upload to');

    const entityName  = await this.resolveEntityName('APPLICANT', entityId);
    const ts          = Date.now();
    const ext         = extname(file.originalname);
    const safeEntity  = this.sanitize(entityName) || 'Applicant';
    const safeDocType = this.sanitize(docType.name) || 'Others';
    const folderName  = `${safeEntity}_${ts}`;
    const newFilename = `${safeEntity}_${safeDocType}_${ts}${ext}`;
    const newDir      = join(file.destination, folderName, safeDocType);

    await fs.mkdir(newDir, { recursive: true });
    await fs.rename(file.path, join(newDir, newFilename));

    const fileUrl = `/uploads/${folderName}/${safeDocType}/${newFilename}`;
    return this.prisma.document.create({
      data: {
        name,
        documentTypeId: docType.id,
        entityType: 'APPLICANT' as any,
        entityId,
        fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: 'PENDING',
        uploadedById: systemUser.id,
      },
      include: this.docInclude,
    });
  }

  async create(
    dto: CreateDocumentDto,
    file: Express.Multer.File,
    uploadedById: string,
  ) {
    const docType = await this.prisma.documentType.findUnique({ where: { id: dto.documentTypeId } });
    if (!docType) throw new NotFoundException('Document type not found');

    // Build semantic filename and folder structure:
    //   uploads/{EntityName}_{ts}/{DocumentType}/{EntityName}_{DocumentType}_{ts}.ext
    const entityName   = await this.resolveEntityName(dto.entityType, dto.entityId);
    const ts           = Date.now();
    const ext          = extname(file.originalname);
    const safeEntity   = this.sanitize(entityName)  || 'Others';
    const safeDocType  = this.sanitize(docType?.name) || 'Others';
    const folderName   = `${safeEntity}_${ts}`;
    const newFilename  = `${safeEntity}_${safeDocType}_${ts}${ext}`;
    const newDir       = join(file.destination, folderName, safeDocType);

    await fs.mkdir(newDir, { recursive: true });
    await fs.rename(file.path, join(newDir, newFilename));

    const fileUrl = `/uploads/${folderName}/${safeDocType}/${newFilename}`;
    const doc = await this.prisma.document.create({
      data: {
        name: dto.name,
        documentTypeId: dto.documentTypeId,
        entityType: dto.entityType as any,
        entityId: dto.entityId,
        fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: 'PENDING',
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        issuer: dto.issuer,
        documentNumber: dto.documentNumber,
        notes: dto.notes,
        uploadedById,
      },
      include: this.docInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: uploadedById,
        action: 'UPLOAD',
        entity: 'Document',
        entityId: doc.id,
        changes: { name: dto.name, entityType: dto.entityType, entityId: dto.entityId } as any,
      },
    });

    // Check for expiry compliance
    if (dto.expiryDate) {
      const expiry = new Date(dto.expiryDate);
      const now = new Date();
      const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 30) {
        await this.prisma.complianceAlert.create({
          data: {
            entityType: dto.entityType as any,
            entityId: dto.entityId,
            documentId: doc.id,
            alertType: 'DOCUMENT_EXPIRY',
            severity: daysUntilExpiry <= 7 ? 'CRITICAL' : daysUntilExpiry <= 14 ? 'HIGH' : 'MEDIUM',
            message: `Document "${dto.name}" expires in ${daysUntilExpiry} days`,
            status: 'OPEN',
            dueDate: expiry,
          },
        });
      }
    }
    return doc;
  }

  async update(id: string, updateData: Partial<CreateDocumentDto>, updatedById?: string) {
    await this.findOne(id);
    const data: any = { ...updateData };
    if (updateData.issueDate) data.issueDate = new Date(updateData.issueDate);
    if (updateData.expiryDate) data.expiryDate = new Date(updateData.expiryDate);
    const doc = await this.prisma.document.update({ where: { id }, data, include: this.docInclude });
    if (updatedById) {
      await this.prisma.auditLog.create({
        data: { userId: updatedById, action: 'UPDATE', entity: 'Document', entityId: id },
      });
    }
    return doc;
  }

  async verify(id: string, dto: VerifyDocumentDto, verifiedById: string) {
    const doc = await this.findOne(id);

    if (doc.status !== 'PENDING') {
      throw new BadRequestException(
        `Document is already ${doc.status.charAt(0) + doc.status.slice(1).toLowerCase()} and cannot be re-verified`,
      );
    }

    const newStatus = dto.action === VerifyActionEnum.VERIFY ? 'VERIFIED' : 'REJECTED';
    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        status: newStatus as any,
        verifiedById,
        verifiedAt: new Date(),
        notes: dto.reason
          ? `${doc.notes || ''}\nVerification note: ${dto.reason}`.trim()
          : doc.notes,
      },
      include: this.docInclude,
    });

    // On approval, auto-resolve compliance alerts and check stage auto-completion
    if (dto.action === VerifyActionEnum.VERIFY) {
      await this.prisma.complianceAlert.updateMany({
        where: { documentId: id, status: 'OPEN' },
        data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: verifiedById },
      });
      await this.checkAndAutoCompleteStage(doc.entityType as string, doc.entityId, verifiedById);
    }

    await this.prisma.auditLog.create({
      data: {
        userId: verifiedById,
        action: dto.action === VerifyActionEnum.VERIFY ? 'VERIFY_DOCUMENT' : 'REJECT_DOCUMENT',
        entity: 'Document',
        entityId: id,
        changes: { status: newStatus, reason: dto.reason } as any,
      },
    });
    return updated;
  }

  /**
   * After a document is verified, check whether all required documents for the
   * entity's current workflow stage are now VERIFIED. If so, auto-complete the
   * stage and advance the entity to the next stage.
   */
  private async checkAndAutoCompleteStage(
    entityType: string,
    entityId: string,
    actorId: string,
  ): Promise<void> {
    // 1. Resolve the entity's current stage ID
    let currentStageId: string | null = null;

    if (entityType === 'EMPLOYEE') {
      const inProgress = await this.prisma.employeeWorkflowStage.findFirst({
        where: { employeeId: entityId, status: 'IN_PROGRESS' },
      });
      currentStageId = inProgress?.stageId ?? null;
    } else if (entityType === 'APPLICANT') {
      const applicant = await this.prisma.applicant.findUnique({
        where: { id: entityId, deletedAt: null },
        select: { currentWorkflowStageId: true },
      });
      currentStageId = applicant?.currentWorkflowStageId ?? null;
    }

    if (!currentStageId) return;

    // 2. Get the stage's required document type names
    const stage = await this.prisma.workflowStage.findUnique({
      where: { id: currentStageId },
      select: { id: true, order: true, requirementsDocuments: true },
    });

    if (!stage || stage.requirementsDocuments.length === 0) return;

    // 3. Check which required document types are VERIFIED for this entity
    const verifiedDocs = await this.prisma.document.findMany({
      where: { entityType: entityType as any, entityId, status: 'VERIFIED', deletedAt: null },
      include: { documentType: { select: { name: true } } },
    });

    const verifiedNames = new Set((verifiedDocs as any[]).map(d => d.documentType.name));
    const allMet = stage.requirementsDocuments.every(req => verifiedNames.has(req));

    if (!allMet) return;

    // 4. Find the next active stage
    const nextStage = await this.prisma.workflowStage.findFirst({
      where: { order: { gt: stage.order }, isActive: true },
      orderBy: { order: 'asc' },
    });

    // 5. Complete current stage and advance
    if (entityType === 'EMPLOYEE') {
      await this.prisma.employeeWorkflowStage.updateMany({
        where: { employeeId: entityId, stageId: currentStageId, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (nextStage) {
        await this.prisma.employeeWorkflowStage.upsert({
          where: { employeeId_stageId: { employeeId: entityId, stageId: nextStage.id } },
          create: { employeeId: entityId, stageId: nextStage.id, status: 'IN_PROGRESS', startedAt: new Date() },
          update: { status: 'IN_PROGRESS', startedAt: new Date(), completedAt: null },
        });
      }
    } else if (entityType === 'APPLICANT') {
      await this.prisma.applicant.update({
        where: { id: entityId },
        data: { currentWorkflowStageId: nextStage?.id ?? currentStageId },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'WORKFLOW_STAGE_AUTO_COMPLETE',
        entity: entityType === 'EMPLOYEE' ? 'Employee' : 'Applicant',
        entityId,
        changes: {
          completedStageId: currentStageId,
          autoCompleted: true,
          nextStageId: nextStage?.id ?? null,
        } as any,
      },
    });
  }

  async remove(id: string, deletedById?: string) {
    await this.findOne(id);
    await this.prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
    if (deletedById) {
      await this.prisma.auditLog.create({
        data: { userId: deletedById, action: 'DELETE', entity: 'Document', entityId: id },
      });
    }
    return { message: 'Document deleted' };
  }

  /**
   * Builds an in-memory ZIP buffer containing each requested document.
   * ZIP structure: {EntityName}/{DocumentType}/{filename}.ext
   *   - All documents for the same person are grouped under one folder.
   *   - If two docs of the same type share the same name, a numeric
   *     suffix is appended to avoid silent overwrites.
   */
  async createBulkDownloadArchive(ids: string[]): Promise<Buffer> {
    const docs = await this.prisma.document.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: { documentType: { select: { name: true } } },
    });

    // Resolve entity names up-front (deduplicate look-ups by entityId)
    const entityIds = [...new Set(docs.map(d => d.entityId))];
    const nameMap: Record<string, string> = {};
    await Promise.all(
      entityIds.map(async (eid) => {
        const doc = docs.find(d => d.entityId === eid)!;
        const name = await this.resolveEntityName(doc.entityType as string, eid);
        nameMap[eid] = this.sanitize(name || doc.entityType);
      }),
    );

    const zip = new AdmZip();

    // Track used ZIP entry paths so we never silently overwrite a file
    const usedPaths = new Set<string>();

    for (const doc of docs) {
      const diskPath = join(
        process.cwd(),
        doc.fileUrl.startsWith('/') ? doc.fileUrl.slice(1) : doc.fileUrl,
      );

      let content: Buffer;
      try {
        await fs.access(diskPath);
        content = await fs.readFile(diskPath);
      } catch {
        continue; // file missing on disk — skip gracefully
      }

      // Build a clean, human-readable ZIP entry:
      //   {EntityName}/{DocumentType}/{doc.name}{ext}
      const entityFolder = nameMap[doc.entityId] || 'Unknown';
      const typeFolder   = this.sanitize((doc as any).documentType?.name || 'Documents');
      const ext          = doc.fileUrl.includes('.')
        ? '.' + doc.fileUrl.split('.').pop()!
        : '';
      const baseName     = this.sanitize(doc.name) || 'document';
      let entryPath      = `${entityFolder}/${typeFolder}/${baseName}${ext}`;

      // Deduplicate: append counter if path already used
      if (usedPaths.has(entryPath)) {
        let counter = 2;
        while (usedPaths.has(`${entityFolder}/${typeFolder}/${baseName}_${counter}${ext}`)) {
          counter++;
        }
        entryPath = `${entityFolder}/${typeFolder}/${baseName}_${counter}${ext}`;
      }
      usedPaths.add(entryPath);

      zip.addFile(entryPath, content);
    }

    return zip.toBuffer();
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
      include: this.docInclude,
      orderBy: { expiryDate: 'asc' },
    });
  }
}
