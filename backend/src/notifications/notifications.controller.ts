import { Controller, Get, Patch, Param, Body, UseGuards, Request, Query, Headers } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { resolveAcceptLanguage } from '../common/i18n/server-translate';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Request() req: any,
    @Query('skip') skip = '0',
    @Query('take') take = '20',
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale = resolveAcceptLanguage(acceptLanguage);
    return this.notificationsService.getUserNotifications(req.user.id, parseInt(skip), parseInt(take), locale);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { unreadCount: count };
  }

  @Patch(':notificationId/read')
  async markAsRead(@Param('notificationId') notificationId: string) {
    return this.notificationsService.markAsRead(notificationId);
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req: any) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { success: true };
  }

  @Get('preferences')
  async getPreferences(@Request() req: any) {
    return this.notificationsService.getOrCreatePreferences(req.user.id);
  }

  @Patch('preferences')
  async updatePreferences(@Request() req: any, @Body() data: any) {
    return this.notificationsService.updatePreferences(req.user.id, data);
  }
}
