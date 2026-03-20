import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'List employees with pagination and filters' })
  findAll(@Query() query: PaginationDto & { agencyId?: string; status?: string; nationality?: string }) {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee by ID' })
  findOne(@Param('id') id: string) { return this.employeesService.findOne(id); }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Get employee documents' })
  getDocuments(@Param('id') id: string) { return this.employeesService.getDocuments(id); }

  @Get(':id/workflow')
  @ApiOperation({ summary: 'Get employee workflow stages' })
  getWorkflow(@Param('id') id: string) { return this.employeesService.getWorkflow(id); }

  @Get(':id/compliance')
  @ApiOperation({ summary: 'Get employee compliance status' })
  getCompliance(@Param('id') id: string) { return this.employeesService.getCompliance(id); }

  @Get(':id/certifications')
  @ApiOperation({ summary: 'Get employee certifications' })
  getCertifications(@Param('id') id: string) { return this.employeesService.getCertifications(id); }

  @Get(':id/training')
  @ApiOperation({ summary: 'Get employee training history' })
  getTraining(@Param('id') id: string) { return this.employeesService.getTraining(id); }

  @Get(':id/performance')
  @ApiOperation({ summary: 'Get employee performance metrics' })
  getPerformance(@Param('id') id: string) { return this.employeesService.getPerformance(id); }

  @Post()
  @ApiOperation({ summary: 'Create new employee' })
  create(@Body() dto: CreateEmployeeDto) { return this.employeesService.create(dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateEmployeeDto>) {
    return this.employeesService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update employee status' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.employeesService.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete employee (soft delete)' })
  remove(@Param('id') id: string) { return this.employeesService.remove(id); }
}
