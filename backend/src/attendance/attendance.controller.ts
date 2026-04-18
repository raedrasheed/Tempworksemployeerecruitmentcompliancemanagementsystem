import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, Res, Request,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
  FilterAttendanceEmployeesDto,
  GetEmployeeAttendanceDto,
  UpsertAttendanceDto,
  UpdateAttendanceDto,
  BulkUpsertAttendanceDto,
  ExportAttendanceDto,
} from './dto/attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const READ_ROLES   = ['System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter'];
const WRITE_ROLES  = ['System Admin', 'HR Manager', 'Recruiter'];
const EXPORT_ROLES = ['System Admin', 'HR Manager', 'Finance', 'Compliance Officer'];

@ApiTags('Attendance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // GET /attendance/employees — list employees with attendance stats
  @Get('employees')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'List employees with attendance statistics' })
  listEmployees(@Query() dto: FilterAttendanceEmployeesDto) {
    return this.attendanceService.listEmployeesWithStats(dto);
  }

  // GET /attendance/export/excel — Excel export
  @Get('export/excel')
  @Roles(...EXPORT_ROLES)
  @ApiOperation({ summary: 'Export attendance data as Excel workbook' })
  async exportExcel(@Query() dto: ExportAttendanceDto, @Res() res: Response) {
    const buffer    = await this.attendanceService.exportExcel(dto);
    const monthPad  = String(dto.month).padStart(2, '0');
    const filename  = dto.employeeId
      ? `attendance-driver-${dto.year}-${monthPad}.xlsx`
      : `attendance-all-${dto.year}-${monthPad}.xlsx`;

    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  // GET /attendance/employees/:employeeId — employee attendance detail
  @Get('employees/:employeeId')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Get attendance records for a specific employee' })
  getEmployeeAttendance(
    @Param('employeeId') employeeId: string,
    @Query() dto: GetEmployeeAttendanceDto,
  ) {
    return this.attendanceService.getEmployeeAttendance(employeeId, dto);
  }

  // POST /attendance — upsert single record
  @Post()
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Create or update an attendance record (upsert by employee + date)' })
  upsert(@Body() dto: UpsertAttendanceDto, @Request() req: any) {
    return this.attendanceService.upsertRecord(dto, req.user?.id);
  }

  // POST /attendance/bulk — bulk upsert
  @Post('bulk')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Bulk upsert attendance records' })
  bulkUpsert(@Body() dto: BulkUpsertAttendanceDto, @Request() req: any) {
    return this.attendanceService.bulkUpsert(dto, req.user?.id);
  }

  // PATCH /attendance/:id — update a record
  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update an existing attendance record by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto, @Request() req: any) {
    return this.attendanceService.updateRecord(id, dto, req.user?.id);
  }

  // DELETE /attendance/:id — delete a record
  @Delete(':id')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an attendance record by ID' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.attendanceService.deleteRecord(id, req.user?.id);
  }
}
