import {
  Controller, Get, Post, Put, Body, Patch, Param, Delete,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NOTIF_EVENT_META } from './notification-events';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ── Inbox ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get current user notifications (filterable)' })
  findAll(@CurrentUser() user: any, @Query() filter: NotificationFilterDto) {
    return this.notificationsService.findAll(user.id, filter);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@CurrentUser() user: any) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  // ── Preferences ───────────────────────────────────────────────────────────

  @Get('preferences')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  getPreferences(@CurrentUser() user: any) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Get('event-types')
  @ApiOperation({ summary: 'Get available notification event types with metadata' })
  getEventTypes() {
    return NOTIF_EVENT_META;
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  updatePreferences(@CurrentUser() user: any, @Body() dto: UpdatePreferencesDto) {
    return this.notificationsService.updatePreferences(user.id, dto.preferences ?? {});
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read (applies to all, ignores active filters)' })
  markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  // ── Individual actions ────────────────────────────────────────────────────

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (soft) a notification' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.delete(id, user.id);
  }

  // ── Admin: create ─────────────────────────────────────────────────────────

  @Post()
  @Roles('System Admin', 'HR Manager', 'Compliance Officer')
  @ApiOperation({ summary: 'Create a notification (admin)' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }
}
