import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (Number(page) - 1) * Number(limit);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where, skip, take: Number(limit), orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return PaginatedResponse.create(items, total, page, limit);
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { message: 'All notifications marked as read' };
  }

  async delete(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted' };
  }

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type: (dto.type as any) || 'INFO',
        relatedEntity: dto.relatedEntity,
        relatedEntityId: dto.relatedEntityId,
      },
    });
  }

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
