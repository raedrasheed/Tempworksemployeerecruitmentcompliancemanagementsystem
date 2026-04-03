import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkflowDto,
  CreateWorkflowStageDto,
  UpdateWorkflowStageProgressDto,
  CreateStageNoteDto,
  CreateStageApprovalDto,
  AssignCandidateToWorkflowDto,
} from './dto/create-pipeline.dto';

const WORKFLOW_STAGE_INCLUDE = {
  assignedUsers: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
  requiredDocs: { include: { documentType: { select: { id: true, name: true, category: true } } } },
  _count: { select: { candidateProgress: true } },
} as const;

const WORKFLOW_INCLUDE = {
  stages: { orderBy: { order: 'asc' as const }, include: WORKFLOW_STAGE_INCLUDE },
  _count: { select: { assignments: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  // ─── Workflows ────────────────────────────────────────────────────────────

  async listWorkflows(includeArchived = false) {
    const where: any = { deletedAt: null };
    if (!includeArchived) where.status = 'ACTIVE';
    return this.prisma.workflow.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: WORKFLOW_INCLUDE,
    });
  }

  async getWorkflow(id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, deletedAt: null },
      include: WORKFLOW_INCLUDE,
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async createWorkflow(dto: CreateWorkflowDto, createdById?: string) {
    if (dto.isDefault) {
      await this.prisma.workflow.updateMany({ where: { isDefault: true, deletedAt: null }, data: { isDefault: false } });
    }
    return this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
        isPublic: dto.isPublic ?? true,
        color: dto.color ?? '#2563EB',
        createdById,
      },
      include: WORKFLOW_INCLUDE,
    });
  }

  async updateWorkflow(id: string, dto: Partial<CreateWorkflowDto>, updatedById?: string) {
    await this.getWorkflow(id);
    if (dto.isDefault) {
      await this.prisma.workflow.updateMany({ where: { isDefault: true, deletedAt: null, id: { not: id } }, data: { isDefault: false } });
    }
    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
      include: WORKFLOW_INCLUDE,
    });
    if (updatedById) {
      await this.prisma.auditLog.create({ data: { userId: updatedById, action: 'UPDATE', entity: 'Workflow', entityId: id, changes: dto as any } });
    }
    return updated;
  }

  async archiveWorkflow(id: string, actorId?: string) {
    await this.getWorkflow(id);
    const updated = await this.prisma.workflow.update({ where: { id }, data: { status: 'ARCHIVED' as any } });
    if (actorId) {
      await this.prisma.auditLog.create({ data: { userId: actorId, action: 'ARCHIVE', entity: 'Workflow', entityId: id } });
    }
    return updated;
  }

  async deleteWorkflow(id: string, actorId?: string) {
    await this.getWorkflow(id);
    await this.prisma.workflow.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: actorId } });
    if (actorId) {
      await this.prisma.auditLog.create({ data: { userId: actorId, action: 'DELETE', entity: 'Workflow', entityId: id } });
    }
    return { message: 'Workflow deleted' };
  }

  // ─── Stages ───────────────────────────────────────────────────────────────

  async addStage(workflowId: string, dto: CreateWorkflowStageDto, actorId?: string) {
    await this.getWorkflow(workflowId);

    // Auto-assign order if not provided
    if (dto.order == null) {
      const last = await this.prisma.workflowStage.findFirst({ where: { workflowId }, orderBy: { order: 'desc' } });
      dto.order = last ? last.order + 1 : 1;
    }

    // Check for order conflict and shift if needed
    const conflict = await this.prisma.workflowStage.findFirst({ where: { workflowId, order: dto.order } });
    if (conflict) {
      await this.prisma.$executeRaw`
        UPDATE "workflow_stages"
        SET "order" = "order" + 1
        WHERE "workflowId" = ${workflowId} AND "order" >= ${dto.order}
      `;
    }

    const { assignedUserIds, requiredDocTypeIds, ...stageData } = dto;
    const stage = await this.prisma.workflowStage.create({
      data: {
        ...stageData,
        workflowId,
        assignedUsers: assignedUserIds?.length
          ? { create: assignedUserIds.map((userId) => ({ userId, role: 'REVIEWER' })) }
          : undefined,
        requiredDocs: requiredDocTypeIds?.length
          ? { create: requiredDocTypeIds.map((documentTypeId) => ({ documentTypeId })) }
          : undefined,
      } as any,
      include: WORKFLOW_STAGE_INCLUDE,
    });
    if (actorId) {
      await this.prisma.auditLog.create({ data: { userId: actorId, action: 'CREATE', entity: 'WorkflowStage', entityId: stage.id, changes: { workflowId } as any } });
    }
    return stage;
  }

  async updateStage(stageId: string, dto: Partial<CreateWorkflowStageDto>, actorId?: string) {
    const stage = await this.prisma.workflowStage.findUnique({ where: { id: stageId } });
    if (!stage) throw new NotFoundException('Stage not found');

    const { assignedUserIds, requiredDocTypeIds, ...stageData } = dto;

    const updatePayload: any = { ...stageData };

    // Replace assigned users if provided
    if (assignedUserIds !== undefined) {
      await this.prisma.workflowStageUser.deleteMany({ where: { stageId } });
      if (assignedUserIds.length) {
        await this.prisma.workflowStageUser.createMany({
          data: assignedUserIds.map((userId) => ({ stageId, userId, role: 'REVIEWER' })),
          skipDuplicates: true,
        });
      }
    }

    // Replace required docs if provided
    if (requiredDocTypeIds !== undefined) {
      await this.prisma.workflowStageRequiredDoc.deleteMany({ where: { stageId } });
      if (requiredDocTypeIds.length) {
        await this.prisma.workflowStageRequiredDoc.createMany({
          data: requiredDocTypeIds.map((documentTypeId) => ({ stageId, documentTypeId })),
          skipDuplicates: true,
        });
      }
    }

    return this.prisma.workflowStage.update({
      where: { id: stageId },
      data: updatePayload,
      include: WORKFLOW_STAGE_INCLUDE,
    });
  }

  async deleteStage(stageId: string, actorId?: string) {
    const stage = await this.prisma.workflowStage.findUnique({ where: { id: stageId } });
    if (!stage) throw new NotFoundException('Stage not found');
    await this.prisma.workflowStage.delete({ where: { id: stageId } });
    return { message: 'Stage deleted' };
  }

  async reorderStages(workflowId: string, orderedIds: string[]) {
    await this.getWorkflow(workflowId);
    await Promise.all(
      orderedIds.map((id, idx) =>
        this.prisma.workflowStage.update({ where: { id }, data: { order: idx + 1 } }),
      ),
    );
    return this.getWorkflow(workflowId);
  }

  // ─── Assignments ──────────────────────────────────────────────────────────

  async assignCandidate(dto: AssignCandidateToWorkflowDto, actorId?: string) {
    const [candidate, workflow] = await Promise.all([
      this.prisma.applicant.findFirst({ where: { id: dto.candidateId, tier: 'CANDIDATE', deletedAt: null } }),
      this.getWorkflow(dto.workflowId),
    ]);
    if (!candidate) throw new NotFoundException('Candidate not found');

    // Check for existing active assignment to same workflow
    const existing = await this.prisma.candidateWorkflowAssignment.findFirst({
      where: { candidateId: dto.candidateId, workflowId: dto.workflowId, status: 'ACTIVE' },
    });
    if (existing) throw new ConflictException('Candidate already has an active assignment in this workflow');

    // Get first stage
    const firstStage = (workflow as any).stages?.[0];

    const assignment = await this.prisma.candidateWorkflowAssignment.create({
      data: {
        candidateId: dto.candidateId,
        workflowId: dto.workflowId,
        assignedById: actorId,
        notes: dto.notes,
        stageProgress: firstStage
          ? {
              create: {
                stageId: firstStage.id,
                status: 'ACTIVE',
                slaDeadline: firstStage.slaHours
                  ? new Date(Date.now() + firstStage.slaHours * 3600 * 1000)
                  : undefined,
              },
            }
          : undefined,
      },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true, candidateNumber: true } },
        workflow: { select: { id: true, name: true } },
        stageProgress: { include: { stage: true } },
      },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: { userId: actorId, action: 'ASSIGN', entity: 'CandidateWorkflowAssignment', entityId: assignment.id, changes: { candidateId: dto.candidateId, workflowId: dto.workflowId } as any },
      });
    }
    return assignment;
  }

  async getCandidateAssignments(candidateId: string) {
    return this.prisma.candidateWorkflowAssignment.findMany({
      where: { candidateId },
      include: {
        workflow: { select: { id: true, name: true, color: true } },
        stageProgress: {
          orderBy: { enteredAt: 'asc' },
          include: {
            stage: true,
            approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
            notes: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async getWorkflowCandidates(workflowId: string) {
    await this.getWorkflow(workflowId);
    return this.prisma.candidateWorkflowAssignment.findMany({
      where: { workflowId, status: 'ACTIVE' },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, candidateNumber: true, photoUrl: true, nationality: true, status: true } },
        stageProgress: {
          where: { status: 'ACTIVE' },
          include: { stage: { select: { id: true, name: true, color: true, order: true } } },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async getWorkflowBoardView(workflowId: string) {
    const workflow = await this.getWorkflow(workflowId);
    const stages = (workflow as any).stages as any[];

    const columns = await Promise.all(
      stages.map(async (stage: any) => {
        const progressItems = await this.prisma.candidateStageProgress.findMany({
          where: { stageId: stage.id, status: 'ACTIVE', assignment: { workflowId } },
          include: {
            assignment: {
              include: {
                candidate: { select: { id: true, firstName: true, lastName: true, email: true, candidateNumber: true, photoUrl: true, nationality: true } },
              },
            },
            approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
            notes: { where: { deletedAt: null, isPrivate: false }, orderBy: { createdAt: 'desc' }, take: 3 },
          },
          orderBy: { enteredAt: 'asc' },
        });

        return {
          stage,
          candidates: progressItems.map((p) => ({
            progressId: p.id,
            assignmentId: p.assignmentId,
            status: p.status,
            enteredAt: p.enteredAt,
            slaDeadline: p.slaDeadline,
            flagged: p.flagged,
            flagReason: p.flagReason,
            latestApproval: (p.approvals as any[])[0] ?? null,
            recentNotes: p.notes,
            candidate: (p.assignment as any).candidate,
          })),
          count: progressItems.length,
        };
      }),
    );

    return { workflow, columns };
  }

  // ─── Stage Progress ───────────────────────────────────────────────────────

  async advanceToStage(assignmentId: string, stageId: string, actorId?: string) {
    const assignment = await this.prisma.candidateWorkflowAssignment.findUnique({
      where: { id: assignmentId },
      include: { workflow: { include: { stages: { orderBy: { order: 'asc' } } } } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const stage = (assignment.workflow as any).stages.find((s: any) => s.id === stageId);
    if (!stage) throw new BadRequestException('Stage does not belong to this workflow');

    const existing = await this.prisma.candidateStageProgress.findFirst({
      where: { assignmentId, stageId, status: 'ACTIVE' },
    });
    if (existing) throw new ConflictException('Candidate is already active in this stage');

    const slaDeadline = stage.slaHours ? new Date(Date.now() + stage.slaHours * 3600 * 1000) : null;

    const progress = await this.prisma.candidateStageProgress.create({
      data: {
        assignmentId,
        stageId,
        status: 'ACTIVE',
        slaDeadline: slaDeadline ?? undefined,
        ...(stage.requiresApproval ? { approvals: { create: { decision: 'PENDING' } } } : {}),
      },
      include: { stage: true, approvals: true },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: { userId: actorId, action: 'STAGE_ADVANCE', entity: 'CandidateStageProgress', entityId: progress.id, changes: { stageId, stageN: stage.name } as any },
      });
    }
    return progress;
  }

  async updateProgress(progressId: string, dto: UpdateWorkflowStageProgressDto, actorId?: string) {
    const progress = await this.prisma.candidateStageProgress.findUnique({ where: { id: progressId }, include: { stage: true } });
    if (!progress) throw new NotFoundException('Progress record not found');

    const data: any = { status: dto.status };
    if (dto.status === 'COMPLETED') data.completedAt = new Date();
    if (dto.flagged !== undefined) data.flagged = dto.flagged;
    if (dto.flagReason !== undefined) data.flagReason = dto.flagReason;

    // If completing a non-final stage, check if we should auto-complete assignment
    const updated = await this.prisma.candidateStageProgress.update({
      where: { id: progressId },
      data,
      include: { stage: true, assignment: true },
    });

    // If final stage completed, complete the assignment
    if (dto.status === 'COMPLETED' && (progress.stage as any).isFinal) {
      await this.prisma.candidateWorkflowAssignment.update({
        where: { id: (updated as any).assignmentId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }

    return updated;
  }

  // ─── Notes ────────────────────────────────────────────────────────────────

  async addNote(progressId: string, dto: CreateStageNoteDto, actorId?: string) {
    const progress = await this.prisma.candidateStageProgress.findUnique({ where: { id: progressId } });
    if (!progress) throw new NotFoundException('Progress record not found');
    return this.prisma.candidateStageNote.create({
      data: { progressId, content: dto.content, isPrivate: dto.isPrivate ?? false, authorId: actorId },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async deleteNote(noteId: string, actorId?: string) {
    const note = await this.prisma.candidateStageNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.prisma.candidateStageNote.update({ where: { id: noteId }, data: { deletedAt: new Date() } });
    return { message: 'Note deleted' };
  }

  // ─── Approvals ────────────────────────────────────────────────────────────

  async submitApproval(progressId: string, dto: CreateStageApprovalDto, actorId?: string) {
    const progress = await this.prisma.candidateStageProgress.findUnique({ where: { id: progressId }, include: { stage: true } });
    if (!progress) throw new NotFoundException('Progress record not found');
    if (!(progress.stage as any).requiresApproval) throw new BadRequestException('This stage does not require approval');

    // Upsert approval for this actor on this progress
    const existing = await this.prisma.candidateStageApproval.findFirst({ where: { progressId, approvedById: actorId } });
    if (existing) {
      return this.prisma.candidateStageApproval.update({
        where: { id: existing.id },
        data: { decision: dto.decision as any, notes: dto.notes, decidedAt: new Date(), approvedById: actorId },
        include: { approvedBy: { select: { id: true, firstName: true, lastName: true } } },
      });
    }

    return this.prisma.candidateStageApproval.create({
      data: { progressId, decision: dto.decision as any, notes: dto.notes, decidedAt: new Date(), approvedById: actorId },
      include: { approvedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getWorkflowStats(workflowId: string) {
    await this.getWorkflow(workflowId);
    const [totalActive, totalCompleted, flaggedCount] = await Promise.all([
      this.prisma.candidateWorkflowAssignment.count({ where: { workflowId, status: 'ACTIVE' } }),
      this.prisma.candidateWorkflowAssignment.count({ where: { workflowId, status: 'COMPLETED' } }),
      this.prisma.candidateStageProgress.count({ where: { assignment: { workflowId }, flagged: true, status: 'ACTIVE' } }),
    ]);

    const slaBreached = await this.prisma.candidateStageProgress.count({
      where: { assignment: { workflowId }, status: 'ACTIVE', slaDeadline: { lt: new Date() } },
    });

    return { totalActive, totalCompleted, flaggedCount, slaBreached };
  }
}
