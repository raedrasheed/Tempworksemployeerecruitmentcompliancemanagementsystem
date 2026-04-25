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

  async getPublicFormSettings(): Promise<Record<string, any>> {
    const settings = await this.prisma.systemSetting.findMany({
      where: { category: 'form' },
      orderBy: { key: 'asc' },
    });
    const result: Record<string, any> = {};
    for (const s of settings) {
      // Strip category prefix (e.g. "form.visaTypes" → "visaTypes")
      const key = s.key.replace(/^form\./, '');
      try { result[key] = JSON.parse(s.value); } catch { result[key] = s.value; }
    }
    return result;
  }

  // ─── Vehicle Settings (centralised lookup lists) ─────────────────────────────
  // Every vehicle dropdown list (statuses, fuel types, body types, etc.)
  // is stored in system_settings under the `vehicle` category as a
  // JSON-encoded array of strings. The frontend Vehicle Settings page
  // and Vehicle form both read from this single endpoint.
  private readonly VEHICLE_LOOKUP_KEYS = [
    'vehicle.vehicleTypes',
    'vehicle.statuses',
    'vehicle.fuelTypes',
    'vehicle.bodyTypes',
    'vehicle.hitchTypes',
    'vehicle.tankMaterials',
    'vehicle.adrClasses',
    'vehicle.vinSubTypes',
    'vehicle.insuranceGroups',
    'vehicle.insuranceTypes',
    'vehicle.documentTypes',
    'vehicle.euroEmissionClasses',
  ];

  async getVehicleSettings(): Promise<Record<string, string[]>> {
    const settings = await this.prisma.systemSetting.findMany({
      where: { category: 'vehicle' },
    });
    const result: Record<string, string[]> = {};
    for (const key of this.VEHICLE_LOOKUP_KEYS) {
      const found = settings.find((s) => s.key === key);
      const short = key.replace(/^vehicle\./, '');
      if (!found) { result[short] = []; continue; }
      try {
        const parsed = JSON.parse(found.value);
        result[short] = Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
      } catch {
        result[short] = [];
      }
    }
    return result;
  }

  async updateVehicleSetting(shortKey: string, values: string[], userId: string) {
    const fullKey = `vehicle.${shortKey}`;
    if (!this.VEHICLE_LOOKUP_KEYS.includes(fullKey)) {
      throw new NotFoundException(`Unknown vehicle settings key: ${shortKey}`);
    }
    const cleaned = Array.from(
      new Set(
        (values ?? [])
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v) => v.length > 0),
      ),
    );
    const updated = await this.prisma.systemSetting.upsert({
      where: { key: fullKey },
      update: { value: JSON.stringify(cleaned), updatedById: userId },
      create: {
        key: fullKey,
        value: JSON.stringify(cleaned),
        category: 'vehicle',
        description: `Vehicle Management — ${shortKey} lookup`,
        isPublic: false,
        updatedById: userId,
      },
    });
    await this.auditLog.log({
      userId,
      action: 'UPDATE',
      entity: 'VehicleSetting',
      entityId: fullKey,
      changes: { values: cleaned },
    });
    return { key: shortKey, values: cleaned, updatedAt: updated.updatedAt };
  }

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
        create: {
          key, value, updatedById: userId, description: key,
          category: key.split('.')[0] || 'general',
          isPublic: key.startsWith('branding.'),
        },
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

  // ─── Branding ────────────────────────────────────────────────────────────────
  async getBranding(): Promise<Record<string, string>> {
    // Query by key prefix — batchUpdate may store with a different category
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'branding.' } },
    });
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key.replace('branding.', '')] = s.value;
    }
    return result;
  }

  async uploadLogo(file: Express.Multer.File, userId: string) {
    const logoUrl = `/uploads/${file.filename}`;
    await this.prisma.systemSetting.upsert({
      where: { key: 'branding.logoUrl' },
      update: { value: logoUrl, updatedById: userId },
      create: { key: 'branding.logoUrl', value: logoUrl, category: 'branding', description: 'Company logo URL', isPublic: true, updatedById: userId },
    });
    await this.auditLog.log({ userId, action: 'UPDATE', entity: 'Settings', entityId: 'branding.logoUrl', changes: { logoUrl } });
    return { logoUrl };
  }

  // ─── Job Types ──────────────────────────────────────────────────────────────
  async findJobTypes() {
    return this.prisma.jobType.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { applicants: true } } },
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

  // ─── Finance Transaction Types ───────────────────────────────────────────────
  // Configurable list that populates the "Transaction Type" dropdown
  // on the financial record form. Historical financial_records rows
  // keep their plain-string transactionType regardless of whether a
  // type is deactivated later.

  async findTransactionTypes(opts?: { includeInactive?: boolean }) {
    return (this.prisma as any).financeTransactionType.findMany({
      where: opts?.includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createTransactionType(dto: { name: string; sortOrder?: number; isActive?: boolean }, actorId?: string) {
    const trimmed = (dto.name ?? '').trim();
    if (!trimmed) throw new NotFoundException('Name is required');
    try {
      const created = await (this.prisma as any).financeTransactionType.create({
        data: {
          name: trimmed,
          sortOrder: dto.sortOrder ?? 100,
          isActive: dto.isActive ?? true,
        },
      });
      await this.auditLog.log({
        userId: actorId, action: 'CREATE', entity: 'FinanceTransactionType',
        entityId: created.id, changes: { name: created.name },
      });
      return created;
    } catch (err: any) {
      // Unique-constraint collision — friendly error.
      if (err?.code === 'P2002') throw new NotFoundException(`Transaction type "${trimmed}" already exists`);
      throw err;
    }
  }

  async updateTransactionType(
    id: string,
    dto: { name?: string; sortOrder?: number; isActive?: boolean },
    actorId?: string,
  ) {
    const existing = await (this.prisma as any).financeTransactionType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Transaction type not found');
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    try {
      const updated = await (this.prisma as any).financeTransactionType.update({ where: { id }, data });
      await this.auditLog.log({
        userId: actorId, action: 'UPDATE', entity: 'FinanceTransactionType',
        entityId: id, changes: dto as any,
      });
      return updated;
    } catch (err: any) {
      if (err?.code === 'P2002') throw new NotFoundException(`Transaction type "${data.name}" already exists`);
      throw err;
    }
  }

  // ─── Work History Event Types ───────────────────────────────────────────────
  // Populates the Event Type dropdown inside the Employee profile's
  // Contracts tab. Deactivating a type hides it from the dropdown but
  // keeps existing employee_work_history rows intact (value is a free
  // string on that table).

  async findWorkHistoryEventTypes(opts?: { includeInactive?: boolean }) {
    return (this.prisma as any).workHistoryEventTypeSetting.findMany({
      where: opts?.includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async createWorkHistoryEventType(
    dto: { value: string; label: string; sortOrder?: number; isActive?: boolean },
    actorId?: string,
  ) {
    const value = (dto.value ?? '').trim();
    const label = (dto.label ?? '').trim();
    if (!value) throw new NotFoundException('Value is required');
    if (!label) throw new NotFoundException('Label is required');
    try {
      const created = await (this.prisma as any).workHistoryEventTypeSetting.create({
        data: {
          value,
          label,
          sortOrder: dto.sortOrder ?? 100,
          isActive: dto.isActive ?? true,
        },
      });
      await this.auditLog.log({
        userId: actorId, action: 'CREATE', entity: 'WorkHistoryEventType',
        entityId: created.id, changes: { value, label },
      });
      return created;
    } catch (err: any) {
      if (err?.code === 'P2002') throw new NotFoundException(`Event type "${value}" already exists`);
      throw err;
    }
  }

  async updateWorkHistoryEventType(
    id: string,
    dto: { value?: string; label?: string; sortOrder?: number; isActive?: boolean },
    actorId?: string,
  ) {
    const existing = await (this.prisma as any).workHistoryEventTypeSetting.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event type not found');
    const data: any = {};
    if (dto.value !== undefined)     data.value = dto.value.trim();
    if (dto.label !== undefined)     data.label = dto.label.trim();
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined)  data.isActive = dto.isActive;
    try {
      const updated = await (this.prisma as any).workHistoryEventTypeSetting.update({ where: { id }, data });
      await this.auditLog.log({
        userId: actorId, action: 'UPDATE', entity: 'WorkHistoryEventType',
        entityId: id, changes: dto as any,
      });
      return updated;
    } catch (err: any) {
      if (err?.code === 'P2002') throw new NotFoundException(`Event type "${data.value}" already exists`);
      throw err;
    }
  }

  async deleteWorkHistoryEventType(id: string, actorId?: string) {
    const existing = await (this.prisma as any).workHistoryEventTypeSetting.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event type not found');
    await (this.prisma as any).workHistoryEventTypeSetting.update({
      where: { id }, data: { isActive: false },
    });
    await this.auditLog.log({
      userId: actorId, action: 'DELETE', entity: 'WorkHistoryEventType',
      entityId: id, changes: { value: existing.value, label: existing.label },
    });
    return { message: 'Event type deactivated' };
  }

  async deleteTransactionType(id: string, actorId?: string) {
    const existing = await (this.prisma as any).financeTransactionType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Transaction type not found');
    // Soft delete — deactivate so existing financial_records keep
    // rendering the label without reintroducing it to the dropdown.
    await (this.prisma as any).financeTransactionType.update({ where: { id }, data: { isActive: false } });
    await this.auditLog.log({
      userId: actorId, action: 'DELETE', entity: 'FinanceTransactionType',
      entityId: id, changes: { name: existing.name },
    });
    return { message: 'Transaction type deactivated' };
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
    return this.prisma.stageTemplate.findMany({ orderBy: { order: 'asc' } });
  }

  async createWorkflowStage(dto: any, actorId?: string) {
    const maxOrder = await this.prisma.stageTemplate.aggregate({ _max: { order: true } });
    const nextOrder = (maxOrder._max.order ?? 0) + 1;
    const stage = await this.prisma.stageTemplate.create({
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
      entity: 'StageTemplate',
      entityId: stage.id,
      changes: { name: stage.name },
    });
    return stage;
  }

  async updateWorkflowStage(id: string, dto: any, actorId?: string) {
    const stage = await this.prisma.stageTemplate.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException('Workflow stage not found');
    const updated = await this.prisma.stageTemplate.update({ where: { id }, data: dto });
    await this.auditLog.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'StageTemplate',
      entityId: id,
      changes: dto,
    });
    return updated;
  }

  async deleteWorkflowStage(id: string, actorId?: string) {
    const stage = await this.prisma.stageTemplate.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException('Workflow stage not found');
    await this.prisma.stageTemplate.update({ where: { id }, data: { isActive: false } });
    await this.auditLog.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'StageTemplate',
      entityId: id,
      changes: { name: stage.name },
    });
    return { message: 'Workflow stage deleted' };
  }

  async reorderWorkflowStages(orders: { id: string; order: number }[], actorId?: string) {
    await Promise.all(
      orders.map(({ id, order }) =>
        this.prisma.stageTemplate.update({ where: { id }, data: { order } }),
      ),
    );
    await this.auditLog.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'StageTemplate',
      entityId: 'bulk',
      changes: { reorder: orders },
    });
    return { message: 'Stages reordered' };
  }

  // ─── System Information ──────────────────────────────────────────────────────
  private readonly SYSTEM_INFO_KEYS = [
    'system.version',
    'system.organizationName',
    'system.contactEmail',
    'system.supportPhone',
    'system.address',
    'system.website',
    'system.lastUpdated',
  ];

  async getSystemInfo(): Promise<Record<string, string>> {
    const settings = await this.prisma.systemSetting.findMany({
      where: { category: 'system' },
    });
    const map: Record<string, string> = {};
    for (const key of this.SYSTEM_INFO_KEYS) {
      const found = settings.find((s) => s.key === key);
      map[key.replace('system.', '')] = found?.value ?? '';
    }
    return map;
  }

  async updateSystemInfo(data: Record<string, string>, userId: string): Promise<Record<string, string>> {
    for (const [field, value] of Object.entries(data)) {
      const key = `system.${field}`;
      if (!this.SYSTEM_INFO_KEYS.includes(key)) continue;
      await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value, updatedById: userId },
        create: { key, value, updatedById: userId, description: field, category: 'system', isPublic: false },
      });
    }
    await this.auditLog.log({
      userId,
      action: 'UPDATE',
      entity: 'SystemInfo',
      entityId: 'system',
      changes: data as any,
    });
    return this.getSystemInfo();
  }

  async getSystemStats(): Promise<Record<string, any>> {
    const [userCount, employeeCount, applicantCount, agencyCount] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.applicant.count({ where: { deletedAt: null } }),
      this.prisma.agency.count({ where: { deletedAt: null } }),
    ]);
    return {
      totalUsers: userCount,
      totalEmployees: employeeCount,
      totalApplicants: applicantCount,
      totalAgencies: agencyCount,
      databaseStatus: 'Connected',
    };
  }

  // ─── Notification Rules ──────────────────────────────────────────────────────
  async findNotificationRules() {
    return this.prisma.notificationRule.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
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
    await this.prisma.notificationRule.update({ where: { id }, data: { deletedAt: new Date() } });
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
