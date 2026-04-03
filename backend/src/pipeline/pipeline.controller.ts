import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PipelineService } from './pipeline.service';
import {
  CreatePipelineDto,
  CreatePipelineStageDto,
  UpdatePipelineStageProgressDto,
  CreateStageNoteDto,
  CreateStageApprovalDto,
  AssignCandidateToPipelineDto,
} from './dto/create-pipeline.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const ALL_ROLES = ['System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only'];
const WRITE_ROLES = ['System Admin', 'HR Manager', 'Recruiter', 'Agency Manager'];
const ADMIN_ROLES = ['System Admin', 'HR Manager'];

@ApiTags('Pipelines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pipelines')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  // ─── Pipelines ────────────────────────────────────────────────────────────

  @Get()
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'List all pipelines' })
  listPipelines(@Query('includeArchived') includeArchived?: string) {
    return this.pipelineService.listPipelines(includeArchived === 'true');
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get a pipeline by ID' })
  getPipeline(@Param('id') id: string) {
    return this.pipelineService.getPipeline(id);
  }

  @Get(':id/board')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get pipeline board view with candidates per stage' })
  getBoardView(@Param('id') id: string) {
    return this.pipelineService.getPipelineBoardView(id);
  }

  @Get(':id/candidates')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'List candidates in a pipeline' })
  getPipelineCandidates(@Param('id') id: string) {
    return this.pipelineService.getPipelineCandidates(id);
  }

  @Get(':id/stats')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get pipeline statistics' })
  getPipelineStats(@Param('id') id: string) {
    return this.pipelineService.getPipelineStats(id);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a new pipeline' })
  createPipeline(@Body() dto: CreatePipelineDto, @Request() req: any) {
    return this.pipelineService.createPipeline(dto, req.user?.id);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update pipeline metadata' })
  updatePipeline(@Param('id') id: string, @Body() dto: Partial<CreatePipelineDto>, @Request() req: any) {
    return this.pipelineService.updatePipeline(id, dto, req.user?.id);
  }

  @Patch(':id/archive')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Archive a pipeline' })
  archivePipeline(@Param('id') id: string, @Request() req: any) {
    return this.pipelineService.archivePipeline(id, req.user?.id);
  }

  @Delete(':id')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Delete a pipeline (soft delete)' })
  deletePipeline(@Param('id') id: string, @Request() req: any) {
    return this.pipelineService.deletePipeline(id, req.user?.id);
  }

  // ─── Stages ───────────────────────────────────────────────────────────────

  @Post(':id/stages')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Add a stage to a pipeline' })
  addStage(@Param('id') pipelineId: string, @Body() dto: CreatePipelineStageDto, @Request() req: any) {
    return this.pipelineService.addStage(pipelineId, dto, req.user?.id);
  }

  @Patch(':id/stages/reorder')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Reorder stages in a pipeline' })
  reorderStages(@Param('id') pipelineId: string, @Body('orderedIds') orderedIds: string[]) {
    return this.pipelineService.reorderStages(pipelineId, orderedIds);
  }

  @Patch('stages/:stageId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a pipeline stage' })
  updateStage(@Param('stageId') stageId: string, @Body() dto: Partial<CreatePipelineStageDto>, @Request() req: any) {
    return this.pipelineService.updateStage(stageId, dto, req.user?.id);
  }

  @Delete('stages/:stageId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Delete a pipeline stage' })
  deleteStage(@Param('stageId') stageId: string, @Request() req: any) {
    return this.pipelineService.deleteStage(stageId, req.user?.id);
  }

  // ─── Assignments ──────────────────────────────────────────────────────────

  @Post('assign')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Assign a candidate to a pipeline' })
  assignCandidate(@Body() dto: AssignCandidateToPipelineDto, @Request() req: any) {
    return this.pipelineService.assignCandidate(dto, req.user?.id);
  }

  @Get('candidate/:candidateId/assignments')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get all pipeline assignments for a candidate' })
  getCandidateAssignments(@Param('candidateId') candidateId: string) {
    return this.pipelineService.getCandidateAssignments(candidateId);
  }

  // ─── Progress ─────────────────────────────────────────────────────────────

  @Post('assignments/:assignmentId/advance')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Advance candidate to a stage in their pipeline assignment' })
  advanceToStage(@Param('assignmentId') assignmentId: string, @Body('stageId') stageId: string, @Request() req: any) {
    return this.pipelineService.advanceToStage(assignmentId, stageId, req.user?.id);
  }

  @Patch('progress/:progressId')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update candidate stage progress status / flag' })
  updateProgress(@Param('progressId') progressId: string, @Body() dto: UpdatePipelineStageProgressDto, @Request() req: any) {
    return this.pipelineService.updateProgress(progressId, dto, req.user?.id);
  }

  // ─── Notes ────────────────────────────────────────────────────────────────

  @Post('progress/:progressId/notes')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Add a note to a candidate stage progress' })
  addNote(@Param('progressId') progressId: string, @Body() dto: CreateStageNoteDto, @Request() req: any) {
    return this.pipelineService.addNote(progressId, dto, req.user?.id);
  }

  @Delete('notes/:noteId')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Delete a stage note' })
  deleteNote(@Param('noteId') noteId: string, @Request() req: any) {
    return this.pipelineService.deleteNote(noteId, req.user?.id);
  }

  // ─── Approvals ────────────────────────────────────────────────────────────

  @Post('progress/:progressId/approve')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Submit an approval decision for a stage' })
  submitApproval(@Param('progressId') progressId: string, @Body() dto: CreateStageApprovalDto, @Request() req: any) {
    return this.pipelineService.submitApproval(progressId, dto, req.user?.id);
  }
}
