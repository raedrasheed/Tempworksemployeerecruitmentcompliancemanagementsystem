/**
 * Phase 2.40 — compliance real scheduler entry point.
 *
 * The ONLY supported scheduler/cron/queue handler for compliance alert
 * generation. Wraps the Phase 2.39 fan-out helper with a flag guard
 * and structured result/error handling, so a future cron framework
 * (Nest @nestjs/schedule, Bull, k8s CronJob, …) only needs to:
 *
 *   await complianceScheduler.runScheduledComplianceAlertGeneration();
 *
 * Every guard layer below MUST be preserved by any future scheduler:
 *
 *   COMPLIANCE_ALERT_SCHEDULER_ENABLED=false
 *     ⇒ this.runScheduledComplianceAlertGeneration() returns
 *       { skipped: true, reason: 'COMPLIANCE_ALERT_SCHEDULER_ENABLED=false' }
 *       and runs zero queries.
 *
 *   COMPLIANCE_ALERT_SCHEDULER_ENABLED=true AND TENANT_JOB_FANOUT_ENABLED=false
 *     ⇒ dispatch helper is invoked but immediately refuses; zero scans.
 *
 *   scheduler + fanout + compliance pilot active
 *     ⇒ dispatch enumerates ACTIVE tenants and runs
 *       generateAlertsForTenant per tenant.
 *
 * The handler MUST NOT call:
 *   - ComplianceService.generateAlerts() directly
 *   - ComplianceService.generateAlertsForTenant() directly
 *   - any raw Prisma alert scan
 *
 * Source-level meta-assertions in the harness enforce this.
 *
 * @tenant-reviewed: phase240-compliance-real-scheduler
 */
import { Injectable, Logger } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { FeatureFlagsService } from '../saas/feature-flags/feature-flags.service';

export interface ScheduledRunResult {
  /** True when the scheduler refused to run because its own flag is off. */
  skipped: boolean;
  /** Human-readable reason when `skipped` is true. */
  reason?: string;
  /** Forwarded refusal reason from the dispatch helper, when applicable. */
  refused?: string;
  /** Number of tenants processed by the dispatch helper. */
  processed: number;
  /** Per-tenant results forwarded from the dispatch helper. */
  results: Array<{ tenantId: string; ok: boolean; total?: number; message?: string; error?: string }>;
  /** Configured cron expression (informational; no scheduler binds to it yet). */
  cron?: string;
  /** Caught error message when the dispatch helper itself throws unexpectedly. */
  error?: string;
}

@Injectable()
export class ComplianceScheduler {
  private readonly logger = new Logger('ComplianceScheduler');

  constructor(
    private readonly compliance: ComplianceService,
    private readonly flags: FeatureFlagsService,
  ) {}

  /**
   * Configured cron expression. Read from COMPLIANCE_ALERT_SCHEDULER_CRON
   * (default 0 [slash]6 [star] [star] [star] — every six hours).
   * Informational only — no cron framework is wired in this phase.
   */
  cron(): string {
    return process.env.COMPLIANCE_ALERT_SCHEDULER_CRON?.trim() || '0 */6 * * *';
  }

  /**
   * The single supported scheduler entry point. Call this from any
   * future cron / Bull / queue handler. Never call the compliance
   * service directly from a scheduler.
   *
   * Always returns a structured result; never throws.
   */
  async runScheduledComplianceAlertGeneration(): Promise<ScheduledRunResult> {
    const cron = this.cron();
    if (!this.flags.complianceAlertSchedulerEnabled()) {
      return {
        skipped: true,
        reason: 'COMPLIANCE_ALERT_SCHEDULER_ENABLED=false',
        processed: 0,
        results: [],
        cron,
      };
    }
    try {
      // The dispatch helper applies its own refusal contract
      // (TENANT_JOB_FANOUT_ENABLED, pilot active, env safe). The
      // scheduler only forwards the result.
      // @tenant-reviewed: phase240-compliance-real-scheduler
      const r = await this.compliance.dispatchComplianceAlertGenerationForTenants();
      return {
        skipped: false,
        refused: r.refused,
        processed: r.processed,
        results: r.results,
        cron,
      };
    } catch (e: any) {
      // The dispatch helper is designed not to throw, but a future
      // refactor could. Catch here so a scheduler tick never crashes
      // the host process.
      this.logger.error(`[scheduler] dispatch failed: ${e?.message ?? e}`);
      return {
        skipped: false,
        processed: 0,
        results: [],
        cron,
        error: String(e?.message ?? e),
      };
    }
  }
}
