import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Phase 3.8 — PlatformAdmin authoritative resolver.
 *
 * Default behaviour: PlatformAdmin row is the SOLE source of platform
 * authority. `Agency.isSystem` is read only when the legacy fallback
 * flag is explicitly enabled.
 *
 * Flag precedence (highest first):
 *   - PLATFORM_ADMIN_DUAL_READ_ENABLED=false
 *       → pre-Phase-3.6 emulation: only Agency.isSystem grants access.
 *         Reserved for emergency rollback after Phase 3.5 backfill
 *         issues that block PlatformAdmin reads.
 *   - PLATFORM_ADMIN_LEGACY_AGENCY_FALLBACK=true
 *       → OR semantics: PlatformAdmin row OR Agency.isSystem grants.
 *         This is the Phase 3.6/3.7 default behaviour, retained for
 *         emergency rollback without redeploying.
 *   - otherwise (Phase 3.8 default)
 *       → PlatformAdmin row only. `Agency.isSystem` is ignored for
 *         authorization. The column remains in the schema for Phase 3.9
 *         destructive drop.
 *
 * Read-only. No data mutation. No PlatformAuditLog writes (table
 * absent; deferred). Inactive/deleted users always resolve to false.
 *
 * @tenant-reviewed: phase380-platform-admin-runtime-retirement
 */
@Injectable()
export class PlatformAdminAccessService {
  // Flags captured at construction time for stable per-request behaviour.
  private readonly dualReadEnabled = process.env.PLATFORM_ADMIN_DUAL_READ_ENABLED !== 'false';
  private readonly legacyFallback  = process.env.PLATFORM_ADMIN_LEGACY_AGENCY_FALLBACK === 'true';

  constructor(private readonly prisma: PrismaService) {}

  /** Returns true iff the user is a platform admin per the precedence above. */
  async isPlatformAdmin(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;

    // We need active-user gating plus optional agency lookup for the
    // fallback branches. A single findFirst with `select` keeps it cheap.
    const user = await this.prisma.user.findFirst({ // @tenant-reviewed: phase380-platform-admin-runtime-retirement
      where: { id: userId, deletedAt: null, status: 'ACTIVE' as any },
      select: { id: true, agency: { select: { isSystem: true } } },
    });
    if (!user) return false;

    // Pre-3.6 emulation — legacy-only.
    if (!this.dualReadEnabled) {
      return user.agency?.isSystem === true; // @tenant-reviewed: phase380-agency-is-system-fallback
    }

    // Phase 3.8 default: PlatformAdmin is the authoritative source.
    const pa = await (this.prisma as any).platformAdmin.findUnique({ // @tenant-reviewed: phase380-platform-admin-runtime-retirement
      where: { userId: user.id },
      select: { level: true },
    });
    if (pa && ['SUPPORT', 'OPERATOR', 'SUPER'].includes(pa.level)) return true;

    // Optional emergency OR fallback — reverts to Phase 3.6/3.7 semantics
    // without code changes.
    if (this.legacyFallback && user.agency?.isSystem === true) {
      return true; // @tenant-reviewed: phase380-agency-is-system-fallback
    }

    return false;
  }

  /** Optional ergonomic helper. */
  async assertPlatformAdmin(userId: string | null | undefined): Promise<void> {
    if (!(await this.isPlatformAdmin(userId))) {
      throw new Error('PLATFORM_ADMIN_REQUIRED');
    }
  }
}
