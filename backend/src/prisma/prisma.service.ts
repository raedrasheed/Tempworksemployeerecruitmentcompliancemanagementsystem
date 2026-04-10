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
  }

  private async dropPolymorphicFkConstraints() {
    const namedConstraints = [
      `ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "document_employee_fk"`,
      `ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "document_applicant_fk"`,
      `ALTER TABLE "visas" DROP CONSTRAINT IF EXISTS "visa_employee_fk"`,
      `ALTER TABLE "visas" DROP CONSTRAINT IF EXISTS "visa_applicant_fk"`,
      `ALTER TABLE "compliance_alerts" DROP CONSTRAINT IF EXISTS "alert_employee_fk"`,
      `ALTER TABLE "compliance_alerts" DROP CONSTRAINT IF EXISTS "alert_applicant_fk"`,
      `ALTER TABLE "applicants" DROP CONSTRAINT IF EXISTS "applicants_email_key"`,
    ];
    for (const sql of namedConstraints) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch {
        // constraint may not exist yet, ignore
      }
    }

    // Drop the unique constraint on applicants.email by column lookup
    // (handles any constraint name, not just the Prisma default)
    try {
      const rows = await this.$queryRaw<{ conname: string }[]>`
        SELECT con.conname
        FROM   pg_constraint con
        JOIN   pg_class       rel ON rel.oid = con.conrelid
        JOIN   pg_attribute   att ON att.attrelid = rel.oid
                                 AND att.attnum = ANY(con.conkey)
        WHERE  rel.relname  = 'applicants'
          AND  att.attname  = 'email'
          AND  con.contype  = 'u'
      `;
      for (const row of rows) {
        await this.$executeRawUnsafe(
          `ALTER TABLE "applicants" DROP CONSTRAINT IF EXISTS "${row.conname}"`,
        );
        this.logger.log(`Dropped unique constraint "${row.conname}" on applicants.email`);
      }
    } catch {
      // ignore — constraint already gone or table doesn't exist yet
    }

    this.logger.log('Startup constraints cleanup complete');
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
