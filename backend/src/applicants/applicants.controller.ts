import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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
