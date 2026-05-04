import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { CreateWorkHistoryDto, UpdateWorkHistoryDto } from './dto/work-history.dto';

/**
 * Work History is the post-hire business timeline for an Employee:
 * new contract, probation start/end, unpaid leave, end of contract,
 * termination. It lives next to the workflow history but is
 * intentionally a different table / module so pipeline events and
 * contract events never get mixed in reports or audits.
 */
@Injectable()
export class EmployeeWorkHistoryService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  private get include() {
    return {
      createdBy:  { select: { id: true, firstName: true, lastName: true, email: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' as const } },
    };
  }

  /** Enforces "this timeline belongs to an Employee, not a lead /
   *  candidate". Throws 404 for both deleted and non-existent rows so
   *  the feature never leaks Applicant timelines through this route. */
  private async assertEmployeeExists(employeeId: string): Promise<void> {
    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!emp) throw new NotFoundException(`Employee ${employeeId} not found`);
  }

  async list(employeeId: string) {
    await this.assertEmployeeExists(employeeId);
    return (this.prisma as any).employeeWorkHistory.findMany({
      where: { employeeId, deletedAt: null },
      // Newest first — operators need to see the most recent event at
      // the top of the Contracts tab; older events are still reachable
      // by scrolling.
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: this.include,
    });
  }

  /** Configured event types — active only, in the operator-defined
   *  order. Surfaced by the controller so the Add/Edit dropdown
   *  reflects Settings without a second round-trip.  */
  async listEventTypes() {
    try {
      return await (this.prisma as any).workHistoryEventTypeSetting.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      });
    } catch {
      return [];
    }
  }

  /** Throws BadRequest when the value isn't registered in Settings.
   *  Soft-fails open when the settings table is empty so the first
   *  install still accepts writes. */
  private async assertEventTypeConfigured(value: string) {
    const list = await this.listEventTypes();
    if (list.length === 0) return;
    if (!list.some((e: any) => e.value === value)) {
      throw new BadRequestException(`Event type "${value}" is not configured in Settings`);
    }
  }

  async create(employeeId: string, dto: CreateWorkHistoryDto, actorId?: string) {
    await this.assertEmployeeExists(employeeId);
    await this.assertEventTypeConfigured(dto.eventType);
    const entry = await (this.prisma as any).employeeWorkHistory.create({
      data: {
        employeeId,
        date:        new Date(dto.date),
        eventType:   dto.eventType,
        description: dto.description ?? null,
        approvedById: dto.approvedById ?? null,
        createdById: actorId ?? null,
      },
      include: this.include,
    });
    await this.auditLog(actorId, 'EMPLOYEE_WORK_HISTORY_CREATED', entry.id, {
      employeeId, eventType: dto.eventType, date: dto.date,
    });
    return entry;
  }

  async update(employeeId: string, entryId: string, dto: UpdateWorkHistoryDto, actorId?: string) {
    const existing = await (this.prisma as any).employeeWorkHistory.findFirst({
      where: { id: entryId, employeeId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Work history entry not found');
    if (dto.eventType !== undefined) await this.assertEventTypeConfigured(dto.eventType);
    const data: any = {};
    if (dto.date !== undefined)        data.date = new Date(dto.date);
    if (dto.eventType !== undefined)   data.eventType = dto.eventType;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.approvedById !== undefined) data.approvedById = dto.approvedById;
    const updated = await (this.prisma as any).employeeWorkHistory.update({
      where: { id: entryId }, data, include: this.include,
    });
    await this.auditLog(actorId, 'EMPLOYEE_WORK_HISTORY_UPDATED', entryId, { employeeId, ...dto });
    return updated;
  }

  async remove(employeeId: string, entryId: string, actorId?: string) {
    const existing = await (this.prisma as any).employeeWorkHistory.findFirst({
      where: { id: entryId, employeeId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Work history entry not found');
    // Soft delete — preserves the timeline for audit purposes even
    // when a row is hidden from operators.
    await (this.prisma as any).employeeWorkHistory.update({
      where: { id: entryId },
      data: { deletedAt: new Date(), deletedBy: actorId ?? null },
    });
    await this.auditLog(actorId, 'EMPLOYEE_WORK_HISTORY_DELETED', entryId, {
      employeeId, eventType: existing.eventType,
    });
    return { message: 'Work history entry deleted' };
  }

  // ── Attachments ────────────────────────────────────────────────────────────

  async addAttachment(
    employeeId: string, entryId: string,
    file: Express.Multer.File, uploadedById?: string,
  ) {
    const entry = await (this.prisma as any).employeeWorkHistory.findFirst({
      where: { id: entryId, employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException('Work history entry not found');
    if (!file) throw new BadRequestException('No file uploaded');

    const upload = await this.storage.uploadFile(file.buffer, {
      keyPrefix: `employees/${employeeId}/work-history/${entryId}/attachments`,
      contentType: file.mimetype,
      originalName: file.originalname,
      inline: file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'),
    });

    const attachment = await (this.prisma as any).employeeWorkHistoryAttachment.create({
      data: {
        workHistoryId: entryId,
        name:     file.originalname,
        fileUrl:  upload.url,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedById: uploadedById ?? null,
      },
    });
    await this.auditLog(uploadedById, 'EMPLOYEE_WORK_HISTORY_ATTACHMENT_ADDED', entryId, {
      attachmentId: attachment.id, name: file.originalname, employeeId,
    });
    return attachment;
  }

  async removeAttachment(
    employeeId: string, entryId: string, attachmentId: string, actorId?: string,
  ) {
    const att = await (this.prisma as any).employeeWorkHistoryAttachment.findFirst({
      where: {
        id: attachmentId, workHistoryId: entryId, deletedAt: null,
        workHistory: { employeeId },
      },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    await (this.prisma as any).employeeWorkHistoryAttachment.update({
      where: { id: attachmentId }, data: { deletedAt: new Date() },
    });
    if (att.fileUrl) {
      await this.storage.deleteFileByUrlOrKey(att.fileUrl);
    }
    await this.auditLog(actorId, 'EMPLOYEE_WORK_HISTORY_ATTACHMENT_REMOVED', entryId, {
      attachmentId, employeeId,
    });
    return { message: 'Attachment removed' };
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async auditLog(userId: string | undefined, action: string, entityId: string, changes?: any) {
    try {
      await this.prisma.auditLog.create({
        data: { userId, action, entity: 'EmployeeWorkHistory', entityId, changes: changes as any },
      });
    } catch { /* audit must never crash main flow */ }
  }
}
