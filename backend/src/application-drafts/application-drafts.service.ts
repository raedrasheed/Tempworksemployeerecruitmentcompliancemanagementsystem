import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicantsService } from '../applicants/applicants.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { SubmitDraftDto } from './dto/submit-draft.dto';

interface DraftDoc {
  id: string;
  name: string;
  typeName: string;
  /** Slot key on the form (e.g. 'required:Passport', 'euVisa'). The
   *  front-end uses it to re-seat the saved file into the correct
   *  slot on resume. */
  sectionKey?: string;
  url: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

/**
 * Save-for-later drafts on the applicant creation form.
 *
 * Invariants:
 *  • Exactly one draft per user — enforced by a UNIQUE constraint on
 *    application_drafts.createdById.
 *  • No Applicant row exists while a draft is open. The Lead is
 *    created only by submitMine(), which then deletes the draft.
 *  • Uploaded photo + supporting documents are persisted against the
 *    draft row so they survive across sessions. They're copied onto
 *    the Applicant when the draft is submitted, and wiped (files +
 *    row) when the draft is discarded.
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
    const draft = await this.getMine(userId);
    if (!draft) return { message: 'No draft to discard' };
    // Best-effort cleanup of files under the draft folder — failures
    // should never break the DELETE, so we swallow filesystem errors.
    await this.purgeDraftFiles(draft.id).catch(() => {});
    await (this.prisma as any).applicationDraft.deleteMany({
      where: { id: draft.id },
    });
    return { message: 'Draft discarded' };
  }

  /**
   * Upsert an open draft for this user and return it. Used by the
   * photo + document upload endpoints: they need a draft row to
   * attach files to, but the user may not have explicitly saved yet.
   */
  private async ensureDraft(userId: string) {
    const existing = await this.getMine(userId);
    if (existing) return existing;
    // Only pass required columns — formData and documents have
    // defaults in the schema, so omitting them keeps this resilient
    // against a Prisma client that was generated before those fields
    // were added (defaults still apply at the DB level).
    return (this.prisma as any).applicationDraft.create({
      data: { createdById: userId },
    });
  }

  /** Write an uploaded photo to /uploads/drafts/<draftId>/photo/<file>
   *  and persist its URL on the draft. Overwrites any previous photo. */
  async uploadPhoto(userId: string, file: Express.Multer.File) {
    const draft = await this.ensureDraft(userId);
    const folder = `drafts/${draft.id}/photo`;
    const absDir = join(file.destination, 'drafts', draft.id, 'photo');
    await fs.mkdir(absDir, { recursive: true });
    const filename = `photo_${Date.now()}${extname(file.originalname)}`;
    await fs.rename(file.path, join(absDir, filename));
    const photoUrl = `/uploads/${folder}/${filename}`;
    return (this.prisma as any).applicationDraft.update({
      where: { id: draft.id },
      data: { photoUrl },
    });
  }

  async deletePhoto(userId: string) {
    const draft = await this.getMine(userId);
    if (!draft) throw new NotFoundException('No open draft');
    if (!draft.photoUrl) return draft;
    // Silent filesystem cleanup; DB state is the source of truth.
    await this.unlinkByPublicUrl(draft.photoUrl).catch(() => {});
    return (this.prisma as any).applicationDraft.update({
      where: { id: draft.id },
      data: { photoUrl: null },
    });
  }

  /** Upload a supporting document under /uploads/drafts/<draftId>/docs.
   *  Appends an entry to draft.documents. Returns the updated draft. */
  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    name: string,
    typeName: string,
    sectionKey?: string,
  ) {
    const draft = await this.ensureDraft(userId);
    const absDir = join(file.destination, 'drafts', draft.id, 'docs');
    await fs.mkdir(absDir, { recursive: true });
    const id = randomUUID();
    const filename = `${id}${extname(file.originalname)}`;
    await fs.rename(file.path, join(absDir, filename));
    const url = `/uploads/drafts/${draft.id}/docs/${filename}`;
    const entry: DraftDoc = {
      id,
      name: name || file.originalname,
      typeName: typeName || 'Other',
      sectionKey,
      url,
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    };
    // If the caller uploads into a slot they already used, replace
    // the previous entry rather than stacking duplicates.
    const current: DraftDoc[] = Array.isArray(draft.documents) ? draft.documents : [];
    const kept = sectionKey
      ? current.filter(d => d.sectionKey !== sectionKey)
      : current;
    if (sectionKey) {
      const replaced = current.find(d => d.sectionKey === sectionKey);
      if (replaced) await this.unlinkByPublicUrl(replaced.url).catch(() => {});
    }
    return (this.prisma as any).applicationDraft.update({
      where: { id: draft.id },
      data: { documents: [...kept, entry] as any },
    });
  }

  async deleteDocument(userId: string, docId: string) {
    const draft = await this.getMine(userId);
    if (!draft) throw new NotFoundException('No open draft');
    const current: DraftDoc[] = Array.isArray(draft.documents) ? draft.documents : [];
    const target = current.find(d => d.id === docId);
    if (!target) throw new NotFoundException('Document not found on draft');
    await this.unlinkByPublicUrl(target.url).catch(() => {});
    return (this.prisma as any).applicationDraft.update({
      where: { id: draft.id },
      data: { documents: current.filter(d => d.id !== docId) as any },
    });
  }

  /**
   * Final submit. Persists the latest snapshot, creates the Applicant
   * via the shared service, transfers photo + documents onto the new
   * record, then deletes the draft row and its upload folder.
   */
  async submitMine(
    user: { id: string; role: string; agencyId?: string; agencyIsSystem?: boolean },
    dto: SubmitDraftDto,
  ) {
    await this.saveMine(user.id, { formData: dto.applicationData, jobAdId: (dto as any).jobAdId });
    const draft = await this.getMine(user.id);

    const { applicationData: _ignore, ...createPayload } = dto as any;
    const applicant = await this.applicants.create(
      { ...createPayload, applicationData: dto.applicationData } as any,
      user.id,
      { role: user.role, agencyId: user.agencyId, agencyIsSystem: user.agencyIsSystem },
    );

    if (draft) {
      // Carry forward the photo onto the applicant row.
      if (draft.photoUrl) {
        try {
          await (this.prisma as any).applicant.update({
            where: { id: applicant.id },
            data: { photoUrl: draft.photoUrl },
          });
          (applicant as any).photoUrl = draft.photoUrl;
        } catch { /* leave on draft folder — best effort */ }
      }

      // Materialise each draft-uploaded file as a Document row pointing
      // at the draft's file URL. The Document model is the same one the
      // rest of the system uses, so the applicant's profile surfaces
      // these immediately without a re-upload step. Resolve a
      // DocumentType by name — falling back to an "Other" type so the
      // insert never fails on a typo.
      const docs: DraftDoc[] = Array.isArray(draft.documents) ? draft.documents : [];
      if (docs.length > 0) {
        const fallback = await (this.prisma as any).documentType.findFirst({
          where: { OR: [{ name: 'Other' }, { name: { equals: 'Other', mode: 'insensitive' } }] },
        });
        for (const d of docs) {
          try {
            let docType = await (this.prisma as any).documentType.findFirst({
              where: { name: { equals: d.typeName, mode: 'insensitive' } },
            });
            if (!docType) docType = fallback;
            if (!docType) continue; // no type at all — skip rather than fail
            await (this.prisma as any).document.create({
              data: {
                name: d.name,
                documentTypeId: docType.id,
                entityType: 'APPLICANT',
                entityId: applicant.id,
                fileUrl: d.url,
                mimeType: d.mimeType ?? 'application/octet-stream',
                fileSize: d.fileSize ?? 0,
                status: 'PENDING',
                uploadedById: user.id,
              },
            });
          } catch { /* best-effort; keep going on one bad row */ }
        }
      }

      // Drop the draft row. The files stay on disk (now referenced by
      // the Applicant / Documents). An orphan draft row can't exist
      // with the Applicant created, so we don't worry about retry here.
      await (this.prisma as any).applicationDraft.deleteMany({
        where: { createdById: user.id },
      });
    }

    return applicant;
  }

  /** Convenience for the controller `GET mine/required` probe. */
  async requireMine(userId: string) {
    const draft = await this.getMine(userId);
    if (!draft) throw new NotFoundException('No open draft');
    return draft;
  }

  // ── Filesystem helpers ────────────────────────────────────────────
  private uploadsRoot() {
    return process.env.UPLOAD_DEST || './uploads';
  }

  private async purgeDraftFiles(draftId: string) {
    const root = this.uploadsRoot();
    await fs.rm(join(root, 'drafts', draftId), { recursive: true, force: true });
  }

  private async unlinkByPublicUrl(publicUrl: string) {
    // Public URL format is `/uploads/<rest>` — map it back to disk.
    if (!publicUrl.startsWith('/uploads/')) return;
    const rel = publicUrl.slice('/uploads/'.length);
    await fs.unlink(join(this.uploadsRoot(), rel)).catch(() => {});
  }
}
