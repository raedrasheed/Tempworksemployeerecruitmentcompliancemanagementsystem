import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  Query, UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AgenciesService } from './agencies.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const logoStorage = diskStorage({
  destination: process.env.UPLOAD_DEST || './uploads',
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

@ApiTags('Agencies')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get()
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Finance', 'Agency Manager', 'Agency User', 'Read Only')
  @ApiOperation({ summary: 'Get all agencies (agency users see only their own)' })
  findAll(@Query() pagination: PaginationDto, @CurrentUser() user: any) {
    return this.agenciesService.findAll(pagination, { role: user?.role, agencyId: user?.agencyId });
  }

  @Get(':id')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Finance', 'Agency Manager', 'Agency User', 'Read Only')
  @ApiOperation({ summary: 'Get agency by ID (agency users can only fetch their own)' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.agenciesService.findOne(id, { role: user?.role, agencyId: user?.agencyId });
  }

  @Get(':id/users')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Finance', 'Agency Manager', 'Agency User', 'Read Only')
  @ApiOperation({ summary: 'Get users belonging to an agency' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  getUsers(@Param('id') id: string, @Query() pagination: PaginationDto, @CurrentUser() user: any) {
    return this.agenciesService.getUsers(id, pagination, { role: user?.role, agencyId: user?.agencyId });
  }

  @Get(':id/employees')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Finance', 'Agency Manager', 'Agency User', 'Read Only')
  @ApiOperation({ summary: 'Get employees belonging to an agency' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  getEmployees(@Param('id') id: string, @Query() pagination: PaginationDto, @CurrentUser() user: any) {
    return this.agenciesService.getEmployees(id, pagination, { role: user?.role, agencyId: user?.agencyId });
  }

  @Get(':id/stats')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Finance', 'Agency Manager', 'Agency User', 'Read Only')
  @ApiOperation({ summary: 'Get agency statistics' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  getStats(@Param('id') id: string, @CurrentUser() user: any) {
    return this.agenciesService.getStats(id, { role: user?.role, agencyId: user?.agencyId });
  }

  @Post()
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Create a new agency' })
  create(@Body() dto: CreateAgencyDto, @CurrentUser() user: any) {
    return this.agenciesService.create(dto, user?.id);
  }

  @Patch(':id')
  @Roles('System Admin', 'HR Manager', 'Agency Manager')
  @ApiOperation({
    summary:
      'Update agency. Agency Managers can only edit their own agency, and the service strips ' +
      'protected fields (name, managerId, status, maxUsersPerAgency) from their payload.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateAgencyDto, @CurrentUser() user: any) {
    return this.agenciesService.update(id, dto, user?.id, { role: user?.role, agencyId: user?.agencyId });
  }

  // ── Agency-wide permission overrides (admin only) ────────────────────────────

  @Get(':id/permission-overrides')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'List permission overrides applied to every user of this agency' })
  listPermissionOverrides(@Param('id') id: string) {
    return this.agenciesService.listPermissionOverrides(id);
  }

  @Post(':id/permission-overrides')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Grant or revoke a permission for every user of this agency. Body: { permission, allow }' })
  setPermissionOverride(
    @Param('id') id: string,
    @Body() dto: { permission: string; allow: boolean },
    @CurrentUser() user: any,
  ) {
    return this.agenciesService.setPermissionOverride(id, dto.permission, dto.allow, user?.id);
  }

  @Delete(':id/permission-overrides/:permission')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Remove an agency-wide permission override so the agency falls back to role defaults' })
  removePermissionOverride(
    @Param('id') id: string,
    @Param('permission') permission: string,
    @CurrentUser() user: any,
  ) {
    return this.agenciesService.removePermissionOverride(id, permission, user?.id);
  }

  @Patch(':id/logo')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Upload or replace the agency logo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('logo', {
    storage: logoStorage,
    fileFilter: (_req, file, cb) => {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.mimetype)) {
        return cb(new BadRequestException('Only JPEG, PNG, WebP or SVG images are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  uploadLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    if (!file) throw new BadRequestException('No logo file provided');
    return this.agenciesService.uploadLogo(id, file, user?.id);
  }

  @Delete(':id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete agency' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.agenciesService.remove(id, user?.id);
  }

  @Patch(':id/manager')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Set the manager for an agency' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  setManager(@Param('id') id: string, @Body('userId') userId: string, @CurrentUser() user: any) {
    return this.agenciesService.setManager(id, userId, user?.id);
  }
}
