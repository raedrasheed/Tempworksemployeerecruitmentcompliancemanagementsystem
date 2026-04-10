import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../logs/audit-log.service';
import { EmailService } from '../email/email.service';

// ---------------------------------------------------------------------------
// Date helpers (plain JS — no date-fns dependency required)
// ---------------------------------------------------------------------------
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private auditLog: AuditLogService,
    private emailService: EmailService,
  ) {}

  // ---------------------------------------------------------------------------
  // Validate user (used by local strategy if needed)
  // ---------------------------------------------------------------------------
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), deletedAt: null },
      include: { role: true },
    });
    if (!user) return null;
    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') return null;
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return null;
    return user;
  }

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------
  async login(
    loginDto: { agencyId?: string; email: string; password: string },
    ipAddress?: string,
  ) {
    const normalizedEmail = loginDto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      include: { role: true, agency: { select: { id: true, name: true } } },
    });

    if (!user) {
      await this.auditLog.log({
        userEmail: normalizedEmail,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: 'unknown',
        changes: { reason: 'User not found' },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Agency scope check — return generic error to prevent enumeration
    if (loginDto.agencyId && user.agencyId !== loginDto.agencyId) {
      await this.auditLog.log({
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        changes: { reason: 'Agency mismatch' },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check lockout
    if (user.lockedAt) {
      const lockoutDurationMs = 30 * 60 * 1000; // 30 minutes
      const unlockTime = new Date(user.lockedAt.getTime() + lockoutDurationMs);
      if (new Date() < unlockTime) {
        throw new UnauthorizedException(
          'Account is temporarily locked. Please try again later.',
        );
      }
      // Lockout period has passed — clear the lock
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lockedAt: null, failedLoginAttempts: 0 },
      });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      const maxAttempts = await this.getSystemSettingNumber('MAX_LOGIN_ATTEMPTS', 3);
      const newFailedCount = (user.failedLoginAttempts ?? 0) + 1;

      const updateData: any = { failedLoginAttempts: newFailedCount };

      if (newFailedCount >= maxAttempts) {
        updateData.lockedAt = new Date();
        // Fire-and-forget email — never block login flow
        this.emailService
          .sendAccountLockedEmail(user.email, `${user.firstName} ${user.lastName}`)
          .catch(() => undefined);
        await this.auditLog.log({
          userId: user.id,
          userEmail: user.email,
          action: 'ACCOUNT_LOCKED',
          entity: 'User',
          entityId: user.id,
          changes: { failedLoginAttempts: newFailedCount },
          ipAddress,
        });
      }

      await this.prisma.user.update({ where: { id: user.id }, data: updateData });

      await this.auditLog.log({
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        changes: { reason: 'Invalid password', attempt: newFailedCount },
        ipAddress,
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Password correct — reset failure counters
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedAt: null },
    });

    // Status checks (after password validation to avoid status enumeration via timing)
    switch (user.status) {
      case 'PENDING':
        throw new UnauthorizedException(
          'Account not yet activated. Please check your email.',
        );
      case 'INACTIVE':
        throw new UnauthorizedException(
          'Account is inactive. Please contact your administrator.',
        );
      case 'SUSPENDED':
        throw new UnauthorizedException(
          'Account is suspended. Please contact your administrator.',
        );
      case 'TERMINATED':
        throw new UnauthorizedException('Account has been terminated.');
    }

    // Password expiry check
    let passwordExpired = false;
    if (user.passwordExpiresAt && user.passwordExpiresAt < new Date()) {
      passwordExpired = true;
    }

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditLog.log({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress,
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role.name);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refreshTokenHash },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      passwordExpired,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        agencyId: user.agencyId,
        agency: user.agency ?? null,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  async logout(userId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
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

  // ---------------------------------------------------------------------------
  // Refresh tokens
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Change password
  // ---------------------------------------------------------------------------
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
  ) {
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

    this.validatePasswordStrength(newPassword);

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        passwordExpiresAt: addDays(new Date(), 30),
      },
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

  // ---------------------------------------------------------------------------
  // Get current user profile
  // ---------------------------------------------------------------------------
  async getMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        agency: true,
      },
    });
    if (!user) throw new UnauthorizedException();

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      photoUrl: (user as any).photoUrl ?? null,
      role: user.role.name,
      roleId: user.roleId,
      agencyId: user.agencyId,
      agency: user.agency ? { id: user.agency.id, name: user.agency.name } : null,
      permissions: user.role.permissions.map((rp) => rp.permission.name),
      status: user.status,
      lastLoginAt: user.lastLoginAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Activate account (from email link)
  // ---------------------------------------------------------------------------
  async activateAccount(
    token: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const activationToken = await this.prisma.activationToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { include: { role: true } },
      },
    });

    if (!activationToken) {
      throw new BadRequestException('Activation link is invalid or has expired');
    }

    this.validatePasswordStrength(password);

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    await this.prisma.user.update({
      where: { id: activationToken.userId },
      data: {
        status: 'ACTIVE',
        passwordHash,
        passwordChangedAt: now,
        passwordExpiresAt: addDays(now, 30),
      },
    });

    await this.prisma.activationToken.update({
      where: { id: activationToken.id },
      data: { usedAt: now },
    });

    await this.auditLog.log({
      userId: activationToken.userId,
      userEmail: activationToken.user.email,
      action: 'ACCOUNT_ACTIVATED',
      entity: 'User',
      entityId: activationToken.userId,
    });

    // Send welcome email (fire-and-forget)
    this.emailService
      .sendWelcomeEmail(
        activationToken.user.email,
        `${activationToken.user.firstName} ${activationToken.user.lastName}`,
      )
      .catch(() => undefined);

    const tokens = await this.generateTokens(
      activationToken.user.id,
      activationToken.user.email,
      activationToken.user.role.name,
    );
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: activationToken.userId },
      data: { refreshToken: refreshTokenHash, lastLoginAt: new Date() },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: activationToken.user.id,
        email: activationToken.user.email,
        firstName: activationToken.user.firstName,
        lastName: activationToken.user.lastName,
        role: activationToken.user.role.name,
        agencyId: activationToken.user.agencyId,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Forgot password (user-initiated)
  // ---------------------------------------------------------------------------
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), deletedAt: null },
    });

    if (user && user.status === 'ACTIVE') {
      const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

      // Invalidate existing unused USER_INITIATED tokens
      await this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, type: 'USER_INITIATED', usedAt: null },
        data: { usedAt: new Date() },
      });

      const token = crypto.randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          type: 'USER_INITIATED',
          expiresAt: addMinutes(new Date(), 60),
        },
      });

      this.emailService
        .sendPasswordResetEmail(
          user.email,
          `${user.firstName} ${user.lastName}`,
          token,
          frontendUrl,
          false,
        )
        .catch(() => undefined);

      await this.auditLog.log({
        userId: user.id,
        userEmail: user.email,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'User',
        entityId: user.id,
      });
    }

    // Always return void — no enumeration
  }

  // ---------------------------------------------------------------------------
  // Admin-initiated password reset
  // ---------------------------------------------------------------------------
  async adminResetPassword(userId: string, actorId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    // Invalidate existing unused ADMIN_INITIATED tokens
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, type: 'ADMIN_INITIATED', usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        type: 'ADMIN_INITIATED',
        expiresAt: addMinutes(new Date(), 60),
      },
    });

    this.emailService
      .sendPasswordResetEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        token,
        frontendUrl,
        true,
      )
      .catch(() => undefined);

    await this.auditLog.log({
      userId: actorId,
      userEmail: user.email,
      action: 'PASSWORD_RESET_TRIGGERED_BY_ADMIN',
      entity: 'User',
      entityId: userId,
      changes: { targetUserId: userId },
    });
  }

  // ---------------------------------------------------------------------------
  // Reset password (apply new password from token)
  // ---------------------------------------------------------------------------
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    this.validatePasswordStrength(newPassword);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();

    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        passwordExpiresAt: addDays(now, 30),
        refreshToken: null, // invalidate all active sessions
      },
    });

    // Mark used
    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: now },
    });

    // Invalidate any other unused tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: now },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: resetToken.userId },
      select: { email: true },
    });

    await this.auditLog.log({
      userId: resetToken.userId,
      userEmail: user?.email,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: resetToken.userId,
    });
  }

  // ---------------------------------------------------------------------------
  // Resend activation email
  // ---------------------------------------------------------------------------
  async resendActivation(userId: string, actorId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.status !== 'PENDING' && user.status !== 'INACTIVE') {
      throw new BadRequestException(
        'Activation email can only be resent for PENDING or INACTIVE accounts',
      );
    }

    // Invalidate existing unused activation tokens
    await this.prisma.activationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = await this.generateUserActivationToken(userId);
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    this.emailService
      .sendActivationEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        token,
        frontendUrl,
      )
      .catch(() => undefined);

    await this.auditLog.log({
      userId: actorId,
      userEmail: user.email,
      action: 'ACTIVATION_EMAIL_RESENT',
      entity: 'User',
      entityId: userId,
      changes: { targetUserId: userId },
    });
  }

  // ---------------------------------------------------------------------------
  // Helper: generate activation token and persist it
  // ---------------------------------------------------------------------------
  async generateUserActivationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.activationToken.create({
      data: {
        userId,
        token,
        expiresAt: addMinutes(new Date(), 60),
      },
    });
    return token;
  }

  // ---------------------------------------------------------------------------
  // Password strength validation
  // ---------------------------------------------------------------------------
  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new BadRequestException('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('Password must contain at least one digit');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]/.test(password)) {
      throw new BadRequestException(
        "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;':\",./<>?)",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: read numeric system setting with default
  // ---------------------------------------------------------------------------
  private async getSystemSettingNumber(key: string, defaultValue: number): Promise<number> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
      if (setting) {
        const parsed = parseInt(setting.value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
      }
    } catch {
      // fall through to default
    }
    return defaultValue;
  }

  // ---------------------------------------------------------------------------
  // Token generation
  // ---------------------------------------------------------------------------
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
