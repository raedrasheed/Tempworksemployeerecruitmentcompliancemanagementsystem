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
    for (const [key, value] of Object.entries(dto.settings)) {
      const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
      if (!setting) continue;
      const updated = await this.prisma.systemSetting.update({
        where: { key },
        data: { value, updatedById: userId },
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
    return this.prisma.jobType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
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
    return this.prisma.documentType.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
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
    return this.prisma.workflowStage.findMany({ orderBy: { order: 'asc' } });
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
