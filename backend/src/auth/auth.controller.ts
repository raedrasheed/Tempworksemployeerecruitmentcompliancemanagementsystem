import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Param,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
  ) {}

  // ---------------------------------------------------------------------------
  // Login — now accepts optional agencyId
  // ---------------------------------------------------------------------------
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns JWT tokens and user info' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() loginDto: LoginDto & { agencyId?: string }, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    return this.authService.login(loginDto, ip);
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current user' })
  logout(@CurrentUser('id') userId: string, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    return this.authService.logout(userId, ip);
  }

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    const decoded = this.jwtService.decode(dto.refreshToken) as any;
    if (!decoded?.sub) throw new UnauthorizedException('Invalid refresh token');
    return this.authService.refreshTokens(decoded.sub, dto.refreshToken);
  }

  // ---------------------------------------------------------------------------
  // Get current user
  // ---------------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  // ---------------------------------------------------------------------------
  // Change password
  // ---------------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: any,
  ) {
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword, ip);
  }

  // ---------------------------------------------------------------------------
  // Activate account
  // ---------------------------------------------------------------------------
  @Public()
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate account using email token and set password' })
  @ApiResponse({ status: 200, description: 'Account activated, returns JWT tokens' })
  @ApiResponse({ status: 400, description: 'Invalid or expired activation token' })
  activateAccount(@Body() dto: { token: string; password: string }) {
    return this.authService.activateAccount(dto.token, dto.password);
  }

  // ---------------------------------------------------------------------------
  // Forgot password (user-initiated)
  // ---------------------------------------------------------------------------
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ---------------------------------------------------------------------------
  // Reset password (apply new password from token)
  // ---------------------------------------------------------------------------
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using email token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  resetPassword(@Body() dto: { token: string; newPassword: string }) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // ---------------------------------------------------------------------------
  // Admin: trigger password reset for a specific user
  // ---------------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post('admin/reset-password/:userId')
  @HttpCode(HttpStatus.OK)
  @Roles('System Admin', 'HR Manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-initiated password reset for a user' })
  async adminResetPassword(
    @Param('userId') userId: string,
    @CurrentUser('id') actorId: string,
  ) {
    await this.authService.adminResetPassword(userId, actorId);
    return { message: 'Password reset email sent successfully' };
  }

  // ---------------------------------------------------------------------------
  // Admin: resend activation email to a user
  // ---------------------------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post('resend-activation/:userId')
  @HttpCode(HttpStatus.OK)
  @Roles('System Admin', 'HR Manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend activation email to a PENDING/INACTIVE user' })
  async resendActivation(
    @Param('userId') userId: string,
    @CurrentUser('id') actorId: string,
  ) {
    await this.authService.resendActivation(userId, actorId);
    return { message: 'Activation email resent successfully' };
  }
}
