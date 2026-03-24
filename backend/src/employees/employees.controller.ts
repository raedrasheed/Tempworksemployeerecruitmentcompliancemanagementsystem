import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const ALL_ROLES = ['System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only'];
const WRITE_ROLES = ['System Admin', 'HR Manager', 'Agency Manager'];

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'List employees with pagination and filters' })
  findAll(@Query() query: PaginationDto & { agencyId?: string; status?: string; nationality?: string }) {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get employee by ID' })
  findOne(@Param('id') id: string) { return this.employeesService.findOne(id); }

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
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Agency Manager', 'Read Only')
  @ApiOperation({ summary: 'Get employee performance metrics' })
  getPerformance(@Param('id') id: string) { return this.employeesService.getPerformance(id); }

  @Post()
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Create new employee' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: any) { return this.employeesService.create(dto, user?.id); }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update employee' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateEmployeeDto>, @CurrentUser() user: any) {
    return this.employeesService.update(id, dto, user?.id);
  }

  @Patch(':id/status')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update employee status' })
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.employeesService.updateStatus(id, status, user?.id);
  }

  @Delete(':id')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Delete employee (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) { return this.employeesService.remove(id, user?.id); }
}
