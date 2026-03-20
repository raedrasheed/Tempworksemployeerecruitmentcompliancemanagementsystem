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
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Applicants')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all applicants' })
  findAll(@Query() pagination: PaginationDto) {
    return this.applicantsService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get applicant by ID' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  findOne(@Param('id') id: string) {
    return this.applicantsService.findOne(id);
  }

  @Get(':id/application')
  @ApiOperation({ summary: 'Get applications for an applicant' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  getApplication(@Param('id') id: string) {
    return this.applicantsService.getApplication(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new applicant' })
  create(@Body() dto: CreateApplicantDto, @CurrentUser() user: any) {
    return this.applicantsService.create(dto, user?.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update applicant' })
  update(@Param('id') id: string, @Body() dto: UpdateApplicantDto, @CurrentUser() user: any) {
    return this.applicantsService.update(id, dto, user?.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update applicant status' })
  @ApiParam({ name: 'id', description: 'Applicant UUID' })
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.applicantsService.updateStatus(id, status, user?.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete applicant' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicantsService.remove(id, user?.id);
  }
}
