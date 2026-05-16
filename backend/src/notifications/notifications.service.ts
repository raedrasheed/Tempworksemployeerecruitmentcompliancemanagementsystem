import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { EVENT_TO_TYPE, NotifEventKey } from './notification-events';
import { tServer, ServerLocale } from '../common/i18n/server-translate';
import { PilotPrismaAccessor } from '../saas/prisma/pilot-prisma.accessor';
import { getPilotScope, PilotScope } from '../saas/prisma/tenant-pilot-scope';
import { FeatureFlagsService } from '../saas/feature-flags/feature-flags.service';
import {
  TenantJobFanoutPlanner,
  runForTenantBatch,
} from '../saas/jobs';
import { TenantContext, MissingTenantContextError } from '../saas/context/als';
import { classifyRuntimeEnv, isStagingClassification } from '../saas/tenancy/env-safety';

/**
 * Phase 2.10 — fourth tenant-scoped TenantPrisma pilot.
 *
 * IN SCOPE for tenant-safe routing:
 *   - getUserNotifications, getUnreadCount, markAsRead, markAllAsRead
 *   - wasHighBalanceAlertRecentlySent (read probe)
 *
 * EXPLICITLY OUT OF SCOPE (continue to use `legacyPrisma`; these will
 * be revisited in a later phase that introduces a job-context for
 * background workers):
 *   - checkExpiringCompliance / checkServiceDue / checkOverdue /
 *     checkScheduledMaintenance / runAllChecks
 *   - notifyUploaderAndRoles / notifyUsersByRoles
 *   - getOrCreatePreferences / updatePreferences (NotificationPreference
 *     has NO `tenantId` — it is a per-user global record)
 *
 * The pilot scope is active iff:
 *   - `TENANT_PRISMA_PILOT_ENABLED=true`, AND
 *   - `TENANT_PRISMA_PILOT_MODULES` empty or includes `notifications`, AND
 *   - env classifies as SAFE_CLONE / SAFE_STAGING, AND
 *   - a tenant is in the active ALS frame.
 *
 * With the flag OFF (production default) the spreads return `{}` and
 * every read path is byte-identical to before this PR.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('NotificationsService');

  constructor(
    private readonly legacyPrisma: PrismaService,
    private readonly pilot: PilotPrismaAccessor,
    /** Optional: when undefined, the tenant-aware paths default to
     *  legacy behaviour (flags treated as off). The harness can pass
     *  a configured FeatureFlagsService to drive the new path. */
    private readonly flags?: FeatureFlagsService,
  ) {}

  /** True iff Phase 2.14's tenant-aware scheduler path is engaged. */
  private tenantAwareSchedulerActive(): boolean {
    if (!this.flags) return false;
    if (!this.flags.tenantAwareJobsEnabled()) return false;
    if (!this.flags.tenantJobFanoutEnabled()) return false;
    const env = classifyRuntimeEnv();
    return isStagingClassification(env.classification);
  }

  /**
   * Phase 2.14.1 — per-method tenant narrowing helper.
   *
   * Returns the active tenant id when:
   *   - the tenant-aware scheduler path is engaged, AND
   *   - a tenant is in the active ALS frame.
   *
   * Returns `null` in every other case — including:
   *   - any flag off,
   *   - production / unsafe env,
   *   - inside `runAllChecks` (legacy path; never wrapped in
   *     `runForTenant`),
   *   - direct test calls without an ALS frame.
   *
   * Each `check*` method consults this once at the top of its body
   * and spreads the result into its `where` / `data`. When `null`,
   * the spread is `{}` and the method runs byte-identically to its
   * pre-Phase-2.14.1 form.
   */
  private narrowingTenantId(): string | null {
    if (!this.tenantAwareSchedulerActive()) return null;
    return TenantContext.optional()?.id ?? null;
  }

  /** Prisma surface for in-scope read paths. Background workers keep
   *  using `this.legacyPrisma` directly — see scope-split doc. */
  private get prisma(): PrismaService {
    return this.pilot.client();
  }

  private scope(): PilotScope {
    return getPilotScope(this.pilot, 'notifications');
  }

  /**
   * Translate a stored notification row into the active locale.
   *
   * Lookup order per field:
   *   1. `tServer(<key>, params, locale)` when `titleKey`/`messageKey`
   *      is set AND the catalog has a matching entry
   *   2. the stored English `title`/`message` (always populated)
   *
   * `tServer()` already falls back through (locale → en → verbatim key),
   * so a brand-new producer key with no catalog entry yet shows the key
   * string in dev — making missing translations easy to spot — without
   * losing the legacy English message that the reader returns alongside.
   */
  private translateRow<T extends { title: string; message: string; titleKey: string | null; messageKey: string | null; params: any }>(
    row: T,
    locale: ServerLocale,
  ): T {
    const params = (row.params && typeof row.params === 'object' ? row.params : {}) as Record<string, unknown>;
    const translatedTitle = row.titleKey
      ? tServer(row.titleKey, params, locale, 'notifications')
      : null;
    const translatedMessage = row.messageKey
      ? tServer(row.messageKey, params, locale, 'notifications')
      : null;
    return {
      ...row,
      // Replace the field with the translated value when available.
      // Crucially we never overwrite when the key is null — legacy rows
      // (where titleKey is null) keep the original English text intact.
      title: translatedTitle && translatedTitle !== row.titleKey ? translatedTitle : row.title,
      message: translatedMessage && translatedMessage !== row.messageKey ? translatedMessage : row.message,
    };
  }

  /// Get notifications for a user with pagination.
  /// `locale` is the resolved `Accept-Language` value; defaults to 'en'.
  /// `caller` is passed through so external actors (Agency User/Manager
  /// + custom roles tied to a non-system agency) only see notifications
  /// about entities they can actually access — see callerEntityFilter().
  async getUserNotifications(
    userId: string,
    skip = 0,
    take = 20,
    locale: ServerLocale = 'en',
    caller?: { agencyId?: string; agencyIsSystem?: boolean },
  ) {
    const t = this.scope().tenantWhere();
    const entityFilter = await this.callerEntityFilter(caller);
    const where = { userId, deletedAt: null, ...t, ...entityFilter };
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({ // @tenant-reviewed: phase210-pilot-scope
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ // @tenant-reviewed: phase210-pilot-scope
        where,
      }),
    ]);
    return { data: notifications.map(n => this.translateRow(n as any, locale)), total };
  }

  /// Get unread notification count for a user
  async getUnreadCount(
    userId: string,
    caller?: { agencyId?: string; agencyIsSystem?: boolean },
  ): Promise<number> {
    const t = this.scope().tenantWhere();
    const entityFilter = await this.callerEntityFilter(caller);
    return this.prisma.notification.count({ // @tenant-reviewed: phase210-pilot-scope
      where: { userId, isRead: false, deletedAt: null, ...t, ...entityFilter },
    });
  }

  /**
   * Phase 3.22 — restrict notifications about Employees/Applicants to
   * the entities the caller can actually view. Without this filter an
   * Officer (or any custom external role) sees notifications about
   * every employee in the tenant simply because finance/document
   * fan-out broadcast their notification to every user with the
   * relevant role at creation time. Returns `{}` for PlatformAdmin
   * and System Admin so they keep the global view.
   *
   * Filter shape:
   *   • Notifications with no relatedEntity              → pass
   *   • Notifications about anything except Employee /
   *     Applicant (Vehicle, MaintenanceRecord, Document,
   *     etc.)                                            → pass
   *   • Notifications about Employee / Applicant         → only if
   *     relatedEntityId is one the caller has access to
   *
   * The Employee accessible set comes from
   * EmployeeAgencyAccess(canView=true), the same source
   * EmployeesService.findAll uses. The Applicant set comes from
   * agencyId == caller.agencyId (mirrors ApplicantsService.findAll).
   * Entity type strings cover both `'Employee'` (vehicle/scan side)
   * and `'EMPLOYEE'` (finance side) since the codebase doesn't
   * normalise them.
   */
  private async callerEntityFilter(
    caller?: { agencyId?: string; agencyIsSystem?: boolean },
  ): Promise<Record<string, any>> {
    if (!caller || !caller.agencyId || caller.agencyIsSystem === true) return {};
    const t = this.scope().tenantWhere();
    const [empGrants, applicants] = await Promise.all([
      this.prisma.employeeAgencyAccess.findMany({ // @tenant-reviewed: phase322-notifications-entity-scope
        where: { agencyId: caller.agencyId, canView: true },
        select: { employeeId: true },
      }),
      this.prisma.applicant.findMany({ // @tenant-reviewed: phase322-notifications-entity-scope
        where: { agencyId: caller.agencyId, deletedAt: null, ...t },
        select: { id: true },
      }),
    ]);
    const accessibleIds = [
      ...empGrants.map((g: any) => g.employeeId),
      ...applicants.map((a: any) => a.id),
    ];
    const RESTRICTED = ['Employee', 'EMPLOYEE', 'Applicant', 'APPLICANT'];
    return {
      OR: [
        { relatedEntity: null },
        { relatedEntity: { notIn: RESTRICTED } },
        {
          AND: [
            { relatedEntity: { in: RESTRICTED } },
            // Sentinel '__none__' keeps the IN clause non-empty when
            // the user has zero accessible entities — Prisma would
            // otherwise translate `in: []` to a no-op match.
            { relatedEntityId: { in: accessibleIds.length > 0 ? accessibleIds : ['__none__'] } },
          ],
        },
      ],
    };
  }

  /// Mark a notification as read.
  ///
  /// Pilot mode adds a tenant-scoped pre-check so a foreign-tenant
  /// notification id presents as 404 instead of mutating across
  /// tenants. Legacy mode keeps the original `update(by id)` behaviour
  /// — Prisma's P2025 path remains the contract for missing ids.
  async markAsRead(notificationId: string) {
    const scope = this.scope();
    if (scope.active) {
      const existing = await this.prisma.notification.findFirst({ // @tenant-reviewed: phase210-pilot-scope
        where: { id: notificationId, deletedAt: null, ...scope.tenantWhere() },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.update({ // @tenant-reviewed: phase210-pilot-scope
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /// Mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    const t = this.scope().tenantWhere();
    return this.prisma.notification.updateMany({ // @tenant-reviewed: phase210-pilot-scope
      where: { userId, isRead: false, deletedAt: null, ...t },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /// Get or create notification preferences for a user.
  ///
  /// `NotificationPreference` has NO `tenantId` — it is a per-user
  /// global record. Phase 2.10 does NOT route this through the pilot
  /// accessor; preferences are reached via `legacyPrisma` directly.
  async getOrCreatePreferences(userId: string) {
    return this.legacyPrisma.notificationPreference.upsert({ // @tenant-reviewed: phase210-global (NotificationPreference is per-user global)
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /// Update notification preferences (per-user global record).
  async updatePreferences(userId: string, data: any) {
    return this.legacyPrisma.notificationPreference.update({ // @tenant-reviewed: phase210-global (NotificationPreference is per-user global)
      where: { userId },
      data,
    });
  }

  /// Check for vehicles with expiring compliance dates
  async checkExpiringCompliance(): Promise<void> {
    const tid = this.narrowingTenantId();
    try {
      const fleetManagers = await this.legacyPrisma.user.findMany({ // @tenant-reviewed: phase214-pilot-scope (narrowed via agency.tenantId when tid)
        where: {
          role: { name: { contains: 'Fleet Manager' } },
          status: 'ACTIVE',
          notificationPreference: { isNot: null },
          ...(tid ? { agency: { tenantId: tid } } : {}),
        },
        include: { notificationPreference: true, agency: true },
      });

      for (const manager of fleetManagers) {
      if (!manager.notificationPreference) continue;

      const daysBefore = manager.notificationPreference.complianceDaysBefore;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + daysBefore);

      const complianceChecks = [
        { field: 'motExpiryDate', type: 'VEHICLE_MOT_EXPIRING', label: 'MOT' },
        { field: 'taxExpiryDate', type: 'VEHICLE_TAX_EXPIRING', label: 'Tax' },
        { field: 'insuranceExpiryDate', type: 'VEHICLE_INSURANCE_EXPIRING', label: 'Insurance' },
        { field: 'registrationExpiryDate', type: 'VEHICLE_REGISTRATION_EXPIRING', label: 'Registration' },
        { field: 'tachographCalibrationExpiry', type: 'VEHICLE_TACHOGRAPH_EXPIRING', label: 'Tachograph' },
        { field: 'atpCertificateExpiry', type: 'VEHICLE_ATP_EXPIRING', label: 'ATP Certificate' },
      ] as const;

      for (const check of complianceChecks) {
        // Build the where clause dynamically
        const whereClause: any = {
          agencyId: manager.agencyId,
          deletedAt: null,
          ...(tid ? { tenantId: tid } : {}),
        };
        whereClause[check.field] = { lte: cutoffDate, gt: new Date() };

        const vehicles = await this.legacyPrisma.vehicle.findMany({ // @tenant-reviewed: phase214-pilot-scope (narrowed via tenantId when tid)
          where: whereClause,
          select: { id: true, registrationNumber: true, motExpiryDate: true, taxExpiryDate: true, insuranceExpiryDate: true, registrationExpiryDate: true, tachographCalibrationExpiry: true, atpCertificateExpiry: true },
        });

        for (const vehicle of vehicles) {
          let expiryDate: Date | null = null;
          if (check.field === 'motExpiryDate') expiryDate = vehicle.motExpiryDate;
          else if (check.field === 'taxExpiryDate') expiryDate = vehicle.taxExpiryDate;
          else if (check.field === 'insuranceExpiryDate') expiryDate = vehicle.insuranceExpiryDate;
          else if (check.field === 'registrationExpiryDate') expiryDate = vehicle.registrationExpiryDate;
          else if (check.field === 'tachographCalibrationExpiry') expiryDate = vehicle.tachographCalibrationExpiry;
          else if (check.field === 'atpCertificateExpiry') expiryDate = vehicle.atpCertificateExpiry;

          if (!expiryDate) continue;

          const daysUntil = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const severity = daysUntil <= 7 ? 'HIGH' : daysUntil <= 14 ? 'MEDIUM' : 'LOW';

          const existing = await this.legacyPrisma.notification.findFirst({ // @tenant-reviewed: phase214-pilot-scope (dedupe scoped by tenantId when tid; see DEDUPE_KEY_REVIEW)
            where: {
              userId: manager.id,
              relatedEntityId: vehicle.id,
              type: check.type as NotificationType,
              isRead: false,
              createdAt: { gte: new Date(Date.now() - 86400000) },
              ...(tid ? { tenantId: tid } : {}),
            },
          });

          if (!existing) {
            await this.createInAppWithDedup({ // @tenant-reviewed: phase246-notifications-internal-scan-dedup (routes scan creates through dedup helper)
              userId: manager.id,
              // Pre-rendered English (legacy fallback for old clients).
              title: `${vehicle.registrationNumber}: ${check.label} Expiring Soon`,
              message: `${check.label} expires in ${daysUntil} days`,
              // i18n metadata: reader resolves these against the active
              // locale and falls back to `title`/`message` when missing.
              titleKey: 'events.vehicleCheckExpiring.title',
              messageKey: 'events.vehicleCheckExpiring.body',
              params: {
                registrationNumber: vehicle.registrationNumber,
                checkLabel: check.label,
                daysUntilDue: daysUntil,
              },
              type: check.type as NotificationType,
              channel: 'in_app',
              relatedEntity: 'Vehicle',
              relatedEntityId: vehicle.id,
              daysUntilDue: daysUntil,
              severity,
              ...(tid ? { tenantId: tid } : {}),
            }, tid);
          }
        }
      }
      }
    } catch (error: any) {
      // Gracefully handle missing notification_preferences table
      if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
        // Silently skip - migration not yet applied
      } else {
        throw error;
      }
    }
  }

  /// Check for vehicles needing service based on mileage
  async checkServiceDue(): Promise<void> {
    const tid = this.narrowingTenantId();
    try {
      const fleetManagers = await this.legacyPrisma.user.findMany({ // @tenant-reviewed: phase214-pilot-scope (narrowed via agency.tenantId when tid)
        where: {
          role: { name: { contains: 'Fleet Manager' } },
          status: 'ACTIVE',
          notificationPreference: { isNot: null },
          ...(tid ? { agency: { tenantId: tid } } : {}),
        },
        include: { notificationPreference: true, agency: true },
    });

    for (const manager of fleetManagers) {
      if (!manager.notificationPreference) continue;
      const kmBefore = manager.notificationPreference.serviceKmBefore;

      const vehicles = await this.legacyPrisma.vehicle.findMany({ // @tenant-reviewed: phase214-pilot-scope (narrowed via tenantId when tid)
        where: {
          agencyId: manager.agencyId,
          deletedAt: null,
          ...(tid ? { tenantId: tid } : {}),
          maintenanceRecords: {
            some: { nextServiceMileage: { not: null }, deletedAt: null },
          },
        },
        include: {
          maintenanceRecords: {
            where: { deletedAt: null, nextServiceMileage: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { maintenanceType: true },
          },
        },
      });

      for (const vehicle of vehicles) {
        if (!vehicle.maintenanceRecords.length || !vehicle.currentMileage) continue;

        const lastService = vehicle.maintenanceRecords[0];
        const kmRemaining = lastService.nextServiceMileage! - vehicle.currentMileage;

        if (kmRemaining > 0 && kmRemaining <= kmBefore) {
          const severity = kmRemaining <= 100 ? 'HIGH' : kmRemaining <= 250 ? 'MEDIUM' : 'LOW';

          const existing = await this.legacyPrisma.notification.findFirst({ // @tenant-reviewed: phase214-pilot-scope (dedupe scoped by tenantId when tid)
            where: {
              userId: manager.id,
              relatedEntityId: vehicle.id,
              type: 'VEHICLE_SERVICE_DUE',
              isRead: false,
              createdAt: { gte: new Date(Date.now() - 86400000) },
              ...(tid ? { tenantId: tid } : {}),
            },
          });

          if (!existing) {
            await this.createInAppWithDedup({ // @tenant-reviewed: phase246-notifications-internal-scan-dedup (routes scan creates through dedup helper)
              userId: manager.id,
              title: `${vehicle.registrationNumber}: Service Due Soon`,
              message: `Service due in ${kmRemaining} km`,
              titleKey: 'events.vehicleServiceDueKm.title',
              messageKey: 'events.vehicleServiceDueKm.body',
              params: {
                registrationNumber: vehicle.registrationNumber,
                kmRemaining,
              },
              type: 'VEHICLE_SERVICE_DUE',
              channel: 'in_app',
              relatedEntity: 'Vehicle',
              relatedEntityId: vehicle.id,
              kmUntilDue: kmRemaining,
              severity,
              ...(tid ? { tenantId: tid } : {}),
            }, tid);
          }
        }
      }
      }
    } catch (error: any) {
      // Gracefully handle missing notification_preferences table
      if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
        // Silently skip - migration not yet applied
      } else {
        throw error;
      }
    }
  }

  /// Check for overdue compliance
  async checkOverdue(): Promise<void> {
    const tid = this.narrowingTenantId();
    try {
      const fleetManagers = await this.legacyPrisma.user.findMany({ // @tenant-reviewed: phase214-pilot-scope (narrowed via agency.tenantId when tid)
        where: {
          role: { name: { contains: 'Fleet Manager' } },
          status: 'ACTIVE',
          ...(tid ? { agency: { tenantId: tid } } : {}),
        },
        include: { agency: true },
    });

    for (const manager of fleetManagers) {
      const overduedVehicles = await this.legacyPrisma.vehicle.findMany({ // @tenant-reviewed: phase214-pilot-scope (narrowed via tenantId when tid)
        where: {
          agencyId: manager.agencyId,
          deletedAt: null,
          ...(tid ? { tenantId: tid } : {}),
          OR: [
            { motExpiryDate: { lt: new Date() } },
            { taxExpiryDate: { lt: new Date() } },
            { insuranceExpiryDate: { lt: new Date() } },
            { registrationExpiryDate: { lt: new Date() } },
          ],
        },
        select: { id: true, registrationNumber: true },
      });

      for (const vehicle of overduedVehicles) {
        const existing = await this.legacyPrisma.notification.findFirst({ // @tenant-reviewed: phase214-pilot-scope (dedupe scoped by tenantId when tid)
          where: {
            userId: manager.id,
            relatedEntityId: vehicle.id,
            severity: 'HIGH',
            isRead: false,
            ...(tid ? { tenantId: tid } : {}),
          },
        });

        if (!existing) {
          await this.createInAppWithDedup({ // @tenant-reviewed: phase246-notifications-internal-scan-dedup (routes scan creates through dedup helper)
            userId: manager.id,
            title: `🚨 ${vehicle.registrationNumber}: Compliance Overdue`,
            message: 'Vehicle has expired compliance. Service immediately.',
            titleKey: 'events.vehicleComplianceOverdue.title',
            messageKey: 'events.vehicleComplianceOverdue.body',
            params: {
              registrationNumber: vehicle.registrationNumber,
            },
            type: 'VEHICLE_SERVICE_OVERDUE',
            channel: 'in_app',
            relatedEntity: 'Vehicle',
            relatedEntityId: vehicle.id,
            severity: 'HIGH',
            ...(tid ? { tenantId: tid } : {}),
          }, tid);
        }
      }
      }
    } catch (error: any) {
      // Gracefully handle missing notification_preferences table
      if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
        // Silently skip - migration not yet applied
      } else {
        throw error;
      }
    }
  }

  /// Check for scheduled maintenance records coming up
  async checkScheduledMaintenance(): Promise<void> {
    const tid = this.narrowingTenantId();
    try {
      const fleetManagers = await this.legacyPrisma.user.findMany({ // @tenant-reviewed: phase214-pilot-scope (narrowed via agency.tenantId when tid)
        where: {
          role: { name: { contains: 'Fleet Manager' } },
          status: 'ACTIVE',
          notificationPreference: { isNot: null },
          ...(tid ? { agency: { tenantId: tid } } : {}),
        },
        include: { notificationPreference: true, agency: true },
      });

      for (const manager of fleetManagers) {
        if (!manager.notificationPreference) continue;
        const maintenanceAlertDays = manager.notificationPreference.complianceDaysBefore ?? 7;

        const upcomingDate = new Date();
        upcomingDate.setDate(upcomingDate.getDate() + maintenanceAlertDays);

        const scheduledRecords = await this.legacyPrisma.maintenanceRecord.findMany({ // @tenant-reviewed: phase214-pilot-scope (narrowed via tenantId when tid)
          where: {
            vehicle: { agencyId: manager.agencyId, deletedAt: null },
            status: 'SCHEDULED',
            scheduledDate: { lte: upcomingDate, gte: new Date() },
            deletedAt: null,
            ...(tid ? { tenantId: tid } : {}),
          },
          include: { vehicle: true, maintenanceType: true, workshop: true },
        });

        for (const record of scheduledRecords) {
          const existing = await this.legacyPrisma.notification.findFirst({ // @tenant-reviewed: phase214-pilot-scope (dedupe scoped by tenantId when tid)
            where: {
              userId: manager.id,
              relatedEntityId: record.id,
              type: 'VEHICLE_SERVICE_DUE',
              isRead: false,
              createdAt: { gte: new Date(Date.now() - 86400000) },
              ...(tid ? { tenantId: tid } : {}),
            },
          });

          if (!existing) {
            const daysUntil = Math.ceil((record.scheduledDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const severity = daysUntil <= 3 ? 'HIGH' : daysUntil <= 7 ? 'MEDIUM' : 'LOW';

            await this.createInAppWithDedup({ // @tenant-reviewed: phase246-notifications-internal-scan-dedup (routes scan creates through dedup helper)
              userId: manager.id,
              title: `${record.vehicle.registrationNumber}: Scheduled Maintenance`,
              message: `${record.maintenanceType?.name ?? 'Maintenance'} scheduled in ${daysUntil} days at ${record.workshop?.name ?? 'workshop'}`,
              titleKey: 'events.vehicleScheduledMaintenance.title',
              messageKey: 'events.vehicleScheduledMaintenance.body',
              params: {
                registrationNumber: record.vehicle.registrationNumber,
                maintenanceTypeName: record.maintenanceType?.name ?? 'Maintenance',
                daysUntil,
                workshopName: record.workshop?.name ?? 'workshop',
              },
              type: 'VEHICLE_SERVICE_DUE',
              channel: 'in_app',
              relatedEntity: 'MaintenanceRecord',
              relatedEntityId: record.id,
              daysUntilDue: daysUntil,
              severity,
              ...(tid ? { tenantId: tid } : {}),
            }, tid);
          }
        }
      }
    } catch (error: any) {
      if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
        // Silently skip - migration not yet applied
      } else {
        throw error;
      }
    }
  }

  /// Run all checks (LEGACY: cross-tenant iteration, unchanged behaviour).
  ///
  /// Phase 2.14 keeps this method untouched so the scheduler can fall
  /// back to it when the tenant-aware flags are off. Production
  /// continues to run THIS method.
  async runAllChecks(): Promise<void> {
    try {
      await this.checkExpiringCompliance();
      await this.checkServiceDue();
      await this.checkScheduledMaintenance();
      await this.checkOverdue();
    } catch (error) {
      console.error('Notification checks failed:', error);
    }
  }

  /**
   * Phase 2.14 — tenant-aware runAllChecks.
   *
   * REQUIRES:
   *   - `TENANT_AWARE_JOBS_ENABLED=true`
   *   - `TENANT_JOB_FANOUT_ENABLED=true`
   *   - env classifies as SAFE_CLONE / SAFE_STAGING
   *   - FeatureFlagsService injected
   *
   * Discovers ACTIVE tenants, plans per-tenant fanout via
   * `TenantJobFanoutPlanner`, then executes each tenant's
   * `runAllChecksForTenant(tenantId)` inside a `runForTenant` ALS frame.
   *
   * Failures of one tenant do NOT abort other tenants. Per-tenant
   * results (ok/duration/error) are logged.
   */
  async runAllChecksTenantAware(): Promise<{
    plannedTenants: number;
    executedTenants: number;
    failedTenants: number;
    skipped: number;
  }> {
    if (!this.tenantAwareSchedulerActive()) {
      // Defensive: the scheduler should never call this when flags are
      // off, but if a test/harness invokes it directly, fall back to
      // legacy and report zero plan.
      this.logger.warn('[tenant-aware] flags not set — falling back to legacy runAllChecks');
      await this.runAllChecks();
      return { plannedTenants: 0, executedTenants: 0, failedTenants: 0, skipped: 0 };
    }

    // Tenant discovery. Uses `legacyPrisma` because tenant lookup is a
    // platform-global read; the per-tenant work routes through the
    // pilot accessor inside `runAllChecksForTenant`.
    const tenants = await this.legacyPrisma.tenant.findMany({ // @tenant-reviewed: phase214-pilot-scope (tenant catalog discovery)
      select: { id: true, slug: true, status: true },
    }) as Array<{ id: string; slug: string; status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' }>;

    const planner = new TenantJobFanoutPlanner();
    const plan = planner.plan(
      'notifications.runAllChecks',
      tenants,
      () => ({}),
      { activeOnly: true, excludeSystem: true },
    );

    this.logger.log(
      `[tenant-aware] plan: ${plan.tenants.length} tenants, ${plan.skipped.length} skipped`,
    );

    const outcome = await runForTenantBatch(
      plan.tenants.map((p) => p.tenantId),
      (tid) => this.runAllChecksForTenant(tid),
      { concurrency: 4, perTenantTimeoutMs: 60_000 },
    );

    const failed = outcome.results.filter((r) => !r.ok);
    if (failed.length > 0) {
      for (const f of failed) {
        this.logger.error(
          `[tenant-aware] tenant ${f.tenantId} failed: ${f.error?.name}: ${f.error?.message}`,
        );
      }
    }

    return {
      plannedTenants: plan.tenants.length,
      executedTenants: outcome.results.length,
      failedTenants: failed.length,
      skipped: plan.skipped.length + outcome.skipped.length,
    };
  }

  /**
   * Per-tenant entry point used by the fanout runner. The tenant id
   * is in ALS by the time this runs; the existing `check*` methods
   * read it via `TenantContext.optional()` if they need it.
   *
   * Phase 2.14 keeps the existing `check*` bodies on `legacyPrisma`
   * (they iterate `User` across all tenants today). They will be
   * narrowed to the active tenant in a follow-up pass — for now,
   * the tenant boundary is enforced by the surrounding ALS frame +
   * the read-path pilot scope on `notification.findFirst` /
   * `notification.create` calls.
   */
  async runAllChecksForTenant(_tenantId: string): Promise<void> {
    // The four legacy `check*` methods are not yet narrowed by tenant
    // (Phase 2.14 ships the framework + adapter; the per-check tenant
    // narrowing is the Phase 2.14.1 follow-up). Calling them inside a
    // tenant ALS frame is still safe because:
    //   - they only READ User/Vehicle (no pilot-scoped writes here),
    //   - their `notification.create` calls land tenantId via the
    //     existing pilot scope when the pilot module flag is on.
    // See SAAS_PHASE2_NOTIFICATIONS_SCHEDULER_PILOT_RESULTS.md §6 for
    // the migration plan to a fully tenant-narrowed check loop.
    try {
      await this.checkExpiringCompliance();
      await this.checkServiceDue();
      await this.checkScheduledMaintenance();
      await this.checkOverdue();
    } catch (error) {
      // Re-throw so the batch runner records the failure per tenant.
      throw error;
    }
  }

  /// Phase 2.14 fanout-writer contract.
  ///
  /// When the tenant-aware scheduler path is active
  /// (`TENANT_AWARE_JOBS_ENABLED && TENANT_JOB_FANOUT_ENABLED &&
  ///  staging`), the fanout writers REQUIRE a tenant in ALS. Calling
  /// them without context raises `MissingTenantContextError`. This
  /// closes the cross-tenant fanout hole described in Phase 2.10's
  /// scope-split doc.
  ///
  /// When the tenant-aware path is OFF (production default), the
  /// writers preserve their pre-Phase-2.14 behaviour byte-identically.
  private assertTenantForFanout(method: string): void {
    if (!this.tenantAwareSchedulerActive()) return;
    if (!TenantContext.optional()) {
      throw new MissingTenantContextError(`notifications.${method}`);
    }
  }

  // ── Phase 2.45 — per-recipient notification dedup ────────────────────────
  //
  // Default: disabled (NOTIFICATION_DEDUP_ENABLED=false). When the flag is
  // off, callers fall through to a plain `notification.create` and the path
  // is byte-identical to pre-2.45.
  //
  // When the flag is on, we look up an existing in-app notification for the
  // SAME tenant + recipient + type + relatedEntity + relatedEntityId within
  // the configured window (default 360 minutes). If one is found, we
  // SUPPRESS the create and report a `deduped` count. Tenant scoping is
  // mandatory — the dedup query always carries the active tenantId so it
  // CANNOT match cross-tenant rows. Missing tenant context is handled by
  // refusing the dedup probe and falling through to legacy behaviour
  // (caller's `assertTenantForFanout` already gates this earlier).
  //
  // Identity: (tenantId, userId, type, relatedEntity, relatedEntityId,
  //            createdAt >= now - window).
  // Limitations:
  //   - relatedEntityId is required to dedup; without it the lookup falls
  //     back to type-only matching, which is too coarse for general use,
  //     so we explicitly do NOT dedup when relatedEntityId is absent.
  //
  // @tenant-reviewed: phase245-notifications-dedup
  private dedupWindowMinutes(): number {
    const raw = process.env.NOTIFICATION_DEDUP_WINDOW_MINUTES;
    const n = raw ? Number(raw) : 360;
    return Number.isFinite(n) && n > 0 ? n : 360;
  }

  private async createInAppWithDedup(data: any, tid: string | null): Promise<{ created: number; deduped: number }> {
    const dedupOn = !!this.flags?.notificationDedupEnabled();
    // Dedup requires both: flag on, an explicit tenantId, AND a
    // (relatedEntity, relatedEntityId) pair. If any are missing we fall
    // through to a plain create.
    if (dedupOn && tid && data.relatedEntity && data.relatedEntityId) {
      const since = new Date(Date.now() - this.dedupWindowMinutes() * 60 * 1000);
      // @tenant-reviewed: phase245-notifications-dedup (tenantId always present in lookup)
      const existing = await this.legacyPrisma.notification.findFirst({
        where: {
          tenantId: tid,
          userId: data.userId,
          type: data.type,
          relatedEntity: data.relatedEntity,
          relatedEntityId: data.relatedEntityId,
          createdAt: { gte: since },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        return { created: 0, deduped: 1 };
      }
    }
    await this.legacyPrisma.notification.create({ data });
    return { created: 1, deduped: 0 };
  }

  /// Notify uploader and users with specific roles.
  ///
  /// `i18n` is optional — pass `{ titleKey, messageKey?, params? }` to
  /// have the reader render translations against the requester's locale.
  /// When omitted, the existing English `title`/`message` flow is used
  /// unchanged (backward compatible with all current callers).
  ///
  /// Phase 2.14: refuses without a tenant in ALS when the tenant-aware
  /// scheduler path is active.
  async notifyUploaderAndRoles(
    uploaderId: string,
    roles: string[],
    eventKey: NotifEventKey,
    title: string,
    message: string,
    relatedEntity?: string,
    relatedEntityId?: string,
    i18n?: { titleKey?: string; messageKey?: string; params?: Record<string, unknown> },
  ): Promise<{ created: number; deduped: number }> {
    this.assertTenantForFanout('notifyUploaderAndRoles');
    const tid = this.narrowingTenantId();
    const userIds = new Set<string>();

    if (uploaderId) {
      if (tid) {
        // Phase 2.15 — in tenant-aware mode, the uploader must belong
        // to the active tenant. Cross-tenant uploader ids are ignored
        // (the caller should never pass one; this is defence in depth).
        const ok = await this.legacyPrisma.user.findFirst({ // @tenant-reviewed: phase215-pilot-scope (uploader tenant probe)
          where: { id: uploaderId, agency: { tenantId: tid } },
          select: { id: true },
        });
        if (ok) userIds.add(uploaderId);
      } else {
        userIds.add(uploaderId);
      }
    }

    if (roles && roles.length > 0) {
      const users = await this.legacyPrisma.user.findMany({ // @tenant-reviewed: phase215-pilot-scope (role fanout narrowed via agency.tenantId when tid)
        where: {
          role: { name: { in: roles } },
          status: 'ACTIVE',
          ...(tid ? { agency: { tenantId: tid } } : {}),
        },
        select: { id: true },
      });
      users.forEach(u => userIds.add(u.id));
    }

    const type = (EVENT_TO_TYPE[eventKey] || 'INFO') as NotificationType;

    let created = 0, deduped = 0;
    for (const userId of userIds) {
      // @tenant-reviewed: phase215-pilot-scope (writes tenantId when tid)
      const r = await this.createInAppWithDedup({
        userId,
        title,
        message,
        titleKey:   i18n?.titleKey   ?? null,
        messageKey: i18n?.messageKey ?? null,
        params:     (i18n?.params ?? null) as any,
        type,
        channel: 'in_app',
        relatedEntity: relatedEntity || 'Document',
        relatedEntityId,
        ...(tid ? { tenantId: tid } : {}),
      }, tid);
      created += r.created;
      deduped += r.deduped;
    }
    return { created, deduped };
  }

  /// Notify users with specific roles.
  ///
  /// Same `i18n` opt-in as `notifyUploaderAndRoles` — see that doc for
  /// fallback semantics.
  ///
  /// Phase 2.14: refuses without a tenant in ALS when the tenant-aware
  /// scheduler path is active.
  async notifyUsersByRoles(
    roles: string[],
    eventKey: NotifEventKey,
    title: string,
    message: string,
    relatedEntity?: string,
    relatedEntityId?: string,
    i18n?: { titleKey?: string; messageKey?: string; params?: Record<string, unknown> },
  ): Promise<{ created: number; deduped: number }> {
    this.assertTenantForFanout('notifyUsersByRoles');
    const tid = this.narrowingTenantId();
    const users = await this.legacyPrisma.user.findMany({ // @tenant-reviewed: phase215-pilot-scope (role fanout narrowed via agency.tenantId when tid)
      where: {
        role: { name: { in: roles } },
        status: 'ACTIVE',
        ...(tid ? { agency: { tenantId: tid } } : {}),
      },
      select: { id: true },
    });

    const type = (EVENT_TO_TYPE[eventKey] || 'INFO') as NotificationType;

    let created = 0, deduped = 0;
    for (const user of users) {
      // @tenant-reviewed: phase215-pilot-scope (writes tenantId when tid)
      const r = await this.createInAppWithDedup({
        userId: user.id,
        title,
        message,
        titleKey:   i18n?.titleKey   ?? null,
        messageKey: i18n?.messageKey ?? null,
        params:     (i18n?.params ?? null) as any,
        type,
        channel: 'in_app',
        relatedEntity,
        relatedEntityId,
        ...(tid ? { tenantId: tid } : {}),
      }, tid);
      created += r.created;
      deduped += r.deduped;
    }
    return { created, deduped };
  }

  /// Check if high balance alert was recently sent
  async wasHighBalanceAlertRecentlySent(entityId: string): Promise<boolean> {
    const t = this.scope().tenantWhere();
    const recent = await this.prisma.notification.findFirst({ // @tenant-reviewed: phase210-pilot-scope
      where: {
        relatedEntityId: entityId,
        type: 'WARNING',
        createdAt: { gte: new Date(Date.now() - 86400000) },
        ...t,
      },
    });
    return !!recent;
  }
}
