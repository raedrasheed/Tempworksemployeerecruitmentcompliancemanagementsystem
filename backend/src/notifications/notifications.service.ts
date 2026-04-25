import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { EVENT_TO_TYPE, NotifEventKey } from './notification-events';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /// Get notifications for a user with pagination
  async getUserNotifications(userId: string, skip = 0, take = 20) {
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({
        where: { userId, deletedAt: null },
      }),
    ]);
    return { data: notifications, total };
  }

  /// Get unread notification count for a user
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false, deletedAt: null },
    });
  }

  /// Mark a notification as read
  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /// Mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false, deletedAt: null },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /// Get or create notification preferences for a user
  async getOrCreatePreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /// Update notification preferences
  async updatePreferences(userId: string, data: any) {
    return this.prisma.notificationPreference.update({
      where: { userId },
      data,
    });
  }

  /// Check for vehicles with expiring compliance dates
  async checkExpiringCompliance(): Promise<void> {
    try {
      const fleetManagers = await this.prisma.user.findMany({
        where: {
          role: { name: { contains: 'Fleet Manager' } },
          status: 'ACTIVE',
          notificationPreference: { isNot: null },
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
        };
        whereClause[check.field] = { lte: cutoffDate, gt: new Date() };

        const vehicles = await this.prisma.vehicle.findMany({
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

          const existing = await this.prisma.notification.findFirst({
            where: {
              userId: manager.id,
              relatedEntityId: vehicle.id,
              type: check.type as NotificationType,
              isRead: false,
              createdAt: { gte: new Date(Date.now() - 86400000) },
            },
          });

          if (!existing) {
            await this.prisma.notification.create({
              data: {
                userId: manager.id,
                title: `${vehicle.registrationNumber}: ${check.label} Expiring Soon`,
                message: `${check.label} expires in ${daysUntil} days`,
                type: check.type as NotificationType,
                channel: 'in_app',
                relatedEntity: 'Vehicle',
                relatedEntityId: vehicle.id,
                daysUntilDue: daysUntil,
                severity,
              },
            });
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
    try {
      const fleetManagers = await this.prisma.user.findMany({
        where: {
          role: { name: { contains: 'Fleet Manager' } },
          status: 'ACTIVE',
          notificationPreference: { isNot: null },
        },
        include: { notificationPreference: true, agency: true },
    });

    for (const manager of fleetManagers) {
      if (!manager.notificationPreference) continue;
      const kmBefore = manager.notificationPreference.serviceKmBefore;

      const vehicles = await this.prisma.vehicle.findMany({
        where: {
          agencyId: manager.agencyId,
          deletedAt: null,
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

          const existing = await this.prisma.notification.findFirst({
            where: {
              userId: manager.id,
              relatedEntityId: vehicle.id,
              type: 'VEHICLE_SERVICE_DUE',
              isRead: false,
              createdAt: { gte: new Date(Date.now() - 86400000) },
            },
          });

          if (!existing) {
            await this.prisma.notification.create({
              data: {
                userId: manager.id,
                title: `${vehicle.registrationNumber}: Service Due Soon`,
                message: `Service due in ${kmRemaining} km`,
                type: 'VEHICLE_SERVICE_DUE',
                channel: 'in_app',
                relatedEntity: 'Vehicle',
                relatedEntityId: vehicle.id,
                kmUntilDue: kmRemaining,
                severity,
              },
            });
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
    try {
      const fleetManagers = await this.prisma.user.findMany({
        where: {
          role: { name: { contains: 'Fleet Manager' } },
          status: 'ACTIVE',
        },
        include: { agency: true },
    });

    for (const manager of fleetManagers) {
      const overduedVehicles = await this.prisma.vehicle.findMany({
        where: {
          agencyId: manager.agencyId,
          deletedAt: null,
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
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: manager.id,
            relatedEntityId: vehicle.id,
            severity: 'HIGH',
            isRead: false,
          },
        });

        if (!existing) {
          await this.prisma.notification.create({
            data: {
              userId: manager.id,
              title: `🚨 ${vehicle.registrationNumber}: Compliance Overdue`,
              message: 'Vehicle has expired compliance. Service immediately.',
              type: 'VEHICLE_SERVICE_OVERDUE',
              channel: 'in_app',
              relatedEntity: 'Vehicle',
              relatedEntityId: vehicle.id,
              severity: 'HIGH',
            },
          });
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

  /// Run all checks
  async runAllChecks(): Promise<void> {
    try {
      await this.checkExpiringCompliance();
      await this.checkServiceDue();
      await this.checkOverdue();
    } catch (error) {
      console.error('Notification checks failed:', error);
    }
  }

  /// Notify uploader and users with specific roles
  async notifyUploaderAndRoles(uploaderId: string, roles: string[], eventKey: NotifEventKey, title: string, message: string, relatedEntity?: string, relatedEntityId?: string): Promise<void> {
    const userIds = new Set<string>();

    if (uploaderId) userIds.add(uploaderId);

    if (roles && roles.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          role: { name: { in: roles } },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      users.forEach(u => userIds.add(u.id));
    }

    const type = (EVENT_TO_TYPE[eventKey] || 'INFO') as NotificationType;

    for (const userId of userIds) {
      await this.prisma.notification.create({
        data: {
          userId,
          title,
          message,
          type,
          channel: 'in_app',
          relatedEntity: relatedEntity || 'Document',
          relatedEntityId,
        },
      });
    }
  }

  /// Notify users with specific roles
  async notifyUsersByRoles(roles: string[], eventKey: NotifEventKey, title: string, message: string, relatedEntity?: string, relatedEntityId?: string): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { name: { in: roles } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const type = (EVENT_TO_TYPE[eventKey] || 'INFO') as NotificationType;

    for (const user of users) {
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          title,
          message,
          type,
          channel: 'in_app',
          relatedEntity,
          relatedEntityId,
        },
      });
    }
  }

  /// Check if high balance alert was recently sent
  async wasHighBalanceAlertRecentlySent(entityId: string): Promise<boolean> {
    const recent = await this.prisma.notification.findFirst({
      where: {
        relatedEntityId: entityId,
        type: 'WARNING',
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    });
    return !!recent;
  }
}
