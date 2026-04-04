import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkflowDto,
  CreateWorkflowStageDto,
  UpdateWorkflowStageProgressDto,
  CreateStageNoteDto,
  CreateStageApprovalDto,
  AssignCandidateToWorkflowDto,
  AssignEmployeeToWorkflowDto,
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
    // Use a transaction with sequential updates to avoid intermediate unique-constraint
    // violations on (workflowId, order). First shift all orders to a safe negative
    // range, then assign the final values sequentially.
    await this.prisma.$transaction(async (tx) => {
      // Step 1: move all to temporary negative values to vacate the constraint space
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.workflowStage.update({ where: { id: orderedIds[i] }, data: { order: -(i + 1) } });
      }
      // Step 2: assign final positive order values
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.workflowStage.update({ where: { id: orderedIds[i] }, data: { order: i + 1 } });
      }
    });
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

  // ─── Employee Assignments ─────────────────────────────────────────────────

  async assignEmployee(dto: AssignEmployeeToWorkflowDto, actorId?: string) {
    const [employee] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: dto.employeeId, deletedAt: null } }),
      this.getWorkflow(dto.workflowId),
    ]);
    if (!employee) throw new NotFoundException('Employee not found');

    // Delete any existing assignment (one-per-employee rule)
    await this.prisma.employeeWorkflowAssignment.deleteMany({ where: { employeeId: dto.employeeId } });

    const assignment = await this.prisma.employeeWorkflowAssignment.create({
      data: {
        employeeId: dto.employeeId,
        workflowId: dto.workflowId,
        assignedById: actorId,
        notes: dto.notes,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, email: true, employeeNumber: true } },
        workflow: { include: { stages: { orderBy: { order: 'asc' } } } },
        currentStage: true,
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'ASSIGN',
          entity: 'EmployeeWorkflowAssignment',
          entityId: assignment.id,
          changes: { employeeId: dto.employeeId, workflowId: dto.workflowId } as any,
        },
      });
    }
    return assignment;
  }

  async getEmployeeWorkflows(employeeId: string) {
    const [assignment, approvals] = await Promise.all([
      this.prisma.employeeWorkflowAssignment.findFirst({
        where: { employeeId },
        include: {
          workflow: {
            include: {
              stages: {
                orderBy: { order: 'asc' },
                include: {
                  requiredDocs: { include: { documentType: { select: { id: true, name: true, category: true } } } },
                  assignedUsers: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
                },
              },
            },
          },
          currentStage: true,
          assignedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.employeeStageApproval.findMany({
        where: { employeeId },
        include: { approvedBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);

    if (!assignment) return null;
    return { ...assignment, stageApprovals: approvals };
  }

  async approveEmployeeStage(employeeId: string, stageId: string, actorId: string, notes?: string) {
    const assignment = await this.prisma.employeeWorkflowAssignment.findUnique({ where: { employeeId } });
    if (!assignment) throw new NotFoundException('No workflow assignment found for this employee');

    const stage = await this.prisma.workflowStage.findFirst({
      where: { id: stageId, workflowId: assignment.workflowId },
      include: { assignedUsers: true },
    });
    if (!stage) throw new NotFoundException('Stage not found in this employee\'s workflow');

    const approval = await this.prisma.employeeStageApproval.upsert({
      where: { employeeId_stageId: { employeeId, stageId } },
      create: { id: require('crypto').randomUUID(), employeeId, stageId, approvedById: actorId, notes },
      update: { approvedById: actorId, approvedAt: new Date(), notes },
      include: { approvedBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    return approval;
  }

  async setEmployeeCurrentStage(employeeId: string, stageId: string, actorId?: string) {
    const assignment = await this.prisma.employeeWorkflowAssignment.findUnique({
      where: { employeeId },
    });
    if (!assignment) throw new NotFoundException('No workflow assignment found for this employee');

    const stage = await this.prisma.workflowStage.findFirst({
      where: { id: stageId, workflowId: assignment.workflowId },
    });
    if (!stage) throw new NotFoundException('Stage does not belong to this employee\'s workflow');

    const [updated, approvals] = await Promise.all([
      this.prisma.employeeWorkflowAssignment.update({
        where: { employeeId },
        data: { currentStageId: stageId },
        include: {
          workflow: {
            include: {
              stages: {
                orderBy: { order: 'asc' },
                include: {
                  requiredDocs: { include: { documentType: { select: { id: true, name: true, category: true } } } },
                  assignedUsers: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
                },
              },
            },
          },
          currentStage: true,
          assignedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.employeeStageApproval.findMany({
        where: { employeeId },
        include: { approvedBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);
    return { ...updated, stageApprovals: approvals };
  }

  async removeEmployeeWorkflow(employeeId: string, workflowId: string, actorId?: string) {
    const assignment = await this.prisma.employeeWorkflowAssignment.findFirst({
      where: { employeeId, workflowId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.prisma.employeeWorkflowAssignment.delete({ where: { id: assignment.id } });
    if (actorId) {
      await this.prisma.auditLog.create({
        data: { userId: actorId, action: 'DELETE', entity: 'EmployeeWorkflowAssignment', entityId: assignment.id },
      });
    }
    return { message: 'Employee removed from workflow' };
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

  // ─── WorkflowStage Detail ─────────────────────────────────────────────────

  async getWorkflowStageDetails(stageId: string) {
    const stage = await this.prisma.workflowStage.findUnique({
      where: { id: stageId },
      include: {
        requiredDocs: { include: { documentType: { select: { id: true, name: true, category: true } } } },
        assignedUsers: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        workflow: { select: { id: true, name: true } },
      },
    });
    if (!stage) throw new NotFoundException('Stage not found');

    // All stages in the workflow for "Stage X of Y"
    const allStages = await this.prisma.workflowStage.findMany({
      where: { workflowId: stage.workflowId },
      orderBy: { order: 'asc' },
      select: { id: true, order: true, name: true },
    });

    // Active candidates in this stage (via CandidateStageProgress)
    const [progressItems, employeeAssignments] = await Promise.all([
      this.prisma.candidateStageProgress.findMany({
        where: { stageId, status: 'ACTIVE' },
        include: {
          assignment: {
            include: {
              candidate: {
                select: {
                  id: true, firstName: true, lastName: true, email: true,
                  candidateNumber: true, photoUrl: true, nationality: true,
                },
              },
            },
          },
          approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { enteredAt: 'asc' },
      }),
      // Active employees whose currentStageId === this stage
      this.prisma.employeeWorkflowAssignment.findMany({
        where: { currentStageId: stageId, status: 'ACTIVE' },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true, email: true,
              employeeNumber: true, photoUrl: true, nationality: true, status: true,
            },
          },
        },
        orderBy: { assignedAt: 'asc' },
      }),
    ]);

    // Map candidates
    const candidateEntries = progressItems.map((p) => {
      const daysInStage = Math.floor((Date.now() - new Date(p.enteredAt).getTime()) / 86400000);
      const candidate = (p.assignment as any).candidate;
      return {
        progressId: p.id,
        assignmentId: p.assignmentId,
        personType: 'CANDIDATE' as const,
        personId:   candidate?.id,
        firstName:  candidate?.firstName,
        lastName:   candidate?.lastName,
        email:      candidate?.email,
        systemId:   candidate?.candidateNumber,
        photoUrl:   candidate?.photoUrl,
        nationality: candidate?.nationality,
        enteredAt:  p.enteredAt,
        slaDeadline: p.slaDeadline,
        flagged:    p.flagged,
        daysInStage,
        latestApproval: (p.approvals as any[])[0] ?? null,
        profileLink: `/dashboard/applicants/${candidate?.id}`,
      };
    });

    // Map employees
    const employeeEntries = employeeAssignments.map((ea) => {
      const emp = (ea as any).employee;
      const daysInStage = Math.floor((Date.now() - new Date(ea.assignedAt).getTime()) / 86400000);
      return {
        progressId:  ea.id,
        assignmentId: ea.id,
        personType:  'EMPLOYEE' as const,
        personId:    emp?.id,
        firstName:   emp?.firstName,
        lastName:    emp?.lastName,
        email:       emp?.email,
        systemId:    emp?.employeeNumber,
        photoUrl:    emp?.photoUrl,
        nationality: emp?.nationality,
        enteredAt:   ea.assignedAt,
        slaDeadline: null,
        flagged:     false,
        daysInStage,
        latestApproval: null,
        profileLink: `/dashboard/employees/${emp?.id}`,
      };
    });

    const allPeople = [...candidateEntries, ...employeeEntries];
    const avgDays = allPeople.length > 0
      ? Math.round(allPeople.reduce((s, c) => s + c.daysInStage, 0) / allPeople.length)
      : 0;
    const atRiskCount = allPeople.filter(c => c.daysInStage > 14).length;

    return {
      stage,
      allStages,
      people: allPeople,
      stats: {
        total:          allPeople.length,
        candidatesCount: candidateEntries.length,
        employeesCount:  employeeEntries.length,
        avgDays,
        atRiskCount,
      },
    };
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
