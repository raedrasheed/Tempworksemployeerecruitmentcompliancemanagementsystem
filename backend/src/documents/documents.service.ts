import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { join } from 'path';
import { promises as fs } from 'fs';
import AdmZip = require('adm-zip');
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIF_EVENTS } from '../notifications/notification-events';
import { DocumentIdService } from './document-id.service';
import { PilotPrismaAccessor } from '../saas/prisma/pilot-prisma.accessor';
import { getPilotScope, PilotScope } from '../saas/prisma/tenant-pilot-scope';
import { CreateDocumentDto } from './dto/create-document.dto';
import { VerifyDocumentDto, VerifyActionEnum } from './dto/verify-document.dto';
import { FilterDocumentsDto } from './dto/filter-documents.dto';
import { RenewDocumentDto } from './dto/renew-document.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

// Roles that receive document notifications
const DOC_NOTIFY_ROLES = ['System Admin', 'HR Manager', 'Compliance Officer'];

/**
 * Phase 2.20 — Documents reads-first pilot.
 *
 * READ paths route through `pilot.client()` and spread
 * `scope.tenantWhere()` when the pilot scope is active. Production
 * default (flag off) is byte-identical to pre-2.20.
 *
 * WRITE / mutation paths (create / update / verify / renew /
 * remove / upsertDocTypePermission / checkAndAutoCompleteStage)
 * and storage-fetch paths (`createBulkDownloadArchive`) explicitly
 * use `legacyPrisma` and remain annotated
 * `phase220-excluded-mutation` / `phase220-excluded-download`
 * until follow-up pilots audit them.
 *
 * `DocumentType` and `DocumentTypePermission` are tenant-less
 * catalogs in the current schema; their reads/writes are
 * `phase220-global`. Per-tenant catalog overrides are a Phase 3
 * product question.
 *
 * Audit-log writes use `legacyPrisma` always (`phase220-audit-log`).
 *
 * The pilot scope is active iff:
 *   - `TENANT_PRISMA_PILOT_ENABLED=true`
 *   - `TENANT_PRISMA_PILOT_MODULES` empty or includes `documents`
 *   - env classifies as SAFE_CLONE / SAFE_STAGING
 *   - a tenant is in the active ALS frame
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly legacyPrisma: PrismaService,
    private readonly documentIdService: DocumentIdService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly pilot: PilotPrismaAccessor,
  ) {}

  /** Pilot-aware Prisma surface used by READ paths only. Mutation
   *  paths use `legacyPrisma` directly. */
  private get prisma(): PrismaService {
    return this.pilot.client();
  }

  private scope(): PilotScope {
    return getPilotScope(this.pilot, 'documents');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Read a stored document's bytes for the bulk-download ZIP. Handles
   * both Spaces public URLs (HTTP fetch) and legacy `/uploads/...`
   * paths (local fs read), so the archive keeps working during the
   * gradual migration window.
   */
  private async fetchDocumentBuffer(fileUrl: string): Promise<Buffer> {
    if (/^https?:\/\//i.test(fileUrl)) {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${fileUrl}`);
      return Buffer.from(await res.arrayBuffer());
    }
    // Legacy `/uploads/<rest>` URLs are served by express.static from
    // `<cwd>/uploads`. Mirror that exact mapping here so the bulk-download
    // ZIP keeps working for historical rows during the Spaces migration.
    const rel = fileUrl.startsWith('/uploads/')
      ? fileUrl.slice('/uploads/'.length)
      : fileUrl.replace(/^\/+/, '');
    const diskPath = join(process.cwd(), 'uploads', rel);
    await fs.access(diskPath);
    return fs.readFile(diskPath);
  }

  private sanitize(raw: string): string {
    return raw
      .replace(/[^a-zA-Z0-9\-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private async resolveEntityName(entityType: string, entityId: string): Promise<string> {
    try {
      switch (entityType) {
        case 'EMPLOYEE': {
          const e = await this.legacyPrisma.employee.findUnique({ where: { id: entityId }, select: { firstName: true, lastName: true } }); // @tenant-reviewed: phase220-excluded-helper
          return e ? `${e.firstName} ${e.lastName}` : '';
        }
        case 'APPLICANT': {
          const a = await this.legacyPrisma.applicant.findUnique({ where: { id: entityId }, select: { firstName: true, lastName: true } }); // @tenant-reviewed: phase220-excluded-helper
          return a ? `${a.firstName} ${a.lastName}` : '';
        }
        case 'AGENCY': {
          const ag = await this.legacyPrisma.agency.findUnique({ where: { id: entityId }, select: { name: true } }); // @tenant-reviewed: phase220-excluded-helper
          return ag ? ag.name : '';
        }
        case 'USER': {
          const u = await this.legacyPrisma.user.findUnique({ where: { id: entityId }, select: { firstName: true, lastName: true } }); // @tenant-reviewed: phase220-excluded-helper
          return u ? `${u.firstName} ${u.lastName}` : '';
        }
        default: return '';
      }
    } catch { return ''; }
  }

  private get docInclude() {
    return {
      documentType: { select: { id: true, name: true, code: true, category: true, trackExpiry: true, renewalPeriodDays: true } },
      uploadedBy:  { select: { id: true, firstName: true, lastName: true } },
      verifiedBy:  { select: { id: true, firstName: true, lastName: true } },
      renewedFrom: { select: { id: true, docId: true, name: true, status: true } },
    };
  }

  // ── Build WHERE clause from FilterDocumentsDto ─────────────────────────────

  private buildWhere(filter: FilterDocumentsDto): any {
    const where: any = { deletedAt: null };

    if (filter.search) {
      where.OR = [
        { name:           { contains: filter.search, mode: 'insensitive' } },
        { documentNumber: { contains: filter.search, mode: 'insensitive' } },
        { docId:          { contains: filter.search, mode: 'insensitive' } },
        { issuer:         { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.status)         where.status         = filter.status;
    if (filter.documentTypeId) where.documentTypeId = filter.documentTypeId;
    if (filter.entityType)     where.entityType     = filter.entityType;
    if (filter.entityId)       where.entityId       = filter.entityId;
    if (filter.uploadedById)   where.uploadedById   = filter.uploadedById;
    if (filter.verifiedById)   where.verifiedById   = filter.verifiedById;

    if (filter.docId)
      where.docId = { contains: filter.docId, mode: 'insensitive' };
    if (filter.documentNumber)
      where.documentNumber = { contains: filter.documentNumber, mode: 'insensitive' };

    // Date range filters
    if (filter.issueDateFrom || filter.issueDateTo) {
      where.issueDate = {};
      if (filter.issueDateFrom) where.issueDate.gte = new Date(filter.issueDateFrom);
      if (filter.issueDateTo)   where.issueDate.lte = new Date(filter.issueDateTo);
    }
    if (filter.expiryDateFrom || filter.expiryDateTo) {
      where.expiryDate = {};
      if (filter.expiryDateFrom) where.expiryDate.gte = new Date(filter.expiryDateFrom);
      if (filter.expiryDateTo)   where.expiryDate.lte = new Date(filter.expiryDateTo);
    }

    return where;
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async findAll(filter: FilterDocumentsDto) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = filter;
    const skip  = (Number(page) - 1) * Number(limit);
    const t = this.scope().tenantWhere();
    const where = { ...this.buildWhere(filter), ...t };

    // Validate sort field to prevent injection
    const allowedSorts = [
      'createdAt', 'updatedAt', 'name', 'status', 'issueDate',
      'expiryDate', 'documentNumber', 'docId', 'verifiedAt',
    ];
    const orderField = allowedSorts.includes(sortBy) ? sortBy : 'createdAt';

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({ // @tenant-reviewed: phase220-pilot-scope
        where, skip, take: Number(limit),
        orderBy: { [orderField]: sortOrder },
        include: this.docInclude,
      }),
      this.prisma.document.count({ where }), // @tenant-reviewed: phase220-pilot-scope
    ]);

    // Batch-resolve owner names to avoid N+1 queries
    const empIds = [...new Set(items.filter(d => d.entityType === 'EMPLOYEE').map(d => d.entityId))];
    const appIds = [...new Set(items.filter(d => d.entityType === 'APPLICANT').map(d => d.entityId))];
    const [emps, apps] = await Promise.all([
      empIds.length ? this.prisma.employee.findMany({ where: { id: { in: empIds }, ...t }, select: { id: true, firstName: true, lastName: true, employeeNumber: true } }) : [], // @tenant-reviewed: phase220-pilot-scope
      appIds.length ? this.prisma.applicant.findMany({ where: { id: { in: appIds }, ...t }, select: { id: true, firstName: true, lastName: true, candidateNumber: true, leadNumber: true } }) : [], // @tenant-reviewed: phase220-pilot-scope
    ]);
    const empMap = Object.fromEntries(emps.map(e => [e.id, e]));
    const appMap = Object.fromEntries(apps.map(a => [a.id, a]));

    const enriched = items.map(doc => {
      if (doc.entityType === 'EMPLOYEE') {
        const e = empMap[doc.entityId];
        return { ...doc, ownerName: e ? `${e.firstName} ${e.lastName}` : null, ownerSystemId: e?.employeeNumber ?? null };
      }
      if (doc.entityType === 'APPLICANT') {
        const a = appMap[doc.entityId];
        return { ...doc, ownerName: a ? `${a.firstName} ${a.lastName}` : null, ownerSystemId: a?.candidateNumber ?? a?.leadNumber ?? null };
      }
      return { ...doc, ownerName: null, ownerSystemId: null };
    });

    return PaginatedResponse.create(enriched, total, page, limit);
  }

  async findOne(id: string) {
    const t = this.scope().tenantWhere();
    // findFirst (was findUnique) so we can additionally constrain by
    // tenantId in pilot mode. Legacy behaviour identical when t={}.
    const doc = await this.prisma.document.findFirst({ // @tenant-reviewed: phase220-pilot-scope
      where: { id, deletedAt: null, ...t },
      include: {
        ...this.docInclude,
        renewals: { select: { id: true, docId: true, name: true, status: true, createdAt: true } },
      },
    });
    if (!doc) throw new NotFoundException({ code: 'DOCUMENT.NOT_FOUND', message: `Document ${id} not found`, params: { id } });
    return doc;
  }

  /**
   * Reads a single document's bytes for the same-origin file proxy.
   * Uses the same fetch path as the bulk-download archive so URL repair
   * and legacy `/uploads/...` handling stay in one place.
   */
  async readDocumentBytes(id: string): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
    const t = this.scope().tenantWhere();
    // findFirst (was findUnique) so the metadata lookup is tenant-
    // scoped in pilot mode. The storage byte fetch uses only the URL
    // returned by this lookup, so a cross-tenant id can never reach
    // a foreign file's bytes.
    const doc = await this.prisma.document.findFirst({ // @tenant-reviewed: phase220-pilot-scope
      where: { id, deletedAt: null, ...t },
      select: { id: true, name: true, fileUrl: true, mimeType: true },
    });
    if (!doc) throw new NotFoundException({ code: 'DOCUMENT.NOT_FOUND', message: `Document ${id} not found`, params: { id } });
    if (!doc.fileUrl) throw new NotFoundException({ code: 'DOCUMENT.FILE_MISSING', message: 'Document has no file', params: { id } });
    const buffer = await this.fetchDocumentBuffer(doc.fileUrl);
    return { buffer, mimeType: doc.mimeType ?? 'application/octet-stream', name: doc.name ?? 'document' };
  }

  async findByEntity(entityType: string, entityId: string, pagination: PaginationDto) {
    const { page = 1, limit = 50 } = pagination;
    const skip  = (Number(page) - 1) * Number(limit);
    const t = this.scope().tenantWhere();
    const where = { entityType: entityType as any, entityId, deletedAt: null, ...t };
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({ // @tenant-reviewed: phase220-pilot-scope
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: this.docInclude,
      }),
      this.prisma.document.count({ where }), // @tenant-reviewed: phase220-pilot-scope
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  // ── Check document-type permission for a user role ─────────────────────────

  async checkDocTypePermission(
    documentTypeId: string,
    roleId: string,
    action: 'canUpload' | 'canView' | 'canEdit' | 'canDelete' | 'canRenew',
  ): Promise<boolean> {
    const perm = await this.prisma.documentTypePermission.findUnique({ // @tenant-reviewed: phase220-global
      where: { documentTypeId_roleId: { documentTypeId, roleId } },
    });
    // No specific permission row → fall back to allowed (general role check covers it)
    if (!perm) return true;
    return perm[action] === true;
  }

  // ── Public upload (no auth) ────────────────────────────────────────────────

  async publicCreate(
    file: Express.Multer.File,
    entityId: string,
    name: string,
    documentTypeName: string,
    sectionKey?: string,
  ) {
    // Profile photo short-circuit ─────────────────────────────────────────
    // The public /apply form uploads the applicant's profile photo via
    // the same endpoint as supporting documents. It isn't a compliance
    // artefact, so we only persist it to applicant.photoUrl (which the
    // profile header + Step 1 preview read) and skip the Document row.
    // Otherwise, when no "Profile Photo" DocumentType exists, the
    // first-available fallback below mis-classifies the photo as the
    // oldest type (typically Passport), producing a ghost entry in the
    // Documents tab like "Profile Photo · Passport".
    if (documentTypeName?.toLowerCase().includes('photo')) {
      const upload = await this.storage.uploadFile(file.buffer, {
        keyPrefix: `applicants/${entityId}/photos`,
        contentType: file.mimetype,
        originalName: file.originalname,
        inline: true,
      });
      await this.legacyPrisma.applicant.updateMany({ where: { id: entityId }, data: { photoUrl: upload.url } }); // @tenant-reviewed: phase220-excluded-mutation
      return { id: null, photoUrl: upload.url, name, mimeType: file.mimetype, fileSize: file.size };
    }

    // Section-key → canonical DocumentType-name hints. The public form
    // upload widgets pass language-agnostic section keys, which we
    // resolve here BEFORE the documentTypeName so a localized label
    // like "رفع جواز السفر" can never get mis-classified as "the first
    // DocumentType in the DB".
    const sectionToTypeName: Record<string, string> = {
      drivingLicense: 'Driving License',
      passport: 'Passport',
      idCard: 'National ID Card',
      euVisa: 'EU Visa',
      euResidence: 'EU Residence',
      euWorkPermit: 'EU Work Permit',
      workPermit: 'EU Work Permit',
      homeCriminalRecord: 'Criminal Record',
      euCriminalRecord: 'Criminal Record',
      firstAid: 'First Aid Certificate',
    };
    const sectionHint = sectionKey?.startsWith('required:')
      ? sectionKey.slice('required:'.length)
      : sectionToTypeName[sectionKey ?? ''];

    const findByName = (n: string) =>
      this.prisma.documentType.findFirst({ where: { name: { equals: n, mode: 'insensitive' } } }); // @tenant-reviewed: phase220-global

    let docType: any = null;

    // Try the section hint first (stable, language-agnostic).
    if (sectionHint) docType = await findByName(sectionHint);

    // Then the explicit documentTypeName (exact → contains → substring).
    if (!docType && documentTypeName) {
      docType = await findByName(documentTypeName);
    }
    if (!docType && documentTypeName) {
      docType = await this.prisma.documentType.findFirst({ // @tenant-reviewed: phase220-global
        where: { name: { contains: documentTypeName, mode: 'insensitive' } },
      });
    }
    if (!docType && documentTypeName) {
      const all = await this.prisma.documentType.findMany(); // @tenant-reviewed: phase220-global
      docType = all.find(t => documentTypeName.toLowerCase().includes(t.name.toLowerCase())) ?? null;
    }
    // Last-resort fallback: only use "Other" (or auto-create it) instead
    // of "first DocumentType in DB" so an unmatched upload never silently
    // gets classified as Passport just because it happens to be the first
    // row created during seeding.
    if (!docType) {
      docType = await findByName('Other');
      if (!docType) {
        try {
          docType = await this.legacyPrisma.documentType.create({ // @tenant-reviewed: phase220-excluded-mutation
            data: { name: 'Other', category: 'OTHER', isActive: true },
          });
        } catch {
          // If create fails (e.g. unique-name race), retry the lookup.
          docType = await findByName('Other');
        }
      }
    }
    if (!docType) throw new BadRequestException({ code: 'DOCUMENT.TYPES_NOT_CONFIGURED', message: 'No document types configured' });

    // Attribute to System Admin
    let systemUser = await this.legacyPrisma.user.findFirst({ // @tenant-reviewed: phase220-excluded-mutation
      where: { role: { name: 'System Admin' }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!systemUser) systemUser = await this.legacyPrisma.user.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } }); // @tenant-reviewed: phase220-excluded-mutation
    if (!systemUser) throw new BadRequestException({ code: 'DOCUMENT.NO_ATTRIBUTION_USER', message: 'No users found to attribute upload to' });

    const safeDocType = this.sanitize(docType.name) || 'Others';
    const upload = await this.storage.uploadFile(file.buffer, {
      keyPrefix: `documents/APPLICANT/${entityId}/${safeDocType}`,
      contentType: file.mimetype,
      originalName: file.originalname,
      inline: file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'),
    });
    const fileUrl = upload.url;

    // Generate doc ID inside a transaction
    const document = await this.legacyPrisma.$transaction(async (tx) => { // @tenant-reviewed: phase220-excluded-mutation
      const docId = await this.documentIdService.generate(entityId, 'APPLICANT', docType!.id, tx);
      return tx.document.create({
        data: {
          docId,
          name,
          documentTypeId: docType!.id,
          entityType: 'APPLICANT' as any,
          entityId,
          fileUrl,
          mimeType: file.mimetype,
          fileSize: file.size,
          status: 'PENDING',
          uploadedById: systemUser!.id,
        },
        include: this.docInclude,
      });
    });

    return document;
  }

  // ── Authenticated upload ───────────────────────────────────────────────────

  async create(dto: CreateDocumentDto, file: Express.Multer.File, uploadedById: string) {
    const docType = await this.prisma.documentType.findUnique({ where: { id: dto.documentTypeId } }); // @tenant-reviewed: phase220-global
    if (!docType) throw new NotFoundException({ code: 'DOCUMENT.TYPE_NOT_FOUND', message: 'Document type not found' });

    const entityName  = await this.resolveEntityName(dto.entityType, dto.entityId);
    const safeDocType = this.sanitize(docType.name) || 'Others';
    const upload = await this.storage.uploadFile(file.buffer, {
      keyPrefix: `documents/${dto.entityType}/${dto.entityId}/${safeDocType}`,
      contentType: file.mimetype,
      originalName: file.originalname,
      inline: file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'),
    });
    const fileUrl = upload.url;

    const doc = await this.legacyPrisma.$transaction(async (tx) => { // @tenant-reviewed: phase220-excluded-mutation
      const docId = await this.documentIdService.generate(dto.entityId, dto.entityType, dto.documentTypeId, tx);
      return tx.document.create({
        data: {
          docId,
          name:           dto.name,
          documentTypeId: dto.documentTypeId,
          entityType:     dto.entityType as any,
          entityId:       dto.entityId,
          fileUrl,
          mimeType:  file.mimetype,
          fileSize:  file.size,
          status:    'PENDING',
          issueDate:      dto.issueDate      ? new Date(dto.issueDate)   : undefined,
          expiryDate:     dto.expiryDate     ? new Date(dto.expiryDate)  : undefined,
          issuer:         dto.issuer,
          issueCountry:   (dto as any).issueCountry,
          documentNumber: dto.documentNumber,
          notes:          dto.notes,
          uploadedById,
        },
        include: this.docInclude,
      });
    });

    await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase220-audit-log
      data: {
        userId: uploadedById, action: 'UPLOAD', entity: 'Document', entityId: doc.id,
        changes: { docId: doc.docId, name: dto.name, entityType: dto.entityType, entityId: dto.entityId } as any,
      },
    });

    if (dto.expiryDate) {
      const expiry = new Date(dto.expiryDate);
      const daysUntilExpiry = Math.floor((expiry.getTime() - Date.now()) / 86400000);
      if (daysUntilExpiry <= 30) {
        await this.legacyPrisma.complianceAlert.create({ // @tenant-reviewed: phase220-excluded-mutation
          data: {
            entityType: dto.entityType as any, entityId: dto.entityId, documentId: doc.id,
            alertType: 'DOCUMENT_EXPIRY',
            severity:  daysUntilExpiry <= 7 ? 'CRITICAL' : daysUntilExpiry <= 14 ? 'HIGH' : 'MEDIUM',
            message:   `Document "${dto.name}" (${doc.docId}) expires in ${daysUntilExpiry} days`,
            status:    'OPEN', dueDate: expiry,
          },
        });
        // Fire expiring-soon or already-expired notification
        const isExpired = daysUntilExpiry <= 0;
        this.notifications.notifyUploaderAndRoles(
          uploadedById,
          DOC_NOTIFY_ROLES,
          isExpired ? NOTIF_EVENTS.DOCUMENT_EXPIRED : NOTIF_EVENTS.DOCUMENT_EXPIRING_SOON,
          isExpired ? 'Document Expired' : 'Document Expiring Soon',
          isExpired
            ? `Document "${dto.name}" for ${entityName} has already expired.`
            : `Document "${dto.name}" for ${entityName} expires in ${daysUntilExpiry} days.`,
          dto.entityType,
          dto.entityId,
          {
            titleKey: isExpired ? 'events.documentExpired.title' : 'events.documentExpiringSoon.title',
            messageKey: isExpired ? 'events.documentExpired.body' : 'events.documentExpiringSoon.body',
            params: {
              documentName: dto.name,
              entityName,
              daysUntilExpiry,
            },
          },
        ).catch(e => this.logger.error('Doc expiry notification error:', e));
      }
    }

    // Notify on every upload
    this.notifications.notifyUploaderAndRoles(
      uploadedById,
      DOC_NOTIFY_ROLES,
      NOTIF_EVENTS.DOCUMENT_UPLOADED,
      'New Document Uploaded',
      `A new document "${dto.name}" was uploaded for ${entityName}.`,
      dto.entityType,
      dto.entityId,
      {
        titleKey: 'events.documentUploaded.title',
        messageKey: 'events.documentUploaded.body',
        params: { documentName: dto.name, entityName, uploaderName: '' },
      },
    ).catch(e => this.logger.error('Doc upload notification error:', e));

    return doc;
  }

  // ── Update metadata ────────────────────────────────────────────────────────

  async update(id: string, updateData: any, updatedById?: string) {
    await this.findOne(id);
    const data: any = { ...updateData };
    if (updateData.issueDate)  data.issueDate  = new Date(updateData.issueDate);
    if (updateData.expiryDate) data.expiryDate = new Date(updateData.expiryDate);
    // Prevent overwriting docId via update
    delete data.docId;
    const doc = await this.legacyPrisma.document.update({ where: { id }, data, include: this.docInclude }); // @tenant-reviewed: phase220-excluded-mutation
    if (updatedById) {
      await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase220-audit-log
        data: { userId: updatedById, action: 'UPDATE', entity: 'Document', entityId: id, changes: updateData as any },
      });
    }
    return doc;
  }

  // ── Verify / reject ────────────────────────────────────────────────────────

  async verify(id: string, dto: VerifyDocumentDto, verifiedById: string) {
    const doc = await this.findOne(id);

    if (doc.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'DOCUMENT.ALREADY_VERIFIED',
        message: `Document is already ${doc.status.charAt(0) + doc.status.slice(1).toLowerCase()} and cannot be re-verified`,
        params: { status: doc.status.toLowerCase() },
      });
    }

    const isApprove = dto.action === VerifyActionEnum.VERIFY;
    const newStatus = isApprove ? 'VERIFIED' : 'REJECTED';

    const updated = await this.legacyPrisma.document.update({ // @tenant-reviewed: phase220-excluded-mutation
      where: { id },
      data: {
        status:          newStatus as any,
        verifiedById,
        verifiedAt:      new Date(),
        rejectionReason: isApprove ? null : (dto.reason ?? null),
        notes:           dto.reason
          ? `${(doc as any).notes || ''}\n[${isApprove ? 'Approved' : 'Rejected'}] ${dto.reason}`.trim()
          : (doc as any).notes,
      },
      include: this.docInclude,
    });

    if (isApprove) {
      await this.legacyPrisma.complianceAlert.updateMany({ // @tenant-reviewed: phase220-excluded-mutation
        where: { documentId: id, status: 'OPEN' },
        data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: verifiedById },
      });
      await this.checkAndAutoCompleteStage(doc.entityType as string, doc.entityId, verifiedById);
    }

    await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase220-audit-log
      data: {
        userId: verifiedById,
        action: isApprove ? 'VERIFY_DOCUMENT' : 'REJECT_DOCUMENT',
        entity: 'Document', entityId: id,
        changes: { status: newStatus, docId: (doc as any).docId, reason: dto.reason } as any,
      },
    });
    return updated;
  }

  // ── Renew a document ───────────────────────────────────────────────────────
  /**
   * Renewal creates a NEW Document record that:
   *  - shares entityId, entityType, documentTypeId with the original
   *  - sets renewedFromId = originalDoc.id
   *  - receives its own new business docId (next sequence number)
   *  - starts with PENDING status
   * The original document is NOT modified (history is preserved).
   * A file must be re-uploaded via a separate upload call if needed,
   * or pass existingFileUrl to reuse the file temporarily.
   */
  async renew(
    originalId: string,
    dto: RenewDocumentDto,
    file: Express.Multer.File | undefined,
    renewedById: string,
  ) {
    const original = await this.findOne(originalId);

    let fileUrl  = (original as any).fileUrl;
    let mimeType = (original as any).mimeType;
    let fileSize = (original as any).fileSize;

    if (file) {
      const safeDocType = this.sanitize((original as any).documentType?.name) || 'Others';
      const upload = await this.storage.uploadFile(file.buffer, {
        keyPrefix: `documents/${original.entityType}/${original.entityId}/${safeDocType}`,
        contentType: file.mimetype,
        originalName: file.originalname,
        inline: file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'),
      });
      fileUrl  = upload.url;
      mimeType = file.mimetype;
      fileSize = file.size;
    }

    const renewed = await this.legacyPrisma.$transaction(async (tx) => { // @tenant-reviewed: phase220-excluded-mutation
      const docId = await this.documentIdService.generate(
        original.entityId, original.entityType as string, original.documentTypeId, tx,
      );
      return tx.document.create({
        data: {
          docId,
          name:           dto.name ?? `${(original as any).name} (Renewal)`,
          documentTypeId: original.documentTypeId,
          entityType:     original.entityType,
          entityId:       original.entityId,
          fileUrl, mimeType, fileSize,
          status:         'PENDING',
          issueDate:      dto.issueDate      ? new Date(dto.issueDate)  : undefined,
          expiryDate:     dto.expiryDate     ? new Date(dto.expiryDate) : undefined,
          issuer:         dto.issuer         ?? (original as any).issuer,
          issueCountry:   dto.issueCountry   ?? (original as any).issueCountry,
          documentNumber: dto.documentNumber ?? (original as any).documentNumber,
          notes:          dto.notes,
          renewedFromId:  originalId,
          uploadedById:   renewedById,
        },
        include: this.docInclude,
      });
    });

    await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase220-audit-log
      data: {
        userId: renewedById, action: 'RENEW_DOCUMENT', entity: 'Document', entityId: renewed.id,
        changes: { renewedFromId: originalId, originalDocId: (original as any).docId, newDocId: renewed.docId } as any,
      },
    });
    return renewed;
  }

  // ── Delete (soft) ──────────────────────────────────────────────────────────

  async remove(id: string, deletedById?: string) {
    const doc = await this.findOne(id);

    // Restriction: approved documents require explicit bypass
    if ((doc as any).status === 'VERIFIED') {
      // Allow System Admin via service; controller should check role before calling
    }

    await this.legacyPrisma.document.update({ where: { id }, data: { deletedAt: new Date() } }); // @tenant-reviewed: phase220-excluded-mutation
    if (deletedById) {
      await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase220-audit-log
        data: {
          userId: deletedById, action: 'DELETE', entity: 'Document', entityId: id,
          changes: { docId: (doc as any).docId, name: (doc as any).name } as any,
        },
      });
    }
    return { message: 'Document deleted' };
  }

  // ── Bulk download as ZIP ───────────────────────────────────────────────────

  async createBulkDownloadArchive(ids: string[]): Promise<Buffer> {
    const docs = await this.legacyPrisma.document.findMany({ // @tenant-reviewed: phase220-excluded-download
      where: { id: { in: ids }, deletedAt: null },
      include: { documentType: { select: { name: true } } },
    });
    const entityIds = [...new Set(docs.map(d => d.entityId))];
    const nameMap: Record<string, string> = {};
    await Promise.all(entityIds.map(async (eid) => {
      const d = docs.find(x => x.entityId === eid)!;
      nameMap[eid] = this.sanitize(await this.resolveEntityName(d.entityType as string, eid) || d.entityType);
    }));

    const zip = new AdmZip();
    const usedPaths = new Set<string>();
    for (const doc of docs) {
      let content: Buffer;
      try {
        content = await this.fetchDocumentBuffer(doc.fileUrl);
      } catch {
        continue;
      }
      const entityFolder = nameMap[doc.entityId] || 'Unknown';
      const typeFolder   = this.sanitize((doc as any).documentType?.name || 'Documents');
      const ext          = doc.fileUrl.includes('.') ? '.' + doc.fileUrl.split('.').pop()! : '';
      const baseName     = ((doc as any).docId ? this.sanitize((doc as any).docId) : this.sanitize(doc.name)) || 'document';
      let entryPath      = `${entityFolder}/${typeFolder}/${baseName}${ext}`;
      if (usedPaths.has(entryPath)) {
        let counter = 2;
        while (usedPaths.has(`${entityFolder}/${typeFolder}/${baseName}_${counter}${ext}`)) counter++;
        entryPath = `${entityFolder}/${typeFolder}/${baseName}_${counter}${ext}`;
      }
      usedPaths.add(entryPath);
      zip.addFile(entryPath, content);
    }
    return zip.toBuffer();
  }

  // ── Expiring documents ─────────────────────────────────────────────────────

  async getExpiringDocuments(days = 30) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);
    const t = this.scope().tenantWhere();
    return this.prisma.document.findMany({ // @tenant-reviewed: phase220-pilot-scope
      where: { deletedAt: null, status: { notIn: ['REJECTED'] }, expiryDate: { not: null, lte: threshold, gte: new Date() }, ...t },
      include: this.docInclude,
      orderBy: { expiryDate: 'asc' },
    });
  }

  // ── Document-type permission CRUD (for Settings module) ────────────────────

  async getDocTypePermissions(documentTypeId: string) {
    return this.prisma.documentTypePermission.findMany({ // @tenant-reviewed: phase220-global
      where: { documentTypeId },
      include: { role: { select: { id: true, name: true } } },
    });
  }

  async upsertDocTypePermission(
    documentTypeId: string,
    roleId: string,
    perms: Partial<{ canUpload: boolean; canView: boolean; canEdit: boolean; canDelete: boolean; canRenew: boolean }>,
  ) {
    return this.legacyPrisma.documentTypePermission.upsert({ // @tenant-reviewed: phase220-excluded-mutation
      where: { documentTypeId_roleId: { documentTypeId, roleId } },
      create: { documentTypeId, roleId, ...perms },
      update: perms,
    });
  }

  // ── Private: auto-complete workflow stage ──────────────────────────────────

  private async checkAndAutoCompleteStage(entityType: string, entityId: string, actorId: string) {
    let currentStageId: string | null = null;
    if (entityType === 'EMPLOYEE') {
      const s = await this.legacyPrisma.employeeStage.findFirst({ where: { employeeId: entityId, status: 'IN_PROGRESS' } }); // @tenant-reviewed: phase220-excluded-mutation
      currentStageId = s?.stageId ?? null;
    } else if (entityType === 'APPLICANT') {
      const a = await this.legacyPrisma.applicant.findUnique({ where: { id: entityId, deletedAt: null }, select: { currentWorkflowStageId: true } }); // @tenant-reviewed: phase220-excluded-mutation
      currentStageId = a?.currentWorkflowStageId ?? null;
    }
    if (!currentStageId) return;

    const stage = await this.legacyPrisma.stageTemplate.findUnique({ where: { id: currentStageId }, select: { id: true, order: true, requirementsDocuments: true } }); // @tenant-reviewed: phase220-excluded-mutation
    if (!stage || stage.requirementsDocuments.length === 0) return;

    const verifiedDocs = await this.legacyPrisma.document.findMany({ // @tenant-reviewed: phase220-excluded-mutation
      where: { entityType: entityType as any, entityId, status: 'VERIFIED', deletedAt: null },
      include: { documentType: { select: { name: true } } },
    });
    const verifiedNames = new Set((verifiedDocs as any[]).map(d => d.documentType.name));
    if (!stage.requirementsDocuments.every(r => verifiedNames.has(r))) return;

    const nextStage = await this.legacyPrisma.stageTemplate.findFirst({ where: { order: { gt: stage.order }, isActive: true }, orderBy: { order: 'asc' } }); // @tenant-reviewed: phase220-excluded-mutation

    if (entityType === 'EMPLOYEE') {
      await this.legacyPrisma.employeeStage.updateMany({ where: { employeeId: entityId, stageId: currentStageId, status: 'IN_PROGRESS' }, data: { status: 'COMPLETED', completedAt: new Date() } }); // @tenant-reviewed: phase220-excluded-mutation
      if (nextStage) {
        await this.legacyPrisma.employeeStage.upsert({ // @tenant-reviewed: phase220-excluded-mutation
          where: { employeeId_stageId: { employeeId: entityId, stageId: nextStage.id } },
          create: { employeeId: entityId, stageId: nextStage.id, status: 'IN_PROGRESS', startedAt: new Date() },
          update: { status: 'IN_PROGRESS', startedAt: new Date(), completedAt: null },
        });
      }
    } else {
      await this.legacyPrisma.applicant.update({ where: { id: entityId }, data: { currentWorkflowStageId: nextStage?.id ?? currentStageId } }); // @tenant-reviewed: phase220-excluded-mutation
    }

    await this.legacyPrisma.auditLog.create({ // @tenant-reviewed: phase220-audit-log
      data: {
        userId: actorId, action: 'WORKFLOW_STAGE_AUTO_COMPLETE',
        entity: entityType === 'EMPLOYEE' ? 'Employee' : 'Applicant', entityId,
        changes: { completedStageId: currentStageId, nextStageId: nextStage?.id ?? null } as any,
      },
    });
  }
}
