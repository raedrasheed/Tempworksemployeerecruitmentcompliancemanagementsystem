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
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get system settings (grouped by category)' })
  @ApiQuery({ name: 'includePrivate', required: false })
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
  @Public()
  @Get('job-types')
  @ApiOperation({ summary: 'Get all active job types' })
  findJobTypes() { return this.settingsService.findJobTypes(); }

  @Post('job-types')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Create a job type' })
  createJobType(@Body() dto: CreateJobTypeDto, @CurrentUser() user: any) {
    return this.settingsService.createJobType(dto, user?.id);
  }

  @Patch('job-types/:id')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Update a job type' })
  @ApiParam({ name: 'id' })
  updateJobType(@Param('id') id: string, @Body() dto: Partial<CreateJobTypeDto>, @CurrentUser() user: any) {
    return this.settingsService.updateJobType(id, dto, user?.id);
  }

  @Delete('job-types/:id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a job type' })
  @ApiParam({ name: 'id' })
  deleteJobType(@Param('id') id: string, @CurrentUser() user: any) {
    return this.settingsService.deleteJobType(id, user?.id);
  }

  // Document Types
  @Get('document-types')
  @ApiOperation({ summary: 'Get all active document types' })
  findDocumentTypes() { return this.settingsService.findDocumentTypes(); }

  @Get('document-types/:id')
  @ApiOperation({ summary: 'Get a document type by ID' })
  @ApiParam({ name: 'id' })
  findDocumentType(@Param('id') id: string) {
    return this.settingsService.findDocumentType(id);
  }

  @Post('document-types')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Create a document type' })
  createDocumentType(@Body() dto: CreateDocumentTypeDto, @CurrentUser() user: any) {
    return this.settingsService.createDocumentType(dto, user?.id);
  }

  @Patch('document-types/:id')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Update a document type' })
  @ApiParam({ name: 'id' })
  updateDocumentType(@Param('id') id: string, @Body() dto: Partial<CreateDocumentTypeDto>, @CurrentUser() user: any) {
    return this.settingsService.updateDocumentType(id, dto, user?.id);
  }

  @Delete('document-types/:id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a document type' })
  @ApiParam({ name: 'id' })
  deleteDocumentType(@Param('id') id: string, @CurrentUser() user: any) {
    return this.settingsService.deleteDocumentType(id, user?.id);
  }

  // Workflow Stages
  @Get('workflow-stages')
  @ApiOperation({ summary: 'Get all workflow stages' })
  findWorkflowStages() { return this.settingsService.findWorkflowStages(); }

  @Post('workflow-stages')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Create a workflow stage' })
  createWorkflowStage(@Body() dto: any, @CurrentUser() user: any) {
    return this.settingsService.createWorkflowStage(dto, user?.id);
  }

  @Patch('workflow-stages/reorder')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Bulk reorder workflow stages' })
  reorderWorkflowStages(@Body() body: { orders: { id: string; order: number }[] }, @CurrentUser() user: any) {
    return this.settingsService.reorderWorkflowStages(body.orders, user?.id);
  }

  @Patch('workflow-stages/:id')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Update a workflow stage' })
  @ApiParam({ name: 'id' })
  updateWorkflowStage(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.settingsService.updateWorkflowStage(id, dto, user?.id);
  }

  @Delete('workflow-stages/:id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a workflow stage' })
  @ApiParam({ name: 'id' })
  deleteWorkflowStage(@Param('id') id: string, @CurrentUser() user: any) {
    return this.settingsService.deleteWorkflowStage(id, user?.id);
  }

  // Notification Rules
  @Get('notification-rules')
  @ApiOperation({ summary: 'Get all notification rules' })
  findNotificationRules() { return this.settingsService.findNotificationRules(); }

  @Post('notification-rules')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Create a notification rule' })
  createNotificationRule(@Body() dto: CreateNotificationRuleDto, @CurrentUser() user: any) {
    return this.settingsService.createNotificationRule(dto, user?.id);
  }

  @Patch('notification-rules/:id')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Update a notification rule' })
  @ApiParam({ name: 'id' })
  updateNotificationRule(@Param('id') id: string, @Body() dto: Partial<CreateNotificationRuleDto>, @CurrentUser() user: any) {
    return this.settingsService.updateNotificationRule(id, dto, user?.id);
  }

  @Delete('notification-rules/:id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a notification rule' })
  @ApiParam({ name: 'id' })
  deleteNotificationRule(@Param('id') id: string, @CurrentUser() user: any) {
    return this.settingsService.deleteNotificationRule(id, user?.id);
  }
}
