import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { FeatureFlagsModule } from '../saas/feature-flags/feature-flags.module';
import { TenantPrismaService } from '../saas/prisma/tenant-prisma.service';
import { PilotPrismaAccessor } from '../saas/prisma/pilot-prisma.accessor';

/**
 * Phase 2.10 — fourth tenant-scoped TenantPrisma pilot.
 *
 * Imports the pilot dependencies for the read-facing service paths.
 * The scheduler + background notification-creation paths
 * (`checkExpiringCompliance`, `checkServiceDue`, `checkOverdue`,
 * `checkScheduledMaintenance`, `runAllChecks`, `notifyUploaderAndRoles`,
 * `notifyUsersByRoles`) are EXPLICITLY out of scope and continue to
 * run on `legacyPrisma`. See `SAAS_PHASE2_NOTIFICATIONS_SCOPE_SPLIT.md`.
 */
@Module({
  imports: [FeatureFlagsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsSchedulerService,
    TenantPrismaService,
    PilotPrismaAccessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
