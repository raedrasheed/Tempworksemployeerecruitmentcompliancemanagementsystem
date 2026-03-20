import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: loginDto.email, deletedAt: null },
      include: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is not active');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role.name);

    // Store refresh token hash
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refreshTokenHash, lastLoginAt: new Date() },
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

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
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

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email: string) {
    // In production, send reset email. For now return success message
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    // Always return success to prevent email enumeration
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
