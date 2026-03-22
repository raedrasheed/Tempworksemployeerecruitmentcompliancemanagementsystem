import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Applicants')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Get()
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get all applicants' })
  findAll(@Query() pagination: PaginationDto) {
    return this.applicantsService.findAll(pagination);
  }

  // ── Merged Application endpoints ─────────────────────────────────────────
  // NOTE: these literal-path routes must come before parameterized :id routes

  @Get('applications')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get all applications (merged)' })
  findAllApplications(@Query() pagination: PaginationDto) {
    return this.applicantsService.findAllApplications(pagination);
  }

  @Get('applications/:appId')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get application by ID' })
  @ApiParam({ name: 'appId', description: 'Application UUID' })
  findOneApplication(@Param('appId') appId: string) {
    return this.applicantsService.findOneApplication(appId);
  }

  @Post('applications')
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Create a new application' })
  createApplication(@Body() dto: CreateApplicationDto, @CurrentUser() user: any) {
    return this.applicantsService.createApplication(dto, user?.id);
  }

  @Patch('applications/:appId')
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Update application' })
  @ApiParam({ name: 'appId', description: 'Application UUID' })
  updateApplication(@Param('appId') appId: string, @Body() dto: UpdateApplicationDto, @CurrentUser() user: any) {
    return this.applicantsService.updateApplication(appId, dto, user?.id);
  }

  @Patch('applications/:appId/status')
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Update application status' })
  @ApiParam({ name: 'appId', description: 'Application UUID' })
  updateApplicationStatus(@Param('appId') appId: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.applicantsService.updateApplicationStatus(appId, status, user?.id);
  }

  @Post('applications/:appId/notes')
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Add note to application' })
  @ApiParam({ name: 'appId', description: 'Application UUID' })
  addApplicationNote(@Param('appId') appId: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.applicantsService.addApplicationNote(appId, note, user?.id);
  }

  @Delete('applications/:appId')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete application' })
  @ApiParam({ name: 'appId', description: 'Application UUID' })
  deleteApplication(@Param('appId') appId: string, @CurrentUser() user: any) {
    return this.applicantsService.deleteApplication(appId, user?.id);
  }
  // ─────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get applicant by ID' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  findOne(@Param('id') id: string) {
    return this.applicantsService.findOne(id);
  }

  @Get(':id/application')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get applications for an applicant' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  getApplication(@Param('id') id: string) {
    return this.applicantsService.getApplication(id);
  }

  @Public()
  @Post('public/submit')
  @ApiOperation({ summary: 'Public application form: creates applicant + application (no auth)' })
  publicSubmit(@Body() dto: any) {
    return this.applicantsService.publicSubmit(dto);
  }

  @Post()
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Create a new applicant' })
  create(@Body() dto: CreateApplicantDto, @CurrentUser() user: any) {
    return this.applicantsService.create(dto, user?.id);
  }

  @Patch(':id')
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Update applicant' })
  update(@Param('id') id: string, @Body() dto: UpdateApplicantDto, @CurrentUser() user: any) {
    return this.applicantsService.update(id, dto, user?.id);
  }

  @Patch(':id/status')
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Update applicant status' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.applicantsService.updateStatus(id, status, user?.id);
  }

  @Delete(':id')
  @Roles('System Admin', 'HR Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete applicant' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicantsService.remove(id, user?.id);
  }
}
