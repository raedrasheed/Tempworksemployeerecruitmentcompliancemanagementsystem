import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../logs/audit-log.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditLog: AuditLogService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { role: true },
    });
    if (!user) return null;
    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') return null;
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return null;
    return user;
  }

  async login(loginDto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: loginDto.email, deletedAt: null },
      include: { role: true },
    });

    if (!user) {
      // Log failed attempt for unknown email
      await this.auditLog.log({
        userEmail: loginDto.email,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: 'unknown',
        changes: { reason: 'User not found' },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      await this.auditLog.log({
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        changes: { reason: 'Account not active', status: user.status },
        ipAddress,
      });
      throw new UnauthorizedException('Account is not active');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.auditLog.log({
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        changes: { reason: 'Invalid password' },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role.name);

    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refreshTokenHash, lastLoginAt: new Date() },
    });

    await this.auditLog.log({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        agencyId: user.agencyId,
      },
    };
  }

  async logout(userId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    await this.auditLog.log({
      userId,
      userEmail: user?.email,
      action: 'LOGOUT',
      entity: 'User',
      entityId: userId,
      ipAddress,
    });
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { role: true },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenMatches) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role.name);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refreshTokenHash },
    });

    return tokens;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      await this.auditLog.log({
        userId,
        userEmail: user.email,
        action: 'CHANGE_PASSWORD_FAILED',
        entity: 'User',
        entityId: userId,
        changes: { reason: 'Current password incorrect' },
        ipAddress,
      });
      throw new BadRequestException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await this.auditLog.log({
      userId,
      userEmail: user.email,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: userId,
      ipAddress,
    });

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (user) {
      await this.auditLog.log({
        userId: user.id,
        userEmail: user.email,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'User',
        entityId: user.id,
      });
    }
    return { message: 'If that email exists, a reset link has been sent' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { role: { include: { permissions: { include: { permission: true } } } }, agency: true },
    });
    if (!user) throw new UnauthorizedException();

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role.name,
      roleId: user.roleId,
      agencyId: user.agencyId,
      agency: user.agency ? { id: user.agency.id, name: user.agency.name } : null,
      permissions: user.role.permissions.map((rp) => rp.permission.name),
      status: user.status,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET || 'default-secret-change-in-prod',
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-prod',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
