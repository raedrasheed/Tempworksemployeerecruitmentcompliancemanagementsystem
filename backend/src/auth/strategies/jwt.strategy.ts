import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAdminAccessService } from '../../saas/platform-admin/platform-admin-access.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
    // Phase 3.7 — dual-read source for `agencyIsSystem`. The injected
    // helper OR-combines legacy `Agency.isSystem` with the new
    // `PlatformAdmin` row (when PLATFORM_ADMIN_DUAL_READ_ENABLED !== 'false').
    // Tag: phase370-platform-admin-jwt-dual-read
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
        agency: { select: { isSystem: true } },
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
    // Phase 3.7 — dual-read stamp. `agencyIsSystem` now means
    // "platform admin via legacy Agency.isSystem OR backfilled
    // PlatformAdmin row" when the dual-read flag is on. Downstream
    // service-layer consumers (`actor.agencyIsSystem`) require no
    // signature change. Setting the flag to 'false' restores the
    // legacy meaning. @tenant-reviewed: phase370-platform-admin-jwt-dual-read
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
    };
  }
}
