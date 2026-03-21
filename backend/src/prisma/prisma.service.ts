import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool as any);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    await this.dropPolymorphicFkConstraints();
  }

  private async dropPolymorphicFkConstraints() {
    const constraints: Array<{ table: string; name: string }> = [
      { table: 'documents', name: 'document_employee_fk' },
      { table: 'documents', name: 'document_applicant_fk' },
      { table: 'visas', name: 'visa_employee_fk' },
      { table: 'visas', name: 'visa_applicant_fk' },
      { table: 'compliance_alerts', name: 'alert_employee_fk' },
      { table: 'compliance_alerts', name: 'alert_applicant_fk' },
    ];
    for (const { table, name } of constraints) {
      await this.$executeRawUnsafe(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}"`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async softDelete(model: string, id: string) {
    return (this as any)[model].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
