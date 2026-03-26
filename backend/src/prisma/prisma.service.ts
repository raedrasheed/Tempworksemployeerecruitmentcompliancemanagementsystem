import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function resolvePoolSsl(
  databaseUrl: string | undefined,
): false | { rejectUnauthorized: boolean } | undefined {
  if (!databaseUrl) return undefined;
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return undefined;
  }
  const sslmode = url.searchParams.get('sslmode');
  switch (sslmode) {
    case 'disable':
      return false;
    case 'require':
    case 'prefer':
    case 'verify-ca':
      return { rejectUnauthorized: false };
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
    const client = await this.pool.connect();
    try {
      await client.query(`
        ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "document_employee_fk";
        ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "document_applicant_fk";
        ALTER TABLE "visas" DROP CONSTRAINT IF EXISTS "visa_employee_fk";
        ALTER TABLE "visas" DROP CONSTRAINT IF EXISTS "visa_applicant_fk";
        ALTER TABLE "compliance_alerts" DROP CONSTRAINT IF EXISTS "alert_employee_fk";
        ALTER TABLE "compliance_alerts" DROP CONSTRAINT IF EXISTS "alert_applicant_fk";
      `);
    } catch {
      // constraints may not exist yet, ignore
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
