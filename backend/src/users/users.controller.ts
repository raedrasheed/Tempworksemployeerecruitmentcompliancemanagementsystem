import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // ── Bulk operations (must be defined before :id routes) ─────────────────────

  @Post('bulk-import')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Bulk import users from CSV records' })
  bulkImport(@Body() dto: { records: any[] }, @CurrentUser('id') actorId: string) {
    return this.usersService.bulkImport(dto.records, actorId);
  }

  @Get('bulk-export')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Bulk export users (no pagination)' })
  bulkExport(@Query() query: any, @CurrentUser() caller: any) {
    return this.usersService.bulkExport(query, caller?.role, caller?.agencyId);
  }

  // ── Self-update routes (must be before :id) ──────────────────────────────────

  @Get('me')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() caller: any) {
    // Pass the caller's own role + agency so the agency-scoping and
    // "hide System Admin from non-admins" checks in findOne don't reject
    // a user looking at their own profile.
    return this.usersService.findOne(caller.id, caller.role, caller.agencyId);
  }

  @Patch('profile')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Update own profile (restricted fields only)' })
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto, userId);
  }

  @Patch('preferences')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Update own preferences (language, timezone, notifications)' })
  updatePreferences(@CurrentUser('id') userId: string, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(userId, dto, userId);
  }

  // Legacy self-profile update route (kept for backward compatibility)
  @Patch('me/profile')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Update current user profile (legacy route)' })
  updateMeProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto, userId);
  }

  // ── List ──────────────────────────────────────────────────────────────────────

  @Get()
  @Roles('System Admin', 'HR Manager', 'Read Only', 'Agency Manager')
  @ApiOperation({ summary: 'List users (Agency Manager sees only own-agency users)' })
  @ApiQuery({ name: 'roleId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Query() query: PaginationDto & { roleId?: string; status?: string }, @CurrentUser() caller: any) {
    return this.usersService.findAll(query, caller?.role, caller?.agencyId, caller?.agencyIsSystem);
  }

  // ── Single user ───────────────────────────────────────────────────────────────

  @Get(':id')
  @Roles('System Admin', 'HR Manager', 'Agency Manager')
  @ApiOperation({ summary: 'Get user by ID (Agency Manager limited to own-agency users)' })
  findOne(@Param('id') id: string, @CurrentUser() caller: any) {
    return this.usersService.findOne(id, caller?.role, caller?.agencyId);
  }

  @Post()
  @Roles('System Admin', 'Agency Manager')
  @ApiOperation({ summary: 'Create new user (Agency Manager scoped to own agency with max-users limit)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  create(@Body() dto: CreateUserDto, @CurrentUser() caller: any) {
    return this.usersService.create(dto, caller?.role, caller?.agencyId, caller?.id);
  }

  @Patch(':id')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Update user (admin-only fields enforced by role)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() caller: any) {
    return this.usersService.update(id, dto, caller?.role, caller?.id, caller?.agencyIsSystem);
  }

  @Delete(':id')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() caller: any) {
    return this.usersService.remove(id, caller?.role, caller?.id, caller?.agencyIsSystem);
  }

  // ── Photo upload ──────────────────────────────────────────────────────────────

  // Any logged-in user can upload their own photo
  @Post('me/photo')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Upload own profile photo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'avatars');
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `avatar-${unique}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Only image files are allowed'), false);
      cb(null, true);
    },
  }))
  async uploadOwnPhoto(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') actorId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const photoUrl = `/uploads/avatars/${file.filename}`;
    return this.usersService.uploadPhoto(actorId, photoUrl, actorId);
  }

  // Admin/HR can upload photo for any user
  @Post(':id/photo')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Upload user profile photo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'avatars');
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `avatar-${unique}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Only image files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') actorId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const photoUrl = `/uploads/avatars/${file.filename}`;
    return this.usersService.uploadPhoto(id, photoUrl, actorId);
  }

  // ── Unlock user ───────────────────────────────────────────────────────────────

  @Post(':id/unlock')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Unlock a locked user account' })
  unlockUser(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.usersService.unlockUser(id, actorId);
  }

  // ── Agency user approval + manager override (admin only) ────────────────────

  @Post(':id/approve')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Approve an agency-created user so they enter operational status' })
  approveAgencyUser(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.usersService.approveAgencyUser(id, actorId);
  }

  @Post(':id/manager-override')
  @Roles('System Admin')
  @ApiOperation({
    summary:
      'Grant or revoke the owning Agency Manager\'s ability to edit/delete an approved user. ' +
      'System Admin only. Body: { allowManagerEdit?: boolean, allowManagerDelete?: boolean }',
  })
  setManagerOverride(
    @Param('id') id: string,
    @Body() dto: { allowManagerEdit?: boolean; allowManagerDelete?: boolean },
    @CurrentUser('id') actorId: string,
  ) {
    return this.usersService.setManagerOverride(id, dto ?? {}, actorId);
  }

  // ── Activation link (for PENDING users without SMTP) ─────────────────────────

  @Get(':id/activation-link')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Generate a fresh activation link for a PENDING/INACTIVE user' })
  getActivationLink(@Param('id') id: string) {
    return this.usersService.getActivationLink(id);
  }

  // ── Permission overrides ──────────────────────────────────────────────────────

  @Get(':id/permissions')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Get user role permissions + overrides' })
  getUserPermissions(@Param('id') id: string) {
    return this.usersService.getUserPermissions(id);
  }

  @Post(':id/permissions')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Grant or revoke a permission override for a user' })
  setPermission(
    @Param('id') id: string,
    @Body() dto: { permission: string; granted: boolean },
    @CurrentUser('id') actorId: string,
  ) {
    return this.usersService.setPermissionOverride(id, dto.permission, dto.granted, actorId);
  }

  @Delete(':id/permissions/:permission')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Remove a permission override for a user' })
  removePermission(
    @Param('id') id: string,
    @Param('permission') permission: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.usersService.removePermissionOverride(id, permission, actorId);
  }
}
