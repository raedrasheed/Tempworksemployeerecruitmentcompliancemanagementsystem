import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Phase 3.6 — PlatformAdmin dual-read access helper.
 *
 * Returns true if a user is a platform admin via either signal:
 *   - legacy: `user.agency.isSystem === true`
 *   - new:    a `PlatformAdmin` row exists for the user
 *
 * OR semantics — when both signals agree, behaviour is identical to
 * the legacy path. When PlatformAdmin has been backfilled (Phase 3.5),
 * a row may grant access to a user whose agency is no longer
 * `isSystem` (e.g. agency reorganisation). This is the intended
 * transition behaviour.
 *
 * `PLATFORM_ADMIN_DUAL_READ_ENABLED=false` reverts to legacy-only
 * (legacy path is checked, PlatformAdmin is ignored). Default true.
 *
 * Read-only. Never mutates data. Never writes PlatformAuditLog
 * (table not present — deferred).
 *
 * @tenant-reviewed: phase360-platform-admin-dual-read
 */
@Injectable()
export class PlatformAdminAccessService {
  // Read the flag at construction so behaviour is stable across a request
  // (matches the rest of the SaaS feature-flag pattern in this codebase).
  private readonly dualReadEnabled = process.env.PLATFORM_ADMIN_DUAL_READ_ENABLED !== 'false';

  constructor(private readonly prisma: PrismaService) {}

  /** Returns true iff the user has platform-admin authority via legacy OR new signal. */
  async isPlatformAdmin(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;

    const user = await this.prisma.user.findFirst({ // @tenant-reviewed: phase360-platform-admin-dual-read
      where: { id: userId, deletedAt: null, status: 'ACTIVE' as any },
      select: { id: true, agency: { select: { isSystem: true } } },
    });
    if (!user) return false;

    // Legacy signal — always honoured.
    if (user.agency?.isSystem === true) return true;

    // New signal — gated by the dual-read flag. When OFF, behave as
    // legacy-only.
    if (!this.dualReadEnabled) return false;

    const pa = await (this.prisma as any).platformAdmin.findUnique({ // @tenant-reviewed: phase360-platform-admin-dual-read
      where: { userId: user.id },
      select: { level: true },
    });
    if (!pa) return false;
    // Allowed levels — all three are platform-level today; the runtime
    // guard in `platform-admin.guard.ts` enforces level ordering for
    // specific routes. Here we only answer the binary "is platform admin".
    return ['SUPPORT', 'OPERATOR', 'SUPER'].includes(pa.level);
  }

  /** Optional ergonomic helper. */
  async assertPlatformAdmin(userId: string | null | undefined): Promise<void> {
    if (!(await this.isPlatformAdmin(userId))) {
      throw new Error('PLATFORM_ADMIN_REQUIRED');
    }
  }
}
