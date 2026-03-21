import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    super();
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  async onModuleInit() {
    await this.$connect();
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
