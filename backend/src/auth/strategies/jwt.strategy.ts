import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAdminAccessService } from '../../saas/platform-admin/platform-admin-access.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
    // Phase 3.7/3.9 — authority resolver for `agencyIsSystem`. As of
    // Phase 3.9 the legacy `Agency.isSystem` column is removed and the
    // service answers exclusively from `PlatformAdmin`.
    // Tag: phase390-platform-admin-only-authority
    private platformAdminAccess: PlatformAdminAccessService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default-secret-change-in-prod',
    });
  }

  async validate(payload: any) {
    // Use an explicit select instead of SELECT * so a Prisma-generated
    // field that doesn't exist in the database yet (e.g. a column added
    // by a pending migration) can't take every authenticated request
    // down with a 500.
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        roleId: true,
        agencyId: true,
        role: { select: { name: true } },
        // Phase 3.9 — Agency.isSystem column removed; no longer selected here.
      },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'AUTH.USER_NOT_FOUND', message: 'User not found' });
    }
    if (user.status !== 'ACTIVE') {
      // Any non-ACTIVE status (INACTIVE, SUSPENDED, PENDING, TERMINATED)
      // immediately terminates the session — no need to wait for next login.
      throw new UnauthorizedException({
        code: 'AUTH.ACCOUNT_STATUS',
        message: `Account is ${user.status.toLowerCase()}`,
        params: { status: user.status.toLowerCase() },
      });
    }
    // Phase 3.9 — `agencyIsSystem` means "platform admin per
    // PlatformAdmin row". The field name is preserved for downstream
    // compatibility; the column it once derived from has been dropped.
    // @tenant-reviewed: phase390-platform-admin-only-authority
    const agencyIsSystem = await this.platformAdminAccess.isPlatformAdmin(user.id);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      roleId: user.roleId,
      agencyId: user.agencyId,
      agencyIsSystem,
      // Phase 3.17 — active tenant + membership stamped at login or
      // tenant-switch time. Undefined on legacy tokens issued before
      // 3.17 (single-tenant fallback still works).
      // @tenant-reviewed: phase317-multi-tenant-login
      tenantId:     payload?.tenantId,
      membershipId: payload?.membershipId,
    };
  }
}
