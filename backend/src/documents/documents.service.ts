import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { VerifyDocumentDto, VerifyActionEnum } from './dto/verify-document.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  private get docInclude() {
    return {
      documentType: true,
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder }, include: this.docInclude }),
      this.prisma.document.count({ where }),
    ]);
    return new PaginatedResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id, deletedAt: null }, include: this.docInclude });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  async findByEntity(entityType: string, entityId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const where = { entityType: entityType as any, entityId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: this.docInclude }),
      this.prisma.document.count({ where }),
    ]);
    return new PaginatedResponse(items, total, page, limit);
  }

  async create(
    dto: CreateDocumentDto,
    file: Express.Multer.File,
    uploadedById: string,
  ) {
    const docType = await this.prisma.documentType.findUnique({ where: { id: dto.documentTypeId } });
    if (!docType) throw new NotFoundException('Document type not found');

    const fileUrl = `/uploads/${file.filename}`;
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
    const newStatus = dto.action === VerifyActionEnum.VERIFY ? 'VERIFIED' : 'REJECTED';
    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        status: newStatus as any,
        verifiedById,
        verifiedAt: new Date(),
        notes: dto.reason ? `${doc.notes || ''}\nVerification note: ${dto.reason}`.trim() : doc.notes,
      },
      include: this.docInclude,
    });
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
