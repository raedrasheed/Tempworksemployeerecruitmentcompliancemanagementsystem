import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { BatchUpdateSettingsDto } from './dto/update-settings.dto';
import { CreateJobTypeDto } from './dto/create-job-type.dto';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { CreateNotificationRuleDto } from './dto/create-notification-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get system settings (grouped by category)' })
  @ApiQuery({ name: 'includePrivate', required: false, description: 'Include private settings (admin only)' })
  findAll(@Query('includePrivate') includePrivate?: boolean, @CurrentUser() user?: any) {
    const isAdmin = user?.role?.name === 'System Admin';
    return this.settingsService.findAll(isAdmin && !!includePrivate);
  }

  @Patch()
  @Roles('System Admin')
  @ApiOperation({ summary: 'Batch update settings' })
  batchUpdate(@Body() dto: BatchUpdateSettingsDto, @CurrentUser() user: any) {
    return this.settingsService.batchUpdate(dto, user.id);
  }

  // Job Types
  @Get('job-types')
  @ApiOperation({ summary: 'Get all active job types' })
  findJobTypes() {
    return this.settingsService.findJobTypes();
  }

  @Post('job-types')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Create a job type' })
  createJobType(@Body() dto: CreateJobTypeDto) {
    return this.settingsService.createJobType(dto);
  }

  @Patch('job-types/:id')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Update a job type' })
  @ApiParam({ name: 'id', description: 'JobType UUID' })
  updateJobType(@Param('id') id: string, @Body() dto: Partial<CreateJobTypeDto>) {
    return this.settingsService.updateJobType(id, dto);
  }

  @Delete('job-types/:id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a job type' })
  @ApiParam({ name: 'id', description: 'JobType UUID' })
  deleteJobType(@Param('id') id: string) {
    return this.settingsService.deleteJobType(id);
  }

  // Document Types
  @Get('document-types')
  @ApiOperation({ summary: 'Get all active document types' })
  findDocumentTypes() {
    return this.settingsService.findDocumentTypes();
  }

  @Post('document-types')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Create a document type' })
  createDocumentType(@Body() dto: CreateDocumentTypeDto) {
    return this.settingsService.createDocumentType(dto);
  }

  @Patch('document-types/:id')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Update a document type' })
  @ApiParam({ name: 'id', description: 'DocumentType UUID' })
  updateDocumentType(@Param('id') id: string, @Body() dto: Partial<CreateDocumentTypeDto>) {
    return this.settingsService.updateDocumentType(id, dto);
  }

  @Delete('document-types/:id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a document type' })
  @ApiParam({ name: 'id', description: 'DocumentType UUID' })
  deleteDocumentType(@Param('id') id: string) {
    return this.settingsService.deleteDocumentType(id);
  }

  // Workflow Stages
  @Get('workflow-stages')
  @ApiOperation({ summary: 'Get all workflow stages' })
  findWorkflowStages() {
    return this.settingsService.findWorkflowStages();
  }

  @Patch('workflow-stages/:id')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Update a workflow stage' })
  @ApiParam({ name: 'id', description: 'WorkflowStage UUID' })
  updateWorkflowStage(@Param('id') id: string, @Body() dto: any) {
    return this.settingsService.updateWorkflowStage(id, dto);
  }

  // Notification Rules
  @Get('notification-rules')
  @ApiOperation({ summary: 'Get all notification rules' })
  findNotificationRules() {
    return this.settingsService.findNotificationRules();
  }

  @Post('notification-rules')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Create a notification rule' })
  createNotificationRule(@Body() dto: CreateNotificationRuleDto) {
    return this.settingsService.createNotificationRule(dto);
  }

  @Patch('notification-rules/:id')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Update a notification rule' })
  @ApiParam({ name: 'id', description: 'NotificationRule UUID' })
  updateNotificationRule(@Param('id') id: string, @Body() dto: Partial<CreateNotificationRuleDto>) {
    return this.settingsService.updateNotificationRule(id, dto);
  }

  @Delete('notification-rules/:id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a notification rule' })
  @ApiParam({ name: 'id', description: 'NotificationRule UUID' })
  deleteNotificationRule(@Param('id') id: string) {
    return this.settingsService.deleteNotificationRule(id);
  }
}
