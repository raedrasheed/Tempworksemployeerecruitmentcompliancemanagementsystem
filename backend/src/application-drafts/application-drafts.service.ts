import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicantsService } from '../applicants/applicants.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { SubmitDraftDto } from './dto/submit-draft.dto';

/**
 * Save-for-later drafts on the applicant creation form.
 *
 * Invariants:
 *  • Exactly one draft per user — enforced by a UNIQUE constraint on
 *    application_drafts.createdById. getMine / saveMine are per-user
 *    endpoints that always address the caller's own draft.
 *  • No Applicant row exists while a draft is open. The Lead is
 *    created only by submitMine(), which then deletes the draft.
 *  • submitMine persists the latest formData into the draft first,
 *    so if the subsequent Applicant creation fails the caller can
 *    retry without retyping.
 */
@Injectable()
export class ApplicationDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicants: ApplicantsService,
  ) {}

  async getMine(userId: string) {
    const draft = await (this.prisma as any).applicationDraft.findUnique({
      where: { createdById: userId },
    });
    return draft ?? null;
  }

  async saveMine(userId: string, dto: SaveDraftDto) {
    return (this.prisma as any).applicationDraft.upsert({
      where: { createdById: userId },
      create: {
        createdById: userId,
        jobAdId: dto.jobAdId ?? null,
        formData: (dto.formData ?? {}) as any,
      },
      update: {
        jobAdId: dto.jobAdId ?? null,
        formData: (dto.formData ?? {}) as any,
      },
    });
  }

  async deleteMine(userId: string) {
    try {
      await (this.prisma as any).applicationDraft.delete({ where: { createdById: userId } });
    } catch {
      // Record already gone — discard is idempotent.
    }
    return { message: 'Draft discarded' };
  }

  /**
   * Final submit. Persists the latest draft snapshot first (so the
   * user's typing is never lost if the create call fails), hands off
   * to ApplicantsService.create — which runs through all the
   * existing tenancy / agency / approval rules — then deletes the
   * draft so a fresh application can be started.
   *
   * The backend-guaranteed "one applicant per draft" is enforced by
   * the UNIQUE constraint on createdById plus the deleteMany call
   * after create. A concurrent double-submit from the client hits
   * the second call's delete as a no-op, and would attempt a second
   * Applicant insert — which is caught by the service's duplicate
   * email check. So double-click is safe.
   */
  async submitMine(
    user: { id: string; role: string; agencyId?: string; agencyIsSystem?: boolean },
    dto: SubmitDraftDto,
  ) {
    // 1. Persist the latest formData so a later retry doesn't lose work.
    await this.saveMine(user.id, { formData: dto.applicationData, jobAdId: (dto as any).jobAdId });

    // 2. Hand off to the existing Applicant creation path (enforces
    //    every tenancy / approval / duplicate rule already in the service).
    const { applicationData: _ignore, ...createPayload } = dto as any;
    const applicant = await this.applicants.create(
      { ...createPayload, applicationData: dto.applicationData } as any,
      user.id,
      { role: user.role, agencyId: user.agencyId, agencyIsSystem: user.agencyIsSystem },
    );

    // 3. Clear the draft. deleteMany is tolerant if a concurrent call
    //    already removed it.
    await (this.prisma as any).applicationDraft.deleteMany({
      where: { createdById: user.id },
    });

    return applicant;
  }

  /** Block the "New Application" entry point while a draft is open. */
  async assertNoDraft(userId: string) {
    const existing = await this.getMine(userId);
    if (existing) {
      throw new ConflictException(
        'You already have an unsubmitted application draft. Finish or discard it before starting a new one.',
      );
    }
  }

  /** Convenience for the controller `GET mine/required` probe. */
  async requireMine(userId: string) {
    const draft = await this.getMine(userId);
    if (!draft) throw new NotFoundException('No open draft');
    return draft;
  }
}
