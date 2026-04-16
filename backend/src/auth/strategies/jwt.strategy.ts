import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
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
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.status !== 'ACTIVE') {
      // Any non-ACTIVE status (INACTIVE, SUSPENDED, PENDING, TERMINATED)
      // immediately terminates the session — no need to wait for next login.
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      roleId: user.roleId,
      agencyId: user.agencyId,
    };
  }
}
