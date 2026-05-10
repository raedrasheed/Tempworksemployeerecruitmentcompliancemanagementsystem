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
