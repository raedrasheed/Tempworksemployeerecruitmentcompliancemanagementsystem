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
    // Every table on this list must carry a nullable `tenantId TEXT`
    // column plus a btree index. Listed centrally so adding a new
    // tenant-scoped model is a one-line edit.
    const tenantIdTables = [
      // Phase 1 baseline (idempotent — usually already present).
      'agencies', 'applicants', 'employees',
      // Phase 2.3 entity-keyed denorm + later additions.
      'documents', 'audit_logs', 'notifications', 'financial_records',
      'financial_record_attachments', 'financial_record_deductions',
      'vehicles', 'vehicle_documents', 'maintenance_records',
      'visas', 'work_permits',
      'compliance_alerts',
      'attendance_records', 'attendance_locked_periods',
      'employee_work_history', 'employee_work_history_attachments',
      // Phase 2.9 — job ads.
      'job_ads',
      // Phase 2.63 — workflows + assignments.
      'workflows', 'workflow_stages',
      'candidate_workflow_assignments', 'employee_workflow_assignments',
      // Phase 3.10 — platform audit log.
      'platform_audit_logs',
      // SaaS bookkeeping.
      'saas_phase1_seq_snapshot',
      // Phase 3.19 — Workshop tenant scope.
      'workshops',
    ];

    const steps: Array<{ label: string; sql: string }> = [
      ...tenantIdTables.flatMap((tbl) => [
        { label: `${tbl}.tenantId`,     sql: `ALTER TABLE "${tbl}" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;` },
        { label: `${tbl}.tenantId idx`, sql: `CREATE INDEX IF NOT EXISTS "${tbl}_tenantId_idx" ON "${tbl}"("tenantId");` },
      ]),

      // Phase 2.9 — job-ads composite index used by the slug lookups.
      { label: 'job_ads.tenantId slug idx', sql: `CREATE INDEX IF NOT EXISTS "job_ads_tenantId_slug_idx" ON "job_ads"("tenantId","slug");` },

      // IntervalMode column on maintenance_types — present in schema
      // since the maintenance types phase; some dev DBs predate the
      // migration.
      { label: 'IntervalMode enum',         sql: `DO $$ BEGIN CREATE TYPE "IntervalMode" AS ENUM ('DAYS', 'KM', 'BOTH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
      { label: 'maintenance_types.intervalMode', sql: `ALTER TABLE "maintenance_types" ADD COLUMN IF NOT EXISTS "intervalMode" "IntervalMode" DEFAULT 'KM';` },

      // Phase 3.16 — JobType soft-delete columns.
      { label: 'job_types.deletedAt',       sql: `ALTER TABLE "job_types"     ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);` },
      { label: 'job_types.deletedBy',       sql: `ALTER TABLE "job_types"     ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;` },
      { label: 'job_types.deletionReason',  sql: `ALTER TABLE "job_types"     ADD COLUMN IF NOT EXISTS "deletionReason" TEXT;` },
      { label: 'job_types.deletedAt idx',   sql: `CREATE INDEX IF NOT EXISTS "job_types_deletedAt_idx" ON "job_types"("deletedAt");` },

      // Phase 3.21 — Attendance interruption + UNPAID_LEAVE status.
      { label: 'attendance_records.interruptionIn',     sql: `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "interruptionIn" TEXT;` },
      { label: 'attendance_records.interruptionOut',    sql: `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "interruptionOut" TEXT;` },
      { label: 'attendance_records.interruptionStatus', sql: `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "interruptionStatus" "AttendanceStatus";` },
      { label: 'AttendanceStatus.UNPAID_LEAVE',         sql: `ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'UNPAID_LEAVE';` },

      // Phase 3.20 — Company Export Profiles for the Excel timesheet header.
      { label: 'company_export_profiles table', sql: `
        CREATE TABLE IF NOT EXISTS "company_export_profiles" (
          "id"                 TEXT PRIMARY KEY,
          "name"               TEXT NOT NULL,
          "legalName"          TEXT,
          "addressLine1"       TEXT,
          "addressLine2"       TEXT,
          "city"               TEXT,
          "postalCode"         TEXT,
          "country"            TEXT,
          "phone"              TEXT,
          "email"              TEXT,
          "vatNumber"          TEXT,
          "registrationNumber" TEXT,
          "logoUrl"            TEXT,
          "footer"             TEXT,
          "isDefault"          BOOLEAN NOT NULL DEFAULT false,
          "deletedAt"          TIMESTAMP(3),
          "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "tenantId"           TEXT
        );` },
      { label: 'company_export_profiles.tenantId idx', sql: `CREATE INDEX IF NOT EXISTS "company_export_profiles_tenantId_idx" ON "company_export_profiles"("tenantId");` },
      { label: 'company_export_profiles.deletedAt idx', sql: `CREATE INDEX IF NOT EXISTS "company_export_profiles_deletedAt_idx" ON "company_export_profiles"("deletedAt");` },
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
