/**
 * Phase 2.30 — Shared tenant-aware audit-log emitter.
 *
 * Consolidates the per-module `legacyPrisma.auditLog.create` call sites
 * (finance, documents, vehicles, workflow, applicants — and any future
 * piloted module) behind a single helper.
 *
 * Behaviour:
 *
 *   - With `TENANT_AUDIT_LOG_PILOT_ENABLED=false` (default) OR a runtime
 *     environment that is NOT SAFE_CLONE / SAFE_STAGING: writes the row
 *     with NO `tenantId` — byte-identical to the pre-2.30 behaviour.
 *
 *   - With the pilot flag ON AND a SAFE_CLONE/SAFE_STAGING env AND an
 *     ALS tenant frame in scope (or an explicit `tenantId` argument):
 *     writes `tenantId` alongside the rest of the row.
 *
 *   - Never throws. The audit emission is fire-and-forget by contract;
 *     a failure is logged at warn level and swallowed so the caller's
 *     main flow is never disturbed.
 *
 * The shared helper is the ONLY place that decides whether to attach
 * `tenantId` to an audit row, so future modules don't need their own
 * `*-audit-log` annotation tag — they just call `auditLog.write(...)`.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { TenantContext } from '../context/als';
import { classifyRuntimeEnv, isStagingClassification } from '../tenancy/env-safety';

export interface TenantAuditLogInput {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entity: string;
  entityId: string;
  changes?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /**
   * Explicit tenant override for system jobs / cron paths that do not
   * have an ALS frame. Optional — when omitted, the helper reads the
   * active ALS tenant.
   */
  tenantId?: string | null;
}

export interface AuditDecision {
  active: boolean;
  tenantId: string | null;
  reason: string;
}

@Injectable()
export class TenantAuditLogService {
  private readonly logger = new Logger('TenantAuditLog');

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
  ) {}

  /**
   * Emit a single audit row. Never throws. See class docstring for the
   * tenant-attribution decision matrix.
   */
  async write(input: TenantAuditLogInput): Promise<void> {
    const decision = this.decide(input.tenantId ?? null);
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? undefined,
          userEmail: input.userEmail ?? undefined,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          changes: (input.changes ?? undefined) as any,
          ipAddress: input.ipAddress ?? undefined,
          userAgent: input.userAgent ?? undefined,
          ...(decision.active && decision.tenantId
            ? { tenantId: decision.tenantId }
            : {}),
        },
      });
    } catch (err) {
      this.logger.warn(
        `audit emit failed (entity=${input.entity} action=${input.action}): ${
          (err as Error)?.message ?? err
        }`,
      );
      // Audit must never crash the main flow.
    }
  }

  /**
   * Phase 2.52 — Tenant-scoped read helpers. Always non-destructive.
   * `listForTenant` and `countForTenant` apply the explicit/active
   * tenantId equality filter. NULL-tenant rows are excluded by
   * design — callers wanting the legacy union must use the legacy
   * `LogsService.findAll` path with the pilot flag off.
   */
  async listForTenant(opts: {
    tenantId: string;
    entity?: string;
    entityId?: string;
    action?: string;
    userId?: string;
    fromDate?: string | Date;
    toDate?: string | Date;
    page?: number;
    limit?: number;
  }): Promise<{ items: any[]; total: number }> {
    const where = this.buildTenantWhere(opts);
    const skip = ((opts.page ?? 1) - 1) * (opts.limit ?? 20);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ // @tenant-reviewed: phase252-audit-log-read-pilot
        where,
        skip,
        take: opts.limit ?? 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }), // @tenant-reviewed: phase252-audit-log-read-pilot
    ]);
    return { items, total };
  }

  async countForTenant(opts: {
    tenantId: string;
    entity?: string;
    entityId?: string;
    action?: string;
    userId?: string;
    fromDate?: string | Date;
    toDate?: string | Date;
  }): Promise<number> {
    return this.prisma.auditLog.count({ where: this.buildTenantWhere(opts) }); // @tenant-reviewed: phase252-audit-log-read-pilot
  }

  async getByIdForTenant(tenantId: string, id: string): Promise<any | null> {
    return this.prisma.auditLog.findFirst({ // @tenant-reviewed: phase252-audit-log-read-pilot
      where: { id, tenantId, deletedAt: null },
    });
  }

  /**
   * Phase 2.52 — Retention PREVIEW. Read-only by contract; never
   * deletes or modifies rows. With `AUDIT_LOG_RETENTION_ENABLED=false`
   * (default) the helper still returns counts, but it documents the
   * disabled state in the result so operators can confirm the gate.
   *
   * `tenantId === null` ⇒ count NULL-tenant legacy rows (legacy mode).
   * `tenantId === <id>` ⇒ count rows for that tenant only.
   */
  async previewRetention(opts: {
    tenantId: string | null;
    days?: number;
  }): Promise<{
    enabled: boolean;
    days: number;
    cutoffIso: string;
    candidateCount: number;
    tenantId: string | null;
  }> {
    const enabled = String(process.env.AUDIT_LOG_RETENTION_ENABLED ?? '').toLowerCase() === 'true';
    const rawDays = opts.days ?? Number(process.env.AUDIT_LOG_RETENTION_DAYS);
    const days = Number.isFinite(rawDays) && rawDays! > 0 ? Math.floor(rawDays!) : 365;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where: any = { deletedAt: null, createdAt: { lt: cutoff } };
    if (opts.tenantId === null) where.tenantId = null;
    else where.tenantId = opts.tenantId;
    const candidateCount = await this.prisma.auditLog.count({ where }); // @tenant-reviewed: phase252-audit-log-retention-preview
    return {
      enabled,
      days,
      cutoffIso: cutoff.toISOString(),
      candidateCount,
      tenantId: opts.tenantId,
    };
  }

  private buildTenantWhere(opts: {
    tenantId: string;
    entity?: string;
    entityId?: string;
    action?: string;
    userId?: string;
    fromDate?: string | Date;
    toDate?: string | Date;
  }): Record<string, unknown> {
    const where: any = { tenantId: opts.tenantId, deletedAt: null };
    if (opts.entity) where.entity = opts.entity;
    if (opts.entityId) where.entityId = opts.entityId;
    if (opts.action) where.action = { contains: opts.action, mode: 'insensitive' };
    if (opts.userId) where.userId = opts.userId;
    if (opts.fromDate || opts.toDate) {
      where.createdAt = {};
      if (opts.fromDate) where.createdAt.gte = new Date(opts.fromDate);
      if (opts.toDate) where.createdAt.lte = new Date(opts.toDate);
    }
    return where;
  }

  /**
   * Diagnostic for harnesses. Pure; no DB writes.
   */
  decide(explicit: string | null): AuditDecision {
    if (!this.flags.tenantAuditLogPilotEnabled()) {
      return { active: false, tenantId: null, reason: 'TENANT_AUDIT_LOG_PILOT_ENABLED=false' };
    }
    const env = classifyRuntimeEnv();
    if (!isStagingClassification(env.classification)) {
      return {
        active: false,
        tenantId: null,
        reason: `env=${env.classification} is not SAFE_CLONE/SAFE_STAGING`,
      };
    }
    if (explicit) {
      return { active: true, tenantId: explicit, reason: 'explicit tenantId override' };
    }
    const ctx = TenantContext.optional?.();
    if (!ctx?.id) {
      return { active: false, tenantId: null, reason: 'pilot ON but no ALS tenant frame' };
    }
    return { active: true, tenantId: ctx.id, reason: `pilot ON, env=${env.classification}` };
  }
}
