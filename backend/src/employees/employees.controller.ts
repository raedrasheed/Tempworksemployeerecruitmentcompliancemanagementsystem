import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const ALL_ROLES = ['System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only'];
const WRITE_ROLES = ['System Admin', 'HR Manager', 'Agency Manager'];

const photoStorage = diskStorage({
  destination: process.env.UPLOAD_DEST || './uploads',
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

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

  @Get(':id/financial-profile')
  @Roles('System Admin', 'HR Manager', 'Finance', 'Compliance Officer', 'Read Only')
  @ApiOperation({ summary: 'Get the banking/salary profile for an employee (from applicant financial profile via employeeId link)' })
  getFinancialProfile(@Param('id') id: string) { return this.employeesService.getFinancialProfile(id); }

  @Post()
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Create new employee' })
  create(@Body() dto: CreateEmployeeDto) { return this.employeesService.create(dto); }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update employee' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateEmployeeDto>) {
    return this.employeesService.update(id, dto);
  }

  @Patch(':id/photo')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Upload or replace employee photo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', {
    storage: photoStorage,
    fileFilter: (_req, file, cb) => {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        return cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  }))
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No photo file provided');
    return this.employeesService.uploadPhoto(id, file);
  }

  @Patch(':id/status')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update employee status' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.employeesService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Delete employee (soft delete)' })
  remove(@Param('id') id: string) { return this.employeesService.remove(id); }
}
