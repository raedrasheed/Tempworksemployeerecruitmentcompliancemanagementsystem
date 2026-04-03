import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowService } from './pipeline.service';
import {
  CreateWorkflowDto,
  CreateWorkflowStageDto,
  UpdateWorkflowStageProgressDto,
  CreateStageNoteDto,
  CreateStageApprovalDto,
  AssignCandidateToWorkflowDto,
  AssignEmployeeToWorkflowDto,
} from './dto/create-pipeline.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const ALL_ROLES = ['System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only'];
const WRITE_ROLES = ['System Admin', 'HR Manager', 'Recruiter', 'Agency Manager'];
const ADMIN_ROLES = ['System Admin', 'HR Manager'];

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // ─── Workflows ────────────────────────────────────────────────────────────

  @Get()
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'List all workflows' })
  listWorkflows(@Query('includeArchived') includeArchived?: string) {
    return this.workflowService.listWorkflows(includeArchived === 'true');
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get a workflow by ID' })
  getWorkflow(@Param('id') id: string) {
    return this.workflowService.getWorkflow(id);
  }

  @Get(':id/board')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get workflow board view with candidates per stage' })
  getBoardView(@Param('id') id: string) {
    return this.workflowService.getWorkflowBoardView(id);
  }

  @Get(':id/candidates')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'List candidates in a workflow' })
  getWorkflowCandidates(@Param('id') id: string) {
    return this.workflowService.getWorkflowCandidates(id);
  }

  @Get(':id/stats')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get workflow statistics' })
  getWorkflowStats(@Param('id') id: string) {
    return this.workflowService.getWorkflowStats(id);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a new workflow' })
  createWorkflow(@Body() dto: CreateWorkflowDto, @Request() req: any) {
    return this.workflowService.createWorkflow(dto, req.user?.id);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update workflow metadata' })
  updateWorkflow(@Param('id') id: string, @Body() dto: Partial<CreateWorkflowDto>, @Request() req: any) {
    return this.workflowService.updateWorkflow(id, dto, req.user?.id);
  }

  @Patch(':id/archive')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Archive a workflow' })
  archiveWorkflow(@Param('id') id: string, @Request() req: any) {
    return this.workflowService.archiveWorkflow(id, req.user?.id);
  }

  @Delete(':id')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Delete a workflow (soft delete)' })
  deleteWorkflow(@Param('id') id: string, @Request() req: any) {
    return this.workflowService.deleteWorkflow(id, req.user?.id);
  }

  // ─── Stages ───────────────────────────────────────────────────────────────

  @Post(':id/stages')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Add a stage to a workflow' })
  addStage(@Param('id') workflowId: string, @Body() dto: CreateWorkflowStageDto, @Request() req: any) {
    return this.workflowService.addStage(workflowId, dto, req.user?.id);
  }

  @Patch(':id/stages/reorder')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Reorder stages in a workflow' })
  reorderStages(@Param('id') workflowId: string, @Body('orderedIds') orderedIds: string[]) {
    return this.workflowService.reorderStages(workflowId, orderedIds);
  }

  @Patch('stages/:stageId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a workflow stage' })
  updateStage(@Param('stageId') stageId: string, @Body() dto: Partial<CreateWorkflowStageDto>, @Request() req: any) {
    return this.workflowService.updateStage(stageId, dto, req.user?.id);
  }

  @Delete('stages/:stageId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Delete a workflow stage' })
  deleteStage(@Param('stageId') stageId: string, @Request() req: any) {
    return this.workflowService.deleteStage(stageId, req.user?.id);
  }

  // ─── Assignments ──────────────────────────────────────────────────────────

  @Post('assign')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Assign a candidate to a workflow' })
  assignCandidate(@Body() dto: AssignCandidateToWorkflowDto, @Request() req: any) {
    return this.workflowService.assignCandidate(dto, req.user?.id);
  }

  @Get('candidate/:candidateId/assignments')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get all workflow assignments for a candidate' })
  getCandidateAssignments(@Param('candidateId') candidateId: string) {
    return this.workflowService.getCandidateAssignments(candidateId);
  }

  // ─── Employee Assignments ─────────────────────────────────────────────────

  @Post('assign-employee')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Assign an employee to a workflow' })
  assignEmployee(@Body() dto: AssignEmployeeToWorkflowDto, @Request() req: any) {
    return this.workflowService.assignEmployee(dto, req.user?.id);
  }

  @Get('employee/:employeeId/assignments')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get all workflow assignments for an employee' })
  getEmployeeWorkflows(@Param('employeeId') employeeId: string) {
    return this.workflowService.getEmployeeWorkflows(employeeId);
  }

  @Delete('employee/:employeeId/assignments/:workflowId')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Remove an employee from a workflow' })
  removeEmployeeWorkflow(@Param('employeeId') employeeId: string, @Param('workflowId') workflowId: string, @Request() req: any) {
    return this.workflowService.removeEmployeeWorkflow(employeeId, workflowId, req.user?.id);
  }

  // ─── Progress ─────────────────────────────────────────────────────────────

  @Post('assignments/:assignmentId/advance')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Advance candidate to a stage in their workflow assignment' })
  advanceToStage(@Param('assignmentId') assignmentId: string, @Body('stageId') stageId: string, @Request() req: any) {
    return this.workflowService.advanceToStage(assignmentId, stageId, req.user?.id);
  }

  @Patch('progress/:progressId')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update candidate stage progress status / flag' })
  updateProgress(@Param('progressId') progressId: string, @Body() dto: UpdateWorkflowStageProgressDto, @Request() req: any) {
    return this.workflowService.updateProgress(progressId, dto, req.user?.id);
  }

  // ─── Notes ────────────────────────────────────────────────────────────────

  @Post('progress/:progressId/notes')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Add a note to a candidate stage progress' })
  addNote(@Param('progressId') progressId: string, @Body() dto: CreateStageNoteDto, @Request() req: any) {
    return this.workflowService.addNote(progressId, dto, req.user?.id);
  }

  @Delete('notes/:noteId')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Delete a stage note' })
  deleteNote(@Param('noteId') noteId: string, @Request() req: any) {
    return this.workflowService.deleteNote(noteId, req.user?.id);
  }

  // ─── Approvals ────────────────────────────────────────────────────────────

  @Post('progress/:progressId/approve')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Submit an approval decision for a stage' })
  submitApproval(@Param('progressId') progressId: string, @Body() dto: CreateStageApprovalDto, @Request() req: any) {
    return this.workflowService.submitApproval(progressId, dto, req.user?.id);
  }
}
