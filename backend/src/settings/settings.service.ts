import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../logs/audit-log.service';
import { BatchUpdateSettingsDto } from './dto/update-settings.dto';
import { CreateJobTypeDto } from './dto/create-job-type.dto';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { CreateNotificationRuleDto } from './dto/create-notification-rule.dto';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async findAll(includePrivate = false) {
    const where = includePrivate ? {} : { isPublic: true };
    const settings = await this.prisma.systemSetting.findMany({
      where, orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    const grouped: Record<string, any[]> = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }
    return grouped;
  }

  async batchUpdate(dto: BatchUpdateSettingsDto, userId: string) {
    const results = [];
    for (const [key, value] of Object.entries(dto.settings ?? {})) {
      const updated = await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value, updatedById: userId },
        create: { key, value, updatedById: userId, description: key, category: 'agency', isPublic: false },
      });
      results.push(updated);
    }
    await this.auditLog.log({
      userId,
      action: 'UPDATE',
      entity: 'Settings',
      entityId: 'system',
      changes: dto.settings as any,
    });
    return results;
  }

  // ─── Job Types ──────────────────────────────────────────────────────────────
  async findJobTypes() {
    return this.prisma.jobType.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { applicants: true, applications: true } } },
    });
  }

  async createJobType(dto: CreateJobTypeDto, actorId?: string) {
    const jt = await this.prisma.jobType.create({ data: { ...dto, isActive: dto.isActive ?? true } });
    await this.auditLog.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'JobType',
      entityId: jt.id,
      changes: { name: jt.name },
    });
    return jt;
  }

  async updateJobType(id: string, dto: Partial<CreateJobTypeDto>, actorId?: string) {
    const jt = await this.prisma.jobType.findUnique({ where: { id } });
    if (!jt) throw new NotFoundException('Job type not found');
    const updated = await this.prisma.jobType.update({ where: { id }, data: dto });
    await this.auditLog.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'JobType',
      entityId: id,
      changes: dto as any,
    });
    return updated;
  }

  async deleteJobType(id: string, actorId?: string) {
    const jt = await this.prisma.jobType.findUnique({ where: { id } });
    if (!jt) throw new NotFoundException('Job type not found');
    await this.prisma.jobType.update({ where: { id }, data: { isActive: false } });
    await this.auditLog.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'JobType',
      entityId: id,
      changes: { name: jt.name },
    });
    return { message: 'Job type deactivated' };
  }

  // ─── Document Types ──────────────────────────────────────────────────────────
  async findDocumentTypes() {
    return this.prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { documents: true } } },
    });
  }

  async findDocumentType(id: string) {
    const dt = await this.prisma.documentType.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    });
    if (!dt) throw new NotFoundException('Document type not found');
    return dt;
  }

  async createDocumentType(dto: CreateDocumentTypeDto, actorId?: string) {
    const dt = await this.prisma.documentType.create({ data: { ...dto, isActive: dto.isActive ?? true } });
    await this.auditLog.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'DocumentType',
      entityId: dt.id,
      changes: { name: dt.name, category: dt.category },
    });
    return dt;
  }

  async updateDocumentType(id: string, dto: Partial<CreateDocumentTypeDto>, actorId?: string) {
    const dt = await this.prisma.documentType.findUnique({ where: { id } });
    if (!dt) throw new NotFoundException('Document type not found');
    const updated = await this.prisma.documentType.update({ where: { id }, data: dto });
    await this.auditLog.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'DocumentType',
      entityId: id,
      changes: dto as any,
    });
    return updated;
  }

  async deleteDocumentType(id: string, actorId?: string) {
    const dt = await this.prisma.documentType.findUnique({ where: { id } });
    if (!dt) throw new NotFoundException('Document type not found');
    await this.prisma.documentType.update({ where: { id }, data: { isActive: false } });
    await this.auditLog.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'DocumentType',
      entityId: id,
      changes: { name: dt.name },
    });
    return { message: 'Document type deactivated' };
  }

  // ─── Workflow Stages ─────────────────────────────────────────────────────────
  async findWorkflowStages() {
    return this.prisma.workflowStage.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });
  }

  async createWorkflowStage(dto: any, actorId?: string) {
    const maxOrder = await this.prisma.workflowStage.aggregate({ _max: { order: true } });
    const nextOrder = (maxOrder._max.order ?? 0) + 1;
    const stage = await this.prisma.workflowStage.create({
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color ?? '#2563EB',
        order: nextOrder,
        category: dto.category ?? 'INITIAL',
        requirementsDocuments: dto.requirementsDocuments ?? [],
        requirementsActions: dto.requirementsActions ?? [],
        requirementsApprovals: dto.requirementsApprovals ?? [],
      },
    });
    await this.auditLog.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'WorkflowStage',
      entityId: stage.id,
      changes: { name: stage.name },
    });
    return stage;
  }

  async updateWorkflowStage(id: string, dto: any, actorId?: string) {
    const stage = await this.prisma.workflowStage.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException('Workflow stage not found');
    const updated = await this.prisma.workflowStage.update({ where: { id }, data: dto });
    await this.auditLog.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'WorkflowStage',
      entityId: id,
      changes: dto,
    });
    return updated;
  }

  async deleteWorkflowStage(id: string, actorId?: string) {
    const stage = await this.prisma.workflowStage.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException('Workflow stage not found');
    await this.prisma.workflowStage.update({ where: { id }, data: { isActive: false } });
    await this.auditLog.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'WorkflowStage',
      entityId: id,
      changes: { name: stage.name },
    });
    return { message: 'Workflow stage deleted' };
  }

  async reorderWorkflowStages(orders: { id: string; order: number }[], actorId?: string) {
    await Promise.all(
      orders.map(({ id, order }) =>
        this.prisma.workflowStage.update({ where: { id }, data: { order } }),
      ),
    );
    await this.auditLog.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'WorkflowStage',
      entityId: 'bulk',
      changes: { reorder: orders },
    });
    return { message: 'Stages reordered' };
  }

  // ─── Notification Rules ──────────────────────────────────────────────────────
  async findNotificationRules() {
    return this.prisma.notificationRule.findMany({ orderBy: { name: 'asc' } });
  }

  async createNotificationRule(dto: CreateNotificationRuleDto, actorId?: string) {
    const rule = await this.prisma.notificationRule.create({ data: { ...dto, isActive: dto.isActive ?? true } });
    await this.auditLog.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'NotificationRule',
      entityId: rule.id,
      changes: { name: rule.name },
    });
    return rule;
  }

  async updateNotificationRule(id: string, dto: Partial<CreateNotificationRuleDto>, actorId?: string) {
    const rule = await this.prisma.notificationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Notification rule not found');
    const updated = await this.prisma.notificationRule.update({ where: { id }, data: dto });
    await this.auditLog.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'NotificationRule',
      entityId: id,
      changes: dto as any,
    });
    return updated;
  }

  async deleteNotificationRule(id: string, actorId?: string) {
    const rule = await this.prisma.notificationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Notification rule not found');
    await this.prisma.notificationRule.delete({ where: { id } });
    await this.auditLog.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'NotificationRule',
      entityId: id,
      changes: { name: rule.name },
    });
    return { message: 'Notification rule deleted' };
  }
}
