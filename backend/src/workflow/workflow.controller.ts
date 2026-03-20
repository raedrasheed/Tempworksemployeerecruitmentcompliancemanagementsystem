import {
  Controller, Get, Post, Body, Patch, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { CreateVisaDto } from './dto/create-visa.dto';
import { UpdateWorkflowStageDto } from './dto/update-workflow-stage.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Workflow')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('stages')
  @ApiOperation({ summary: 'Get all workflow stages' })
  getStages() {
    return this.workflowService.getStages();
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get workflow overview with stage counts' })
  getOverview() {
    return this.workflowService.getOverview();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get workflow analytics and recent activity' })
  getAnalytics() {
    return this.workflowService.getAnalytics();
  }

  @Get('timeline/:employeeId')
  @ApiOperation({ summary: 'Get workflow timeline for an employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  getTimeline(@Param('employeeId') employeeId: string) {
    return this.workflowService.getTimeline(employeeId);
  }

  @Patch('employees/:id/workflow-stage/:stageId')
  @ApiOperation({ summary: 'Update a workflow stage for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiParam({ name: 'stageId', description: 'WorkflowStage UUID' })
  updateEmployeeWorkflowStage(
    @Param('id') employeeId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateWorkflowStageDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowService.updateEmployeeWorkflowStage(employeeId, stageId, dto, user?.id);
  }

  // Work Permits
  @Get('work-permits')
  @ApiOperation({ summary: 'Get all work permits' })
  @ApiQuery({ name: 'employeeId', required: false })
  getWorkPermits(@Query() pagination: PaginationDto, @Query('employeeId') employeeId?: string) {
    return this.workflowService.findWorkPermits(pagination, employeeId);
  }

  @Post('work-permits')
  @ApiOperation({ summary: 'Create a work permit' })
  createWorkPermit(@Body() dto: CreateWorkPermitDto, @CurrentUser() user: any) {
    return this.workflowService.createWorkPermit(dto, user?.id);
  }

  @Patch('work-permits/:id')
  @ApiOperation({ summary: 'Update work permit' })
  @ApiParam({ name: 'id', description: 'WorkPermit UUID' })
  updateWorkPermit(
    @Param('id') id: string,
    @Body() dto: Partial<CreateWorkPermitDto>,
    @CurrentUser() user: any,
  ) {
    return this.workflowService.updateWorkPermit(id, dto, user?.id);
  }

  // Visas
  @Get('visas')
  @ApiOperation({ summary: 'Get all visas' })
  @ApiQuery({ name: 'entityId', required: false })
  getVisas(@Query() pagination: PaginationDto, @Query('entityId') entityId?: string) {
    return this.workflowService.findVisas(pagination, entityId);
  }

  @Post('visas')
  @ApiOperation({ summary: 'Create a visa record' })
  createVisa(@Body() dto: CreateVisaDto, @CurrentUser() user: any) {
    return this.workflowService.createVisa(dto, user?.id);
  }

  @Patch('visas/:id')
  @ApiOperation({ summary: 'Update visa record' })
  @ApiParam({ name: 'id', description: 'Visa UUID' })
  updateVisa(@Param('id') id: string, @Body() dto: Partial<CreateVisaDto>, @CurrentUser() user: any) {
    return this.workflowService.updateVisa(id, dto, user?.id);
  }
}
