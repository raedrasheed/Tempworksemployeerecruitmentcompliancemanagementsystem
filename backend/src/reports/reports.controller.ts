import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard summary statistics' })
  getDashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('employees')
  @ApiOperation({ summary: 'Get employee report' })
  getEmployees(@Query() pagination: PaginationDto) {
    return this.reportsService.getEmployeeReport(pagination);
  }

  @Get('applications')
  @ApiOperation({ summary: 'Get applications report' })
  getApplications(@Query() pagination: PaginationDto) {
    return this.reportsService.getApplicationsReport(pagination);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Get documents report' })
  getDocuments(@Query() pagination: PaginationDto) {
    return this.reportsService.getDocumentsReport(pagination);
  }

  @Get('compliance')
  @ApiOperation({ summary: 'Get compliance report' })
  getCompliance(@Query() pagination: PaginationDto) {
    return this.reportsService.getComplianceReport(pagination);
  }

  @Get('agencies')
  @ApiOperation({ summary: 'Get agencies report' })
  getAgencies(@Query() pagination: PaginationDto) {
    return this.reportsService.getAgenciesReport(pagination);
  }

  @Get('export/:type')
  @ApiOperation({ summary: 'Export report data for a given type' })
  @ApiParam({ name: 'type', description: 'Report type: employees | applicants | documents' })
  exportReport(@Param('type') type: string) {
    return this.reportsService.exportReport(type);
  }
}
