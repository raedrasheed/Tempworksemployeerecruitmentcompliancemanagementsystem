import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get dashboard summary statistics' })
  getDashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('employees')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get employee report' })
  getEmployees(@Query() pagination: PaginationDto) {
    return this.reportsService.getEmployeeReport(pagination);
  }

  @Get('applications')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get applications report' })
  getApplications(@Query() pagination: PaginationDto) {
    return this.reportsService.getApplicationsReport(pagination);
  }

  @Get('documents')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get documents report' })
  getDocuments(@Query() pagination: PaginationDto) {
    return this.reportsService.getDocumentsReport(pagination);
  }

  @Get('compliance')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get compliance report' })
  getCompliance(@Query() pagination: PaginationDto) {
    return this.reportsService.getComplianceReport(pagination);
  }

  @Get('agencies')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get agencies report' })
  getAgencies(@Query() pagination: PaginationDto) {
    return this.reportsService.getAgenciesReport(pagination);
  }

  @Get('export/:type')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Finance')
  @ApiOperation({ summary: 'Export report data for a given type' })
  @ApiParam({ name: 'type', description: 'Report type: employees | applicants | documents' })
  exportReport(@Param('type') type: string) {
    return this.reportsService.exportReport(type);
  }
}
