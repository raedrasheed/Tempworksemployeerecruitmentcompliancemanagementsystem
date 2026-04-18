import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateReportDto, UpdateReportDto, RunReportDto, ExportReportDto } from './dto/report.dto';

const ALL_REPORT_ROLES = ['System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Finance', 'Read Only'];
const EDIT_ROLES       = ['System Admin', 'HR Manager', 'Finance'];

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ── Meta ────────────────────────────────────────────────────────────────

  @Get('dashboard')
  @Roles(...ALL_REPORT_ROLES)
  @ApiOperation({ summary: 'Live dashboard KPIs (employee/applicant/compliance counts)' })
  getDashboard(@CurrentUser() user: any) {
    return this.reportsService.getDashboard({ role: user?.role, agencyId: user?.agencyId });
  }

  @Get('data-sources')
  @Roles(...ALL_REPORT_ROLES)
  @ApiOperation({ summary: 'List available data sources and their fields for the report builder' })
  getDataSources() {
    return this.reportsService.getDataSources();
  }

  // ── Saved report CRUD ────────────────────────────────────────────────────

  @Get()
  @Roles(...ALL_REPORT_ROLES)
  @ApiOperation({ summary: 'List all saved report configurations' })
  findAll() {
    return this.reportsService.findAll();
  }

  @Post()
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Save a new report configuration' })
  create(@Body() dto: CreateReportDto, @CurrentUser() user: any) {
    return this.reportsService.create(dto, user?.id);
  }

  @Get(':id')
  @Roles(...ALL_REPORT_ROLES)
  @ApiOperation({ summary: 'Get a saved report configuration by ID' })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Put(':id')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Update a saved report configuration' })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  update(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.reportsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...EDIT_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a saved report configuration' })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }

  // ── Run ──────────────────────────────────────────────────────────────────

  @Post(':id/run')
  @Roles(...ALL_REPORT_ROLES)
  @ApiOperation({ summary: 'Execute a saved report and return paginated rows + column metadata' })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  run(@Param('id') id: string, @Body() dto: RunReportDto) {
    return this.reportsService.run(id, dto);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  @Post(':id/export')
  @Roles(...EDIT_ROLES, 'Compliance Officer')
  @ApiOperation({ summary: 'Export a report as Excel, PDF, or Word' })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  @ApiBody({ type: ExportReportDto })
  async exportReport(
    @Param('id') id: string,
    @Body() dto: ExportReportDto,
    @Res() res: Response,
  ) {
    const { buffer, mimeType, filename } = await this.reportsService.export(id, dto.format);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }
}
