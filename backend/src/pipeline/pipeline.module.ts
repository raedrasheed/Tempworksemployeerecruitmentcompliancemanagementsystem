import { Module } from '@nestjs/common';
import { WorkflowService } from './pipeline.service';
import { WorkflowController } from './pipeline.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FeatureFlagsModule } from '../saas/feature-flags/feature-flags.module';
import { TenantPrismaService } from '../saas/prisma/tenant-prisma.service';
import { PilotPrismaAccessor } from '../saas/prisma/pilot-prisma.accessor';

/**
 * Phase 2.61 — Pipeline reads-first TenantPrisma pilot.
 *
 * Wires `TenantPrismaService` + `PilotPrismaAccessor` so
 * `WorkflowService` can route assignment-driven reads through the
 * pilot client with `scope.tenantWhere()`. Workflow / WorkflowStage
 * configuration remains GLOBAL by design (no `tenantId` column).
 */
@Module({
  imports: [PrismaModule, FeatureFlagsModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, TenantPrismaService, PilotPrismaAccessor],
  exports: [WorkflowService],
})
export class WorkflowPipelineModule {}
