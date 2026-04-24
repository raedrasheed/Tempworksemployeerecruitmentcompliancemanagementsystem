import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
    const workflows = await this.prisma.workflow.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: WORKFLOW_INCLUDE,
    });
    return workflows.map((w: any) => ({
      ...w,
      stages: (w.stages as any[]).filter((s: any) => s.isActive !== false),
    }));
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

  // ─── Private Access Users ─────────────────────────────────────────────────
  // When a Workflow is marked isPublic=false, access is restricted to
  // the users returned by listAccessUsers. The UI exposes add/remove
  // endpoints on the Workflows page. Add/remove on a public workflow
  // is allowed but has no functional effect until it's flipped to
  // private — we still persist the list so flipping back later keeps
  // the previously-configured access intact.

  async listAccessUsers(workflowId: string) {
    await this.getWorkflow(workflowId);
    const rows = await (this.prisma as any).workflowAccessUser.findMany({
      where: { workflowId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { grantedAt: 'asc' },
    });
    return rows;
  }

  async addAccessUser(workflowId: string, userId: string, actorId?: string) {
    await this.getWorkflow(workflowId);
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    try {
      const row = await (this.prisma as any).workflowAccessUser.create({
        data: { workflowId, userId },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });
      if (actorId) {
        await this.prisma.auditLog.create({
          data: { userId: actorId, action: 'WORKFLOW_ACCESS_GRANTED', entity: 'Workflow', entityId: workflowId, changes: { userId } },
        });
      }
      return row;
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('User already has access to this workflow');
      throw err;
    }
  }

  async removeAccessUser(workflowId: string, userId: string, actorId?: string) {
    await this.getWorkflow(workflowId);
    const existing = await (this.prisma as any).workflowAccessUser.findUnique({
      where: { workflowId_userId: { workflowId, userId } },
    });
    if (!existing) throw new NotFoundException('User does not have access to this workflow');
    await (this.prisma as any).workflowAccessUser.delete({
      where: { workflowId_userId: { workflowId, userId } },
    });
    if (actorId) {
      await this.prisma.auditLog.create({
        data: { userId: actorId, action: 'WORKFLOW_ACCESS_REVOKED', entity: 'Workflow', entityId: workflowId, changes: { userId } },
      });
    }
    return { message: 'Access revoked' };
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

    const {
      assignedUserIds, approverUserIds, responsibleUserIds,
      requiredDocTypeIds, minApprovals, approvalMode, ...stageData
    } = dto as any;
    const effectiveApprovers   = approverUserIds   ?? assignedUserIds ?? [];
    const effectiveResponsible = responsibleUserIds ?? [];
    const clampedMin = Math.max(
      1,
      Math.min(Number(minApprovals ?? 1) || 1, Math.max(effectiveApprovers.length, 1)),
    );
    // Whitelist the approval mode — more modes can be added later.
    const normalizedMode = ['ANY', 'ALL'].includes(String(approvalMode ?? 'ANY').toUpperCase())
      ? String(approvalMode ?? 'ANY').toUpperCase()
      : 'ANY';
    const stageUsers = [
      ...effectiveApprovers.map((userId: string) => ({ userId, role: 'APPROVER' })),
      ...effectiveResponsible
        .filter((userId: string) => !effectiveApprovers.includes(userId))
        .map((userId: string) => ({ userId, role: 'RESPONSIBLE' })),
    ];
    const stage = await this.prisma.workflowStage.create({
      data: {
        ...stageData,
        workflowId,
        minApprovals: clampedMin,
        approvalMode: normalizedMode,
        assignedUsers: stageUsers.length ? { create: stageUsers } : undefined,
        requiredDocs: requiredDocTypeIds?.length
          ? { create: requiredDocTypeIds.map((documentTypeId: string) => ({ documentTypeId })) }
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

    const {
      assignedUserIds, approverUserIds, responsibleUserIds,
      requiredDocTypeIds, minApprovals, approvalMode, ...stageData
    } = dto as any;

    const updatePayload: any = { ...stageData };
    if (approvalMode !== undefined) {
      const normalized = String(approvalMode).toUpperCase();
      updatePayload.approvalMode = ['ANY', 'ALL'].includes(normalized) ? normalized : 'ANY';
    }

    const anyUserListProvided =
      assignedUserIds !== undefined ||
      approverUserIds !== undefined ||
      responsibleUserIds !== undefined;
    let effectiveApproversCount: number | null = null;
    if (anyUserListProvided) {
      const effectiveApprovers   = approverUserIds   ?? assignedUserIds ?? [];
      const effectiveResponsible = responsibleUserIds ?? [];
      effectiveApproversCount = effectiveApprovers.length;
      await this.prisma.workflowStageUser.deleteMany({ where: { stageId } });
      const rows = [
        ...effectiveApprovers.map((userId: string) => ({ stageId, userId, role: 'APPROVER' })),
        ...effectiveResponsible
          .filter((userId: string) => !effectiveApprovers.includes(userId))
          .map((userId: string) => ({ stageId, userId, role: 'RESPONSIBLE' })),
      ];
      if (rows.length) {
        await this.prisma.workflowStageUser.createMany({ data: rows, skipDuplicates: true });
      }
    }

    // Clamp minApprovals to [1, approvers.length] so the UI can't
    // ask for a value that can never be satisfied. If the caller
    // didn't send an approver list, use the current live count.
    if (minApprovals !== undefined) {
      if (effectiveApproversCount == null) {
        effectiveApproversCount = await this.prisma.workflowStageUser.count({
          where: { stageId, role: { in: ['APPROVER', 'REVIEWER'] } },
        });
      }
      const ceiling = Math.max(effectiveApproversCount, 1);
      updatePayload.minApprovals = Math.max(1, Math.min(Number(minApprovals) || 1, ceiling));
    } else if (anyUserListProvided && effectiveApproversCount != null) {
      // No minApprovals provided but the approver list changed —
      // make sure the existing value still fits.
      const current = await this.prisma.workflowStage.findUnique({
        where: { id: stageId }, select: { minApprovals: true },
      });
      if (current && current.minApprovals > Math.max(effectiveApproversCount, 1)) {
        updatePayload.minApprovals = Math.max(effectiveApproversCount, 1);
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

  async assignCandidate(
    dto: AssignCandidateToWorkflowDto,
    actorId?: string,
    actor?: { role?: string },
  ) {
    const [candidate, workflow] = await Promise.all([
      this.prisma.applicant.findFirst({ where: { id: dto.candidateId, tier: 'CANDIDATE', deletedAt: null } }),
      this.getWorkflow(dto.workflowId),
    ]);
    if (!candidate) throw new NotFoundException('Candidate not found');

    // Business rule: a candidate is on exactly ONE active workflow at
    // any time. Reassignment to a different workflow is an
    // admin-only privilege.
    const activeAssignments = await this.prisma.candidateWorkflowAssignment.findMany({
      where: { candidateId: dto.candidateId, status: 'ACTIVE' },
      include: { workflow: { select: { id: true, name: true } } },
    });

    const existingOnSame = activeAssignments.find(a => a.workflowId === dto.workflowId);
    if (existingOnSame) {
      throw new ConflictException('Candidate already has an active assignment in this workflow');
    }

    const existingOnOther = activeAssignments.find(a => a.workflowId !== dto.workflowId);
    if (existingOnOther) {
      const isAdmin = actor?.role === 'System Admin';
      if (!isAdmin) {
        throw new ForbiddenException(
          `Candidate is already assigned to "${existingOnOther.workflow?.name ?? 'another workflow'}". ` +
          'Only a System Admin can reassign a candidate to a different workflow.',
        );
      }
      // Admin reassignment: withdraw the prior assignment (preserves
      // its stage-progress history) before creating the new one.
      await this.prisma.candidateWorkflowAssignment.update({
        where: { id: existingOnOther.id },
        data: { status: 'WITHDRAWN' as any, completedAt: new Date() },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'WORKFLOW_REASSIGNED',
          entity: 'CandidateWorkflowAssignment',
          entityId: existingOnOther.id,
          changes: {
            candidateId: dto.candidateId,
            fromWorkflowId: existingOnOther.workflowId,
            toWorkflowId: dto.workflowId,
            reason: dto.notes ?? null,
          } as any,
        },
      });
    }

    // Resolve Stage 1 — always the lowest-order active stage in the
    // workflow, independent of how the `stages` relation happens to
    // be ordered by Prisma's include. Per product spec: on assignment
    // the candidate is placed at Stage 1 with status IN_PROGRESS.
    const activeStages = ((workflow as any).stages ?? [])
      .filter((s: any) => s.isActive !== false)
      .slice()
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    const firstStage = activeStages[0];

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
                // IN_PROGRESS — the candidate is now working through
                // Stage 1. Flips to COMPLETED when the stage is
                // approved / advanced.
                status: 'IN_PROGRESS' as any,
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

  /**
   * Assign a workflow to many candidates in one call. Each candidate
   * goes through the single-assignment path, so the one-active-
   * workflow-per-candidate rule + the admin-only reassignment check
   * are reused without duplication. Per-candidate outcomes are
   * returned so the UI can show a meaningful summary.
   */
  async assignCandidatesBulk(
    dto: { candidateIds: string[]; workflowId: string; notes?: string },
    actorId?: string,
    actor?: { role?: string },
  ) {
    if (!Array.isArray(dto.candidateIds) || dto.candidateIds.length === 0) {
      throw new BadRequestException('candidateIds is required and must be non-empty');
    }
    if (dto.candidateIds.length > 500) {
      throw new BadRequestException('Refusing to process more than 500 candidates in a single bulk assign');
    }
    // Pre-resolve the workflow once so every iteration doesn't re-
    // query the same row. The per-candidate path revalidates too, so
    // this is purely a perf short-circuit.
    await this.getWorkflow(dto.workflowId);

    const results: Array<{
      candidateId: string;
      outcome: 'assigned' | 'reassigned' | 'skipped_same_workflow' | 'forbidden' | 'error';
      assignmentId?: string;
      error?: string;
    }> = [];

    for (const candidateId of [...new Set(dto.candidateIds)]) {
      try {
        const assignment = await this.assignCandidate(
          { candidateId, workflowId: dto.workflowId, notes: dto.notes } as any,
          actorId,
          actor,
        );
        // assignCandidate withdraws the prior row when an admin
        // reassigns — detect that by checking whether a WITHDRAWN
        // row on the same candidate exists with a recent timestamp.
        const hadPrior = await this.prisma.candidateWorkflowAssignment.count({
          where: {
            candidateId,
            status: 'WITHDRAWN' as any,
            completedAt: { gte: new Date(Date.now() - 30 * 1000) },
          },
        });
        results.push({
          candidateId,
          outcome: hadPrior > 0 ? 'reassigned' : 'assigned',
          assignmentId: (assignment as any).id,
        });
      } catch (err: any) {
        // Map the single-assign failure modes onto a stable outcome
        // vocabulary the frontend can render.
        const msg = err?.message ?? 'Unknown error';
        if (err?.status === 409) {
          results.push({ candidateId, outcome: 'skipped_same_workflow', error: msg });
        } else if (err?.status === 403) {
          results.push({ candidateId, outcome: 'forbidden', error: msg });
        } else {
          results.push({ candidateId, outcome: 'error', error: msg });
        }
      }
    }

    const summary = {
      requested: dto.candidateIds.length,
      assigned:              results.filter(r => r.outcome === 'assigned').length,
      reassigned:            results.filter(r => r.outcome === 'reassigned').length,
      skipped_same_workflow: results.filter(r => r.outcome === 'skipped_same_workflow').length,
      forbidden:             results.filter(r => r.outcome === 'forbidden').length,
      errors:                results.filter(r => r.outcome === 'error').length,
    };

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'WORKFLOW_BULK_ASSIGN',
          entity: 'Workflow',
          entityId: dto.workflowId,
          changes: { ...summary, candidateIds: dto.candidateIds } as any,
        },
      });
    }

    return { summary, results };
  }

  async getCandidateAssignments(candidateId: string) {
    return this.prisma.candidateWorkflowAssignment.findMany({
      where: { candidateId },
      include: {
        workflow: {
          select: {
            id: true, name: true, color: true,
            stages: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
              include: {
                requiredDocs: { include: { documentType: { select: { id: true, name: true, category: true } } } },
                assignedUsers: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
              },
            },
          },
        },
        stageProgress: {
          orderBy: { enteredAt: 'asc' },
          include: {
            stage: true,
            approvals: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { approvedBy: { select: { id: true, firstName: true, lastName: true } } },
            },
            notes: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
          },
        },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async removeCandidateAssignment(candidateId: string, assignmentId: string) {
    const assignment = await this.prisma.candidateWorkflowAssignment.findFirst({
      where: { id: assignmentId, candidateId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.prisma.candidateWorkflowAssignment.delete({ where: { id: assignmentId } });
    return { success: true };
  }

  // ─── Employee Assignments ─────────────────────────────────────────────────

  async assignEmployee(_dto: AssignEmployeeToWorkflowDto, _actorId?: string) {
    // Workflows are candidate-only per product spec — the recruitment
    // pipeline ends when the candidate is converted to an employee.
    // Return a 400 so any legacy caller / stale UI surfaces the
    // reason plainly instead of silently 500-ing. Historical
    // EmployeeWorkflowAssignment rows are still readable via the
    // getEmployee* endpoints so operators can clean up.
    throw new BadRequestException(
      'Workflows can only be assigned to candidates. Assign this person while still on the Candidates list.',
    );
    // The body below is kept commented-out for clarity of the old
    // behaviour — do not re-enable without a product decision.
    /*
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
    */
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

  async setEmployeeCurrentStage(_employeeId: string, _stageId: string, _actorId?: string) {
    // Workflows are candidate-only — advancing an employee through a
    // pipeline stage no longer makes sense. Reads / deletes still
    // work on legacy rows.
    throw new BadRequestException(
      'Workflows can only be modified on candidates. Employees no longer move through workflow stages.',
    );
    /* Legacy body preserved for reference:
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
    */
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
    const stages = ((workflow as any).stages as any[]).filter((s: any) => s.isActive !== false);

    // Fetch ALL employee assignments for this workflow once, group by currentStageId in JS
    // (avoid enum/text cast issue by not filtering status in Prisma)
    const allEmpAssignments = await this.prisma.employeeWorkflowAssignment.findMany({
      where: { workflowId },
      select: { currentStageId: true, status: true },
    });
    const empCountByStage = allEmpAssignments
      .filter(ea => ea.status === 'ACTIVE' && ea.currentStageId)
      .reduce<Record<string, number>>((acc, ea) => {
        acc[ea.currentStageId!] = (acc[ea.currentStageId!] ?? 0) + 1;
        return acc;
      }, {});

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

        const empCount = empCountByStage[stage.id] ?? 0;

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
          // count = active candidates + active employees in this stage
          count: progressItems.length + empCount,
        };
      }),
    );

    return { workflow, columns };
  }

  // ─── Stage Progress ───────────────────────────────────────────────────────

  async advanceToStage(assignmentId: string, stageId: string, actorId?: string) {
    const assignment = await this.prisma.candidateWorkflowAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        workflow: {
          include: {
            stages: {
              orderBy: { order: 'asc' },
              include: { assignedUsers: true },
            },
          },
        },
        stageProgress: { include: { stage: { include: { assignedUsers: true } }, approvals: true } },
      },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const stage = (assignment.workflow as any).stages.find((s: any) => s.id === stageId);
    if (!stage) throw new BadRequestException('Stage does not belong to this workflow');

    // Guard the CURRENT (source) stage's approval + responsibility
    // rules before allowing advance. The candidate is advanced FROM
    // the most recent IN_PROGRESS / ACTIVE stage TO the requested
    // target stage.
    const sourceProgress = (assignment as any).stageProgress.find(
      (p: any) => p.status === 'IN_PROGRESS' || p.status === 'ACTIVE',
    );
    if (sourceProgress) {
      const srcStage = sourceProgress.stage;
      const srcApprovers   = (srcStage.assignedUsers ?? []).filter((u: any) => u.role === 'APPROVER' || u.role === 'REVIEWER');
      const srcResponsible = (srcStage.assignedUsers ?? []).filter((u: any) => u.role === 'RESPONSIBLE');

      // Rule 1 — approval gate.
      //   Empty approver list = "None" → Responsible users advance
      //     the candidate freely.
      //   approvalMode = "ALL"  → every listed approver must
      //     individually approve.
      //   approvalMode = "ANY"  (default) → at least `minApprovals`
      //     distinct listed approvers must approve.
      if (srcApprovers.length > 0) {
        const approverIds = new Set(srcApprovers.map((u: any) => u.userId));
        const approvedBy = new Set(
          (sourceProgress.approvals ?? [])
            .filter((a: any) =>
              a.decision === 'APPROVED' &&
              a.approvedById &&
              approverIds.has(a.approvedById),
            )
            .map((a: any) => a.approvedById),
        );
        const mode = String(srcStage.approvalMode ?? 'ANY').toUpperCase();
        const required = mode === 'ALL'
          ? srcApprovers.length
          : Math.max(1, Math.min(Number(srcStage.minApprovals ?? 1) || 1, srcApprovers.length));
        if (approvedBy.size < required) {
          throw new ForbiddenException(
            `Stage "${srcStage.name}" is awaiting approval. ` +
            `${approvedBy.size} of ${required} required approver(s) have approved` +
            (mode === 'ALL' ? ' (mode: All approvers).' : '.'),
          );
        }
      }

      // Rule 2 — responsibility gate. When the stage is not set to
      // "Any" and no approvers are assigned, only the RESPONSIBLE
      // users can advance. When approvers exist the responsibility
      // gate is skipped (Rule 1 already covered it).
      const hasApprovers = srcApprovers.length > 0 && srcStage.requiresApproval;
      if (!hasApprovers && !srcStage.responsibleAny && srcResponsible.length > 0) {
        const allowed = new Set(srcResponsible.map((u: any) => u.userId));
        if (!actorId || !allowed.has(actorId)) {
          throw new ForbiddenException(
            `Only the responsible users assigned to "${srcStage.name}" may advance the candidate.`,
          );
        }
      }

      // Close out the source stage so the per-stage history reads
      // cleanly: source → COMPLETED, then target → IN_PROGRESS below.
      await this.prisma.candidateStageProgress.update({
        where: { id: sourceProgress.id },
        data: { status: 'COMPLETED' as any, completedAt: new Date() },
      });
    }

    const existing = await this.prisma.candidateStageProgress.findFirst({
      where: { assignmentId, stageId, status: { in: ['ACTIVE', 'IN_PROGRESS'] as any } },
    });
    if (existing) throw new ConflictException('Candidate is already active in this stage');

    const slaDeadline = stage.slaHours ? new Date(Date.now() + stage.slaHours * 3600 * 1000) : null;

    const progress = await this.prisma.candidateStageProgress.create({
      data: {
        assignmentId,
        stageId,
        // IN_PROGRESS once the candidate enters the new stage —
        // aligns with the initial-assignment semantics.
        status: 'IN_PROGRESS' as any,
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
    const progress = await this.prisma.candidateStageProgress.findUnique({
      where: { id: progressId },
      include: { stage: { include: { assignedUsers: true } } },
    });
    if (!progress) throw new NotFoundException('Progress record not found');
    if (!(progress.stage as any).requiresApproval) throw new BadRequestException('This stage does not require approval');

    // Only users assigned with role APPROVER (or legacy REVIEWER)
    // may submit approval decisions. Responsible-only users can
    // process the candidate but cannot sign off on approvals.
    const approvers = ((progress.stage as any).assignedUsers ?? [])
      .filter((u: any) => u.role === 'APPROVER' || u.role === 'REVIEWER');
    if (approvers.length > 0 && actorId && !approvers.some((u: any) => u.userId === actorId)) {
      throw new ForbiddenException(
        `You are not an approver for "${(progress.stage as any).name}". Only assigned approvers may approve this stage.`,
      );
    }

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
      // Note: filter status in JS to avoid Prisma enum/text cast issue with pg adapter
      this.prisma.employeeWorkflowAssignment.findMany({
        where: { currentStageId: stageId },
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

    // Map employees (filter ACTIVE in JS — avoids Prisma enum/text cast issue with pg adapter)
    const employeeEntries = employeeAssignments.filter(ea => ea.status === 'ACTIVE').map((ea) => {
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
    const [candidateActive, candidateCompleted, flaggedCount, slaBreached, empAssignments] = await Promise.all([
      this.prisma.candidateWorkflowAssignment.count({ where: { workflowId, status: 'ACTIVE' } }),
      this.prisma.candidateWorkflowAssignment.count({ where: { workflowId, status: 'COMPLETED' } }),
      this.prisma.candidateStageProgress.count({ where: { assignment: { workflowId }, flagged: true, status: 'ACTIVE' } }),
      this.prisma.candidateStageProgress.count({ where: { assignment: { workflowId }, status: 'ACTIVE', slaDeadline: { lt: new Date() } } }),
      // Fetch employee assignments and filter in JS (avoid enum/text cast issue)
      this.prisma.employeeWorkflowAssignment.findMany({
        where: { workflowId },
        select: { status: true },
      }),
    ]);

    const empActive    = empAssignments.filter(ea => ea.status === 'ACTIVE').length;
    const empCompleted = empAssignments.filter(ea => ea.status === 'COMPLETED').length;

    return {
      totalActive:    candidateActive    + empActive,
      totalCompleted: candidateCompleted + empCompleted,
      flaggedCount,
      slaBreached,
    };
  }
}
