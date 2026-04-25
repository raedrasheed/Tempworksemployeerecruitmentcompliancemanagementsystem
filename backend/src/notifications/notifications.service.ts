import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

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
        const vehicles = await this.prisma.vehicle.findMany({
          where: {
            agencyId: manager.agencyId,
            deletedAt: null,
            [check.field]: { lte: cutoffDate, gt: new Date() },
          },
          select: { id: true, registrationNumber: true, [check.field]: true },
        });

        for (const vehicle of vehicles) {
          const expiryDate = new Date(vehicle[check.field as keyof typeof vehicle] as any);
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
  }

  /// Check for vehicles needing service based on mileage
  async checkServiceDue(): Promise<void> {
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
  }

  /// Check for overdue compliance
  async checkOverdue(): Promise<void> {
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
}
