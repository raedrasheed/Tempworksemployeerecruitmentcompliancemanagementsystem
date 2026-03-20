import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Applications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all applications' })
  findAll(@Query() pagination: PaginationDto) {
    return this.applicationsService.findAll(pagination);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Public endpoint - list submitted applications (no auth)' })
  getPublicApplications(@Query() pagination: PaginationDto) {
    return this.applicationsService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application by ID' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  findOne(@Param('id') id: string) {
    return this.applicationsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new application' })
  create(@Body() dto: CreateApplicationDto, @CurrentUser() user: any) {
    return this.applicationsService.create(dto, user?.id);
  }

  @Public()
  @Post('public/submit')
  @ApiOperation({ summary: 'Public form submission (no auth required)' })
  publicSubmit(@Body() dto: CreateApplicationDto) {
    return this.applicationsService.publicSubmit(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update application' })
  update(@Param('id') id: string, @Body() dto: UpdateApplicationDto, @CurrentUser() user: any) {
    return this.applicationsService.update(id, dto, user?.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update application status' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.applicationsService.updateStatus(id, status, user?.id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add note to application' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  addNote(@Param('id') id: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.applicationsService.addNote(id, note, user?.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete application' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationsService.remove(id, user?.id);
  }
}
