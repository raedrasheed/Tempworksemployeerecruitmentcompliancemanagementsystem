import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatchUpdateSettingsDto } from './dto/update-settings.dto';
import { CreateJobTypeDto } from './dto/create-job-type.dto';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { CreateNotificationRuleDto } from './dto/create-notification-rule.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(includePrivate = false) {
    const where = includePrivate ? {} : { isPublic: true };
    const settings = await this.prisma.systemSetting.findMany({
      where, orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    // Group by category
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
    return results;
  }

  // Job Types
  async findJobTypes() {
    return this.prisma.jobType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createJobType(dto: CreateJobTypeDto) {
    return this.prisma.jobType.create({ data: { ...dto, isActive: dto.isActive ?? true } });
  }

  async updateJobType(id: string, dto: Partial<CreateJobTypeDto>) {
    const jt = await this.prisma.jobType.findUnique({ where: { id } });
    if (!jt) throw new NotFoundException('Job type not found');
    return this.prisma.jobType.update({ where: { id }, data: dto });
  }

  async deleteJobType(id: string) {
    const jt = await this.prisma.jobType.findUnique({ where: { id } });
    if (!jt) throw new NotFoundException('Job type not found');
    await this.prisma.jobType.update({ where: { id }, data: { isActive: false } });
    return { message: 'Job type deactivated' };
  }

  // Document Types
  async findDocumentTypes() {
    return this.prisma.documentType.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  async createDocumentType(dto: CreateDocumentTypeDto) {
    return this.prisma.documentType.create({ data: { ...dto, isActive: dto.isActive ?? true } });
  }

  async updateDocumentType(id: string, dto: Partial<CreateDocumentTypeDto>) {
    const dt = await this.prisma.documentType.findUnique({ where: { id } });
    if (!dt) throw new NotFoundException('Document type not found');
    return this.prisma.documentType.update({ where: { id }, data: dto });
  }

  async deleteDocumentType(id: string) {
    const dt = await this.prisma.documentType.findUnique({ where: { id } });
    if (!dt) throw new NotFoundException('Document type not found');
    await this.prisma.documentType.update({ where: { id }, data: { isActive: false } });
    return { message: 'Document type deactivated' };
  }

  // Workflow Stages
  async findWorkflowStages() {
    return this.prisma.workflowStage.findMany({ orderBy: { order: 'asc' } });
  }

  async updateWorkflowStage(id: string, dto: any) {
    const stage = await this.prisma.workflowStage.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException('Workflow stage not found');
    return this.prisma.workflowStage.update({ where: { id }, data: dto });
  }

  // Notification Rules
  async findNotificationRules() {
    return this.prisma.notificationRule.findMany({ orderBy: { name: 'asc' } });
  }

  async createNotificationRule(dto: CreateNotificationRuleDto) {
    return this.prisma.notificationRule.create({ data: { ...dto, isActive: dto.isActive ?? true } });
  }

  async updateNotificationRule(id: string, dto: Partial<CreateNotificationRuleDto>) {
    const rule = await this.prisma.notificationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Notification rule not found');
    return this.prisma.notificationRule.update({ where: { id }, data: dto });
  }

  async deleteNotificationRule(id: string) {
    const rule = await this.prisma.notificationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Notification rule not found');
    await this.prisma.notificationRule.delete({ where: { id } });
    return { message: 'Notification rule deleted' };
  }
}
