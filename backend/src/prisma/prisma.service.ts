import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';

// Inline copy of backend/prisma/pg-ssl.ts — kept in sync manually because the
// prisma/ directory sits outside the NestJS compile root. See pg-ssl.ts for
// the full documentation of the supported libpq sslmode values.
function resolvePoolSsl(databaseUrl: string | undefined): PoolConfig['ssl'] {
  if (!databaseUrl) return false;

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return false;
  }

  switch (url.searchParams.get('sslmode')) {
    case 'disable':
    case 'allow':
      return false;
    case 'prefer':
    case 'require':
      return { rejectUnauthorized: false };
    case 'verify-ca':
      return { rejectUnauthorized: true, checkServerIdentity: () => undefined };
    case 'verify-full':
      return { rejectUnauthorized: true };
    default:
      return false;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly logger = new Logger('PrismaService');

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: resolvePoolSsl(process.env.DATABASE_URL),
    });
    const adapter = new PrismaPg(pool as any);
    super({ adapter });
    this.pool = pool;
    this.logger.log(`DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@')}`);
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected successfully');
    } catch (err) {
      this.logger.error('Prisma $connect failed:', err);
      throw err;
    }
    await this.dropPolymorphicFkConstraints();
    await this.healAdditiveDrift();
  }

  /**
   * Self-healing migration step.
   *
   * Idempotent additive ALTER/CREATE INDEX statements that bring a
   * partially-migrated dev DB up to the columns the Prisma client
   * thinks exist. Every operation uses `IF NOT EXISTS` so this is
   * safe to run on a fully migrated DB too. Failures are logged but
   * never throw — the regular query paths surface the real error.
   *
   * Add new entries here in lockstep with new additive migrations so
   * local environments don't have to chase `prisma migrate deploy`
   * every time the schema bumps.
   */
  private async healAdditiveDrift(): Promise<void> {
    const steps: Array<{ label: string; sql: string }> = [
      // Phase 2.3 — tenantId denormalisation onto entity tables.
      { label: 'documents.tenantId',     sql: `ALTER TABLE "documents"     ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
      { label: 'documents.tenantId idx', sql: `CREATE INDEX IF NOT EXISTS "documents_tenantId_idx" ON "documents"("tenantId");` },
      { label: 'audit_logs.tenantId',    sql: `ALTER TABLE "audit_logs"    ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
      { label: 'audit_logs.tenantId idx',sql: `CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");` },
      { label: 'notifications.tenantId', sql: `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
      { label: 'notifications.tenantId idx', sql: `CREATE INDEX IF NOT EXISTS "notifications_tenantId_idx" ON "notifications"("tenantId");` },
      { label: 'financial_records.tenantId', sql: `ALTER TABLE "financial_records" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
      { label: 'financial_records.tenantId idx', sql: `CREATE INDEX IF NOT EXISTS "financial_records_tenantId_idx" ON "financial_records"("tenantId");` },
      { label: 'vehicles.tenantId',      sql: `ALTER TABLE "vehicles"      ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
      { label: 'vehicles.tenantId idx',  sql: `CREATE INDEX IF NOT EXISTS "vehicles_tenantId_idx" ON "vehicles"("tenantId");` },
      { label: 'vehicle_documents.tenantId', sql: `ALTER TABLE "vehicle_documents" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
      { label: 'vehicle_documents.tenantId idx', sql: `CREATE INDEX IF NOT EXISTS "vehicle_documents_tenantId_idx" ON "vehicle_documents"("tenantId");` },
      { label: 'maintenance_records.tenantId', sql: `ALTER TABLE "maintenance_records" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
      { label: 'maintenance_records.tenantId idx', sql: `CREATE INDEX IF NOT EXISTS "maintenance_records_tenantId_idx" ON "maintenance_records"("tenantId");` },

      // Phase 2.9 — job-ads tenant scoping.
      { label: 'job_ads.tenantId',       sql: `ALTER TABLE "job_ads"       ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
      { label: 'job_ads.tenantId idx',   sql: `CREATE INDEX IF NOT EXISTS "job_ads_tenantId_idx" ON "job_ads"("tenantId");` },
      { label: 'job_ads.tenantId slug idx', sql: `CREATE INDEX IF NOT EXISTS "job_ads_tenantId_slug_idx" ON "job_ads"("tenantId","slug");` },

      // Phase 2.63 — workflow tenant scope.
      { label: 'workflows.tenantId',     sql: `ALTER TABLE "workflows"     ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
      { label: 'workflows.tenantId idx', sql: `CREATE INDEX IF NOT EXISTS "workflows_tenantId_idx" ON "workflows"("tenantId");` },
      { label: 'workflow_stages.tenantId', sql: `ALTER TABLE "workflow_stages" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
      { label: 'workflow_stages.tenantId idx', sql: `CREATE INDEX IF NOT EXISTS "workflow_stages_tenantId_idx" ON "workflow_stages"("tenantId");` },

      // Phase 3.16 — JobType soft-delete columns.
      { label: 'job_types.deletedAt',       sql: `ALTER TABLE "job_types"     ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);` },
      { label: 'job_types.deletedBy',       sql: `ALTER TABLE "job_types"     ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;` },
      { label: 'job_types.deletionReason',  sql: `ALTER TABLE "job_types"     ADD COLUMN IF NOT EXISTS "deletionReason" TEXT;` },
      { label: 'job_types.deletedAt idx',   sql: `CREATE INDEX IF NOT EXISTS "job_types_deletedAt_idx" ON "job_types"("deletedAt");` },
    ];

    let healed = 0;
    for (const step of steps) {
      try {
        await this.$executeRawUnsafe(step.sql);
        healed++;
      } catch (err: any) {
        // Most steps will be no-ops on a fully migrated DB. Only log
        // when the error is something other than "table doesn't exist".
        const msg = String(err?.message ?? err);
        if (!/relation .* does not exist|does not exist/i.test(msg)) {
          this.logger.warn(`drift-heal ${step.label}: ${msg}`);
        }
      }
    }
    this.logger.log(`drift-heal: ${healed}/${steps.length} statements applied (idempotent)`);
  }

  private async dropPolymorphicFkConstraints() {
    const client = await this.pool.connect();
    try {
      // Drop named FK constraints (ignore errors — may not exist)
      const named = [
        `ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "document_employee_fk"`,
        `ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "document_applicant_fk"`,
        `ALTER TABLE "visas" DROP CONSTRAINT IF EXISTS "visa_employee_fk"`,
        `ALTER TABLE "visas" DROP CONSTRAINT IF EXISTS "visa_applicant_fk"`,
        `ALTER TABLE "compliance_alerts" DROP CONSTRAINT IF EXISTS "alert_employee_fk"`,
        `ALTER TABLE "compliance_alerts" DROP CONSTRAINT IF EXISTS "alert_applicant_fk"`,
      ];
      for (const sql of named) {
        try { await client.query(sql); } catch { /* may not exist */ }
      }

      // Find every unique constraint on applicants.email and drop it
      const res = await client.query(`
        SELECT con.conname
        FROM   pg_constraint con
        JOIN   pg_class       rel ON rel.oid = con.conrelid
        JOIN   pg_attribute   att ON att.attrelid = rel.oid
                                 AND att.attnum = ANY(con.conkey)
        WHERE  rel.relname = 'applicants'
          AND  att.attname = 'email'
          AND  con.contype = 'u'
      `);

      if (res.rows.length === 0) {
        this.logger.log('applicants.email — no unique constraint found (already clean)');
      }
      for (const row of res.rows) {
        await client.query(`ALTER TABLE applicants DROP CONSTRAINT "${row.conname}"`);
        this.logger.log(`Dropped unique constraint "${row.conname}" on applicants.email`);
      }

      this.logger.log('Startup constraints cleanup complete');
    } catch (err: any) {
      this.logger.error('Startup constraints cleanup error:', err?.message ?? err);
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }

  async softDelete(model: string, id: string) {
    return (this as any)[model].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
