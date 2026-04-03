import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  Query, UseGuards, HttpCode, HttpStatus, Res, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { ConvertToEmployeeDto } from './dto/convert-to-employee.dto';
import { FilterApplicantsDto } from './dto/filter-applicants.dto';
import { UpsertFinancialProfileDto } from './dto/financial-profile.dto';
import { BulkActionDto, AssignAgencyDto, ConvertLeadDto } from './dto/bulk-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

const photoStorage = diskStorage({
  destination: process.env.UPLOAD_DEST || './uploads',
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

@ApiTags('Applicants')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  // ── List ──────────────────────────────────────────────────────────────────────

  @Get()
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get all applicants (tier/status/agency filters; agency users see only Candidates in their agency)' })
  findAll(@Query() filter: FilterApplicantsDto, @CurrentUser() user: any) {
    return this.applicantsService.findAll(filter, { role: user?.role, agencyId: user?.agencyId });
  }

  // ── Single ────────────────────────────────────────────────────────────────────

  @Get(':id')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get applicant by ID (includes financialProfile + agencyHistory)' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicantsService.findOne(id, { role: user?.role, agencyId: user?.agencyId });
  }

  // ── Public Submit ─────────────────────────────────────────────────────────────

  @Public()
  @Post('public/submit')
  @ApiOperation({ summary: 'Public application form: creates LEAD applicant (no auth)' })
  publicSubmit(@Body() dto: any) {
    return this.applicantsService.publicSubmit(dto);
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  @Post()
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Create a new applicant (defaults tier=LEAD)' })
  create(@Body() dto: CreateApplicantDto & { tier?: string }, @CurrentUser() user: any) {
    return this.applicantsService.create(dto, user?.id);
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Update applicant fields' })
  update(@Param('id') id: string, @Body() dto: UpdateApplicantDto, @CurrentUser() user: any) {
    return this.applicantsService.update(id, dto, user?.id);
  }

  // ── Photo Upload ──────────────────────────────────────────────────────────────

  @Patch(':id/photo')
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Upload or replace applicant photo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', {
    storage: photoStorage,
    fileFilter: (_req, file, cb) => {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        return cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No photo file provided');
    return this.applicantsService.uploadPhoto(id, file);
  }

  // ── Status ────────────────────────────────────────────────────────────────────

  @Patch(':id/status')
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Agency Manager')
  @ApiOperation({ summary: 'Update applicant status' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.applicantsService.updateStatus(id, status, user?.id);
  }

  // ── Workflow Stage ────────────────────────────────────────────────────────────

  @Patch(':id/stage')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter')
  @ApiOperation({ summary: 'Set current workflow stage for an applicant' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  setCurrentStage(@Param('id') id: string, @Body('stageId') stageId: string, @CurrentUser() user: any) {
    return this.applicantsService.setCurrentStage(id, stageId || null, user?.id);
  }

  // ── Convert Lead → Candidate ──────────────────────────────────────────────────

  @Post(':id/convert-to-candidate')
  @Roles('System Admin', 'HR Manager', 'Recruiter')
  @ApiOperation({ summary: 'Promote a Lead to a Candidate (optionally assign to holding agency)' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  convertLeadToCandidate(@Param('id') id: string, @Body() dto: ConvertLeadDto, @CurrentUser() user: any) {
    return this.applicantsService.convertLeadToCandidate(id, dto, user?.id);
  }

  // ── Reassign Agency ───────────────────────────────────────────────────────────

  @Patch(':id/agency')
  @Roles('System Admin', 'HR Manager', 'Recruiter')
  @ApiOperation({ summary: 'Reassign applicant to a different agency (records history)' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  reassignAgency(@Param('id') id: string, @Body() dto: AssignAgencyDto, @CurrentUser() user: any) {
    return this.applicantsService.reassignAgency(id, dto, user?.id);
  }

  // ── Financial Profile ─────────────────────────────────────────────────────────

  @Get(':id/financial')
  @Roles('System Admin', 'HR Manager', 'Finance', 'Recruiter')
  @ApiOperation({ summary: 'Get financial profile (Candidates only)' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  getFinancialProfile(@Param('id') id: string) {
    return this.applicantsService.getFinancialProfile(id);
  }

  @Patch(':id/financial')
  @Roles('System Admin', 'HR Manager', 'Finance')
  @ApiOperation({ summary: 'Create or update financial profile (Candidates only)' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  upsertFinancialProfile(
    @Param('id') id: string,
    @Body() dto: UpsertFinancialProfileDto,
    @CurrentUser() user: any,
  ) {
    return this.applicantsService.upsertFinancialProfile(id, dto, user?.id);
  }

  // ── Agency History ────────────────────────────────────────────────────────────

  @Get(':id/agency-history')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter')
  @ApiOperation({ summary: 'Get agency assignment history for an applicant' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  getAgencyHistory(@Param('id') id: string) {
    return this.applicantsService.getAgencyHistory(id);
  }

  // ── Bulk Actions ──────────────────────────────────────────────────────────────

  @Post('bulk-action')
  @Roles('System Admin', 'HR Manager', 'Recruiter')
  @ApiOperation({ summary: 'Perform a bulk action on multiple applicants' })
  bulkAction(@Body() dto: BulkActionDto, @CurrentUser() user: any) {
    return this.applicantsService.bulkAction(dto, user?.id);
  }

  // ── CSV Export ────────────────────────────────────────────────────────────────

  @Get('export/csv')
  @Roles('System Admin', 'HR Manager', 'Recruiter', 'Finance', 'Compliance Officer')
  @ApiOperation({ summary: 'Export applicants as CSV file (honours same filters as list endpoint)' })
  async exportCsv(
    @Query() filter: FilterApplicantsDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const csv = await this.applicantsService.exportCsv(filter, { role: user?.role, agencyId: user?.agencyId });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="applicants-${Date.now()}.csv"`);
    res.send(csv);
  }

  // ── Convert to Employee ───────────────────────────────────────────────────────

  @Post(':id/convert')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Convert Candidate to employee (CANDIDATE tier required)' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  convertToEmployee(@Param('id') id: string, @Body() dto: ConvertToEmployeeDto, @CurrentUser() user: any) {
    return this.applicantsService.convertToEmployee(id, dto, user?.id);
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles('System Admin', 'HR Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete applicant' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicantsService.remove(id, user?.id);
  }
}
