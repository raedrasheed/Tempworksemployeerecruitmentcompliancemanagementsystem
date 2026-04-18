import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const ALL_ROLES = ['System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Finance', 'Read Only'];
const WRITE_ROLES = ['System Admin', 'HR Manager'];
const ADMIN_ROLES = ['System Admin', 'HR Manager'];

const photoStorage = diskStorage({
  destination: process.env.UPLOAD_DEST || './uploads',
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'List employees with pagination and filters' })
  findAll(
    @Query() query: PaginationDto & { agencyId?: string; status?: string; nationality?: string },
    @CurrentUser() user: any,
  ) {
    return this.employeesService.findAll(query, { role: user?.role, agencyId: user?.agencyId, agencyIsSystem: user?.agencyIsSystem });
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get employee by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.employeesService.findOne(id, { role: user?.role, agencyId: user?.agencyId, agencyIsSystem: user?.agencyIsSystem });
  }

  // ── Per-employee agency access grants (admin only) ──────────────────────────

  @Get(':id/agency-access')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'List agencies that have been granted access to this employee' })
  listAgencyAccess(@Param('id') id: string) {
    return this.employeesService.listAgencyAccess(id);
  }

  @Post(':id/agency-access')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Grant or update an agency\'s access to this employee. Body: { agencyId, notes?, canView?, canEdit? }. Defaults: canView=true, canEdit=true.' })
  grantAgencyAccess(
    @Param('id') id: string,
    @Body() dto: { agencyId: string; notes?: string; canView?: boolean; canEdit?: boolean },
    @CurrentUser('id') actorId: string,
  ) {
    return this.employeesService.grantAgencyAccess(
      id,
      dto.agencyId,
      { notes: dto.notes, canView: dto.canView, canEdit: dto.canEdit },
      actorId,
    );
  }

  @Patch(':id/agency-access/:agencyId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update an existing agency-access grant. Body: { canView?, canEdit?, notes? }. If both flags end up false the grant row is deleted.' })
  updateAgencyAccess(
    @Param('id') id: string,
    @Param('agencyId') agencyId: string,
    @Body() dto: { canView?: boolean; canEdit?: boolean; notes?: string },
    @CurrentUser('id') actorId: string,
  ) {
    return this.employeesService.updateAgencyAccess(id, agencyId, dto, actorId);
  }

  @Delete(':id/agency-access/:agencyId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Revoke a specific agency\'s access to this employee (deletes the grant row).' })
  revokeAgencyAccess(
    @Param('id') id: string,
    @Param('agencyId') agencyId: string,
  ) {
    return this.employeesService.revokeAgencyAccess(id, agencyId);
  }

  @Get(':id/documents')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get employee documents' })
  getDocuments(@Param('id') id: string) { return this.employeesService.getDocuments(id); }

  @Get(':id/workflow')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get employee workflow stages' })
  getWorkflow(@Param('id') id: string) { return this.employeesService.getWorkflow(id); }

  @Get(':id/compliance')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get employee compliance status' })
  getCompliance(@Param('id') id: string) { return this.employeesService.getCompliance(id); }

  @Get(':id/certifications')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get employee certifications' })
  getCertifications(@Param('id') id: string) { return this.employeesService.getCertifications(id); }

  @Get(':id/training')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get employee training history' })
  getTraining(@Param('id') id: string) { return this.employeesService.getTraining(id); }

  @Get(':id/performance')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Read Only')
  @ApiOperation({ summary: 'Get employee performance metrics' })
  getPerformance(@Param('id') id: string) { return this.employeesService.getPerformance(id); }

  @Get(':id/financial-profile')
  @Roles('System Admin', 'HR Manager', 'Finance', 'Compliance Officer', 'Read Only')
  @ApiOperation({ summary: 'Get the banking/salary profile for an employee (from applicant financial profile via employeeId link)' })
  getFinancialProfile(@Param('id') id: string) { return this.employeesService.getFinancialProfile(id); }

  @Post()
  @Roles(...WRITE_ROLES)
  @RequirePermission('employees:create')
  @ApiOperation({ summary: 'Create new employee' })
  create(@Body() dto: CreateEmployeeDto) { return this.employeesService.create(dto); }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @RequirePermission('employees:update')
  @ApiOperation({ summary: 'Update employee' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateEmployeeDto>, @CurrentUser() user: any) {
    return this.employeesService.update(id, dto, user?.id, { role: user?.role, agencyId: user?.agencyId, agencyIsSystem: user?.agencyIsSystem });
  }

  @Patch(':id/photo')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Upload or replace employee photo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', {
    storage: photoStorage,
    fileFilter: (_req, file, cb) => {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        return cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  }))
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No photo file provided');
    return this.employeesService.uploadPhoto(id, file);
  }

  @Patch(':id/status')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update employee status' })
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.employeesService.updateStatus(id, status, user?.id, { role: user?.role, agencyId: user?.agencyId, agencyIsSystem: user?.agencyIsSystem });
  }

  @Delete(':id')
  @Roles('System Admin')
  @RequirePermission('employees:delete')
  @ApiOperation({ summary: 'Delete employee (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.employeesService.remove(id, user?.id, { role: user?.role, agencyId: user?.agencyId, agencyIsSystem: user?.agencyIsSystem });
  }
}
