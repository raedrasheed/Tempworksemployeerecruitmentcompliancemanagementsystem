import { Global, Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { AuditLogService } from './audit-log.service';
import { FeatureFlagsModule } from '../saas/feature-flags/feature-flags.module';
import { TenantPrismaService } from '../saas/prisma/tenant-prisma.service';
import { PilotPrismaAccessor } from '../saas/prisma/pilot-prisma.accessor';

@Global()
@Module({
  imports: [FeatureFlagsModule],
  controllers: [LogsController],
  providers: [LogsService, AuditLogService, TenantPrismaService, PilotPrismaAccessor],
  exports: [AuditLogService],
})
export class LogsModule {}
