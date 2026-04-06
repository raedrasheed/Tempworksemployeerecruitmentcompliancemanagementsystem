import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';
import {
  NOTIF_EVENT_META,
  NotifEventKey,
  UserNotifPrefs,
  mergeWithDefaults,
  EVENT_TO_TYPE,
} from './notification-events';

// ── Internal creation params ─────────────────────────────────────────────────

export interface SendNotificationParams {
  /** Target user id */
  userId:          string;
  /** Specific event key (DOCUMENT_UPLOADED, FINANCIAL_RECORD_CREATED, …) */
  eventType:       NotifEventKey;
  /** Short headline */
  title:           string;
  /** Full message body */
  message:         string;
  /** Optional entity type for navigation (e.g. 'EMPLOYEE') */
  relatedEntity?:  string;
  /** Optional entity id for navigation */
  relatedEntityId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email:  EmailService,
  ) {}

  // ── List / Inbox ─────────────────────────────────────────────────────────────

  async findAll(userId: string, filter: NotificationFilterDto) {
    const { page = 1, limit = 20 } = filter;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { userId, deletedAt: null };

    if (filter.isRead !== undefined) where.isRead = filter.isRead;
    if (filter.type)      where.type      = filter.type;
    if (filter.eventType) where.eventType = filter.eventType;

    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) where.createdAt.gte = new Date(filter.dateFrom);
      if (filter.dateTo)   where.createdAt.lte = new Date(filter.dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where, skip, take: Number(limit), orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return PaginatedResponse.create(items, total, page, limit);
  }

  // ── Unread count ─────────────────────────────────────────────────────────────

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false, deletedAt: null },
    });
    return { count };
  }

  // ── Mark as read ─────────────────────────────────────────────────────────────

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark ALL of the user's unread notifications as read.
   * Applies to all notifications regardless of active UI filters —
   * this is the safest, most predictable behaviour.
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false, deletedAt: null },
      data:  { isRead: true, readAt: new Date() },
    });
    return { message: 'All notifications marked as read', updated: result.count };
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async delete(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    await this.prisma.notification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Notification deleted' };
  }

  // ── Admin create (raw) ───────────────────────────────────────────────────────

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId:          dto.userId,
        title:           dto.title,
        message:         dto.message,
        type:            (dto.type as any) || 'INFO',
        relatedEntity:   dto.relatedEntity,
        relatedEntityId: dto.relatedEntityId,
      },
    });
  }

  // ── Preferences ──────────────────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<UserNotifPrefs & { meta: typeof NOTIF_EVENT_META }> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { notificationPrefs: true },
    });
    const saved = (user?.notificationPrefs ?? null) as Partial<UserNotifPrefs> | null;
    return { ...mergeWithDefaults(saved), meta: NOTIF_EVENT_META };
  }

  async updatePreferences(
    userId: string,
    prefs: Record<string, { in_app: boolean; email: boolean; sms: boolean }>,
  ): Promise<UserNotifPrefs> {
    // Force sms = false (not yet active)
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(prefs)) {
      sanitized[key] = { in_app: !!val.in_app, email: !!val.email, sms: false };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data:  { notificationPrefs: sanitized },
    });

    return mergeWithDefaults(sanitized as Partial<UserNotifPrefs>);
  }

  // ── Core delivery engine ─────────────────────────────────────────────────────

  /**
   * Send a notification to one user, respecting their preferences.
   *
   * - If in_app is enabled: creates a Notification row (channel = 'in_app')
   * - If email is enabled:  sends an email via EmailService
   * - SMS: always skipped (future feature)
   *
   * Never throws — all errors are logged to avoid breaking the triggering flow.
   */
  async sendNotification(params: SendNotificationParams): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where:  { id: params.userId, deletedAt: null },
        select: { id: true, email: true, firstName: true, lastName: true, notificationPrefs: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE') return;

      const saved = (user.notificationPrefs ?? null) as Partial<UserNotifPrefs> | null;
      const prefs = mergeWithDefaults(saved);
      const channelPrefs = prefs[params.eventType];

      const notifType = (EVENT_TO_TYPE[params.eventType] ?? 'INFO') as any;

      // ── In-app ────────────────────────────────────────────────────────────
      if (channelPrefs?.in_app !== false) {
        await this.prisma.notification.create({
          data: {
            userId:          params.userId,
            title:           params.title,
            message:         params.message,
            type:            notifType,
            eventType:       params.eventType,
            channel:         'in_app',
            relatedEntity:   params.relatedEntity,
            relatedEntityId: params.relatedEntityId,
          },
        });
      }

      // ── Email ─────────────────────────────────────────────────────────────
      if (channelPrefs?.email === true) {
        const name = `${user.firstName} ${user.lastName}`;
        await this.email.sendNotificationEmail(user.email, name, params.title, params.message, params.eventType);
      }

    } catch (err: any) {
      this.logger.error(
        `sendNotification failed for user ${params.userId} event ${params.eventType}: ${err?.message}`,
        err?.stack,
      );
    }
  }

  /**
   * Notify all ACTIVE users who hold a given role (or any of several roles).
   * Each user's individual preferences are respected.
   *
   * Used for system-wide events (document expiry, financial events, etc.).
   */
  async notifyUsersByRoles(
    roleNames:       string[],
    eventType:       NotifEventKey,
    title:           string,
    message:         string,
    relatedEntity?:  string,
    relatedEntityId?: string,
  ): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          role:      { name: { in: roleNames } },
          deletedAt: null,
          status:    'ACTIVE',
        },
        select: { id: true },
      });

      await Promise.all(
        users.map(u =>
          this.sendNotification({
            userId: u.id, eventType, title, message, relatedEntity, relatedEntityId,
          }),
        ),
      );
    } catch (err: any) {
      this.logger.error(`notifyUsersByRoles failed: ${err?.message}`, err?.stack);
    }
  }

  /**
   * Notify a specific user + all users in specified roles.
   * De-duplicates so the triggering user is not double-notified.
   */
  async notifyUploaderAndRoles(
    uploaderId:      string,
    roleNames:       string[],
    eventType:       NotifEventKey,
    title:           string,
    message:         string,
    relatedEntity?:  string,
    relatedEntityId?: string,
  ): Promise<void> {
    try {
      const roleUsers = await this.prisma.user.findMany({
        where: {
          role:      { name: { in: roleNames } },
          deletedAt: null,
          status:    'ACTIVE',
        },
        select: { id: true },
      });

      const allIds = [...new Set([uploaderId, ...roleUsers.map(u => u.id)])];

      await Promise.all(
        allIds.map(id =>
          this.sendNotification({
            userId: id, eventType, title, message, relatedEntity, relatedEntityId,
          }),
        ),
      );
    } catch (err: any) {
      this.logger.error(`notifyUploaderAndRoles failed: ${err?.message}`, err?.stack);
    }
  }

  /**
   * Check whether a high-balance notification was already sent for this
   * entity in the last 24 hours to prevent spam.
   */
  async wasHighBalanceAlertRecentlySent(entityId: string): Promise<boolean> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.prisma.notification.findFirst({
      where: {
        eventType:  'FINANCIAL_HIGH_BALANCE',
        relatedEntityId: entityId,
        createdAt:  { gte: since },
        deletedAt:  null,
      },
    });
    return !!existing;
  }

  // ── Legacy broadcast ─────────────────────────────────────────────────────────

  async broadcastToRole(roleName: string, title: string, message: string, type = 'INFO') {
    const users = await this.prisma.user.findMany({
      where: { role: { name: roleName }, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (users.length === 0) return { sent: 0 };
    await this.prisma.notification.createMany({
      data: users.map(u => ({ userId: u.id, title, message, type: type as any })),
    });
    return { sent: users.length };
  }
}
