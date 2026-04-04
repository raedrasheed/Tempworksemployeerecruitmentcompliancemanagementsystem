import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';
import * as ExcelJS from 'exceljs';
import {
  FilterAttendanceEmployeesDto,
  GetEmployeeAttendanceDto,
  UpsertAttendanceDto,
  UpdateAttendanceDto,
  ExportAttendanceDto,
  BulkUpsertAttendanceDto,
  ATTENDANCE_STATUSES,
} from './dto/attendance.dto';
import { v4 as uuidv4 } from 'uuid';

// ── Status display helpers ────────────────────────────────────────────────────

const STATUS_ABBR: Record<string, string> = {
  PRESENT:  'P',
  ABSENT:   'A',
  LATE:     'L',
  ON_LEAVE: 'OL',
  HALF_DAY: 'HD',
  HOLIDAY:  'H',
};

/** bg ARGB, fg ARGB */
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PRESENT:  { bg: 'FFD1FAE5', fg: 'FF065F46' },
  ABSENT:   { bg: 'FFFEE2E2', fg: 'FF991B1B' },
  LATE:     { bg: 'FFFEF3C7', fg: 'FF92400E' },
  ON_LEAVE: { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
  HALF_DAY: { bg: 'FFEDE9FE', fg: 'FF5B21B6' },
  HOLIDAY:  { bg: 'FFF3F4F6', fg: 'FF374151' },
};

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  // ── List employees with attendance stats ─────────────────────────────────────

  async listEmployeesWithStats(dto: FilterAttendanceEmployeesDto): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
      month,
      year,
      status,
      driversOnly,
      agencyId,
    } = dto;

    const skip = (Number(page) - 1) * Number(limit);

    // Build employee where clause
    const where: any = { deletedAt: null };

    if (agencyId) where.agencyId = agencyId;

    if (driversOnly) {
      where.OR = [
        { licenseNumber: { not: null } },
        { licenseCategory: { not: null } },
      ];
    }

    if (search) {
      const searchConditions = [
        { firstName:      { contains: search, mode: 'insensitive' } },
        { lastName:       { contains: search, mode: 'insensitive' } },
        { email:          { contains: search, mode: 'insensitive' } },
        { employeeNumber: { contains: search, mode: 'insensitive' } },
        { licenseCategory: { contains: search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        // driversOnly already sets OR — wrap both in AND
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id:              true,
          employeeNumber:  true,
          firstName:       true,
          lastName:        true,
          email:           true,
          licenseNumber:   true,
          licenseCategory: true,
          status:          true,
          agencyId:        true,
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    // Compute date range for stats if requested
    let statsFrom: Date | null = null;
    let statsTo:   Date | null = null;

    if (month && year) {
      const range = this.computeDateRange(Number(month), Number(year));
      statsFrom = range.from;
      statsTo   = range.to;
    } else if (dateFrom || dateTo) {
      if (dateFrom) statsFrom = new Date(dateFrom + 'T00:00:00.000Z');
      if (dateTo)   statsTo   = new Date(dateTo   + 'T00:00:00.000Z');
    }

    // Enrich each employee with attendance stats
    const enriched = await Promise.all(
      employees.map(async (emp) => {
        if (!statsFrom && !statsTo && !status) {
          return { ...emp, attendanceStats: null };
        }

        const attWhere: any = { employeeId: emp.id };
        if (statsFrom || statsTo) {
          attWhere.date = {};
          if (statsFrom) attWhere.date.gte = statsFrom;
          if (statsTo)   attWhere.date.lte = statsTo;
        }
        if (status) attWhere.status = status;

        const grouped = await (this.prisma as any).attendanceRecord.groupBy({
          by:    ['status'],
          where: attWhere,
          _count: { status: true },
          _sum:   { workingHours: true },
        });

        const stats = this.buildStatsFromGroupBy(grouped);
        return { ...emp, attendanceStats: stats };
      }),
    );

    return PaginatedResponse.create(enriched, total, Number(page), Number(limit));
  }

  // ── Get single employee attendance ──────────────────────────────────────────

  async getEmployeeAttendance(employeeId: string, dto: GetEmployeeAttendanceDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        id:              true,
        employeeNumber:  true,
        firstName:       true,
        lastName:        true,
        email:           true,
        licenseNumber:   true,
        licenseCategory: true,
        status:          true,
        agencyId:        true,
      },
    });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);

    // Resolve date range — default to current month
    let from: Date;
    let to:   Date;

    if (dto.month && dto.year) {
      const range = this.computeDateRange(Number(dto.month), Number(dto.year));
      from = range.from;
      to   = range.to;
    } else if (dto.dateFrom || dto.dateTo) {
      const now = new Date();
      from = dto.dateFrom ? new Date(dto.dateFrom + 'T00:00:00.000Z') : new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
      to   = dto.dateTo   ? new Date(dto.dateTo   + 'T00:00:00.000Z') : new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0);
    } else {
      // Default: current month
      const now = new Date();
      const range = this.computeDateRange(now.getUTCMonth() + 1, now.getUTCFullYear());
      from = range.from;
      to   = range.to;
    }

    const records = await (this.prisma as any).attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'asc' },
    });

    const summary = this.buildSummaryFromRecords(records);

    return {
      employee,
      records,
      summary,
      dateRange: {
        from: from.toISOString().split('T')[0],
        to:   to.toISOString().split('T')[0],
      },
    };
  }

  // ── Upsert single record ─────────────────────────────────────────────────────

  async upsertRecord(dto: UpsertAttendanceDto, actorId?: string) {
    // Validate employee
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    });
    if (!employee) throw new NotFoundException(`Employee ${dto.employeeId} not found`);

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    const date = new Date(dto.date + 'T00:00:00.000Z');
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date: ${dto.date}`);
    }

    // Auto-calculate working hours if not provided but both times are
    let workingHours = dto.workingHours ?? null;
    if (workingHours == null && dto.checkIn && dto.checkOut) {
      workingHours = this.calcWorkingHours(dto.checkIn, dto.checkOut);
    }

    const id = uuidv4();

    const record = await (this.prisma as any).attendanceRecord.upsert({
      where: {
        employeeId_date: { employeeId: dto.employeeId, date },
      },
      create: {
        id,
        employeeId:   dto.employeeId,
        date,
        status:       dto.status,
        checkIn:      dto.checkIn      ?? null,
        checkOut:     dto.checkOut     ?? null,
        workingHours: workingHours     ?? null,
        notes:        dto.notes        ?? null,
        createdById:  actorId          ?? null,
        updatedById:  null,
      },
      update: {
        status:       dto.status,
        checkIn:      dto.checkIn      ?? null,
        checkOut:     dto.checkOut     ?? null,
        workingHours: workingHours     ?? null,
        notes:        dto.notes        ?? null,
        updatedById:  actorId          ?? null,
        updatedAt:    new Date(),
      },
    });

    await this.auditLog(actorId, 'ATTENDANCE_UPSERTED', record.id, {
      employeeId: dto.employeeId,
      date:       dto.date,
      status:     dto.status,
    });

    return { ...record, employee };
  }

  // ── Bulk upsert ──────────────────────────────────────────────────────────────

  async bulkUpsert(dto: BulkUpsertAttendanceDto, actorId?: string) {
    if (!dto.records || dto.records.length === 0) {
      throw new BadRequestException('records array must not be empty');
    }

    let created = 0;
    let updated = 0;
    const errors: { index: number; error: string; record?: any }[] = [];

    await Promise.all(
      dto.records.map(async (rec, index) => {
        try {
          // Check if record already exists so we can count create vs update
          const date = new Date(rec.date + 'T00:00:00.000Z');
          const existing = await (this.prisma as any).attendanceRecord.findUnique({
            where: { employeeId_date: { employeeId: rec.employeeId, date } },
            select: { id: true },
          });

          await this.upsertRecord(rec, actorId);

          if (existing) {
            updated++;
          } else {
            created++;
          }
        } catch (err: any) {
          errors.push({ index, error: err?.message ?? 'Unknown error', record: rec });
        }
      }),
    );

    return {
      created,
      updated,
      errors,
      total: dto.records.length,
      processed: created + updated,
    };
  }

  // ── Update record ────────────────────────────────────────────────────────────

  async updateRecord(id: string, dto: UpdateAttendanceDto, actorId?: string) {
    const existing = await (this.prisma as any).attendanceRecord.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Attendance record ${id} not found`);

    // Auto-calculate working hours if both times given and hours not explicitly set
    let workingHours = dto.workingHours;
    const newCheckIn  = dto.checkIn  !== undefined ? dto.checkIn  : existing.checkIn;
    const newCheckOut = dto.checkOut !== undefined ? dto.checkOut : existing.checkOut;

    if (workingHours === undefined && newCheckIn && newCheckOut) {
      workingHours = this.calcWorkingHours(newCheckIn, newCheckOut) ?? undefined;
    }

    const data: any = { updatedAt: new Date(), updatedById: actorId ?? null };
    if (dto.status       !== undefined) data.status       = dto.status;
    if (dto.checkIn      !== undefined) data.checkIn      = dto.checkIn;
    if (dto.checkOut     !== undefined) data.checkOut     = dto.checkOut;
    if (workingHours     !== undefined) data.workingHours = workingHours;
    if (dto.notes        !== undefined) data.notes        = dto.notes;

    const updated = await (this.prisma as any).attendanceRecord.update({
      where: { id },
      data,
    });

    await this.auditLog(actorId, 'ATTENDANCE_UPDATED', id, dto as any);
    return updated;
  }

  // ── Delete record ────────────────────────────────────────────────────────────

  async deleteRecord(id: string, actorId?: string) {
    const existing = await (this.prisma as any).attendanceRecord.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Attendance record ${id} not found`);

    await (this.prisma as any).attendanceRecord.delete({ where: { id } });

    await this.auditLog(actorId, 'ATTENDANCE_DELETED', id, {
      employeeId: existing.employeeId,
      date:       existing.date,
      status:     existing.status,
    });

    return { message: 'Attendance record deleted' };
  }

  // ── Excel Export ─────────────────────────────────────────────────────────────

  async exportExcel(dto: ExportAttendanceDto): Promise<Buffer> {
    const month = Number(dto.month);
    const year  = Number(dto.year);

    if (month < 1 || month > 12) throw new BadRequestException('month must be 1–12');
    if (year < 2000 || year > 2100) throw new BadRequestException('year must be 2000–2100');

    const { from, to } = this.computeDateRange(month, year);
    const daysInMonth  = new Date(year, month, 0).getDate();

    // Build employee filter
    const empWhere: any = { deletedAt: null };
    if (dto.employeeId) {
      empWhere.id = dto.employeeId;
    } else if (dto.driversOnly) {
      empWhere.OR = [
        { licenseNumber:   { not: null } },
        { licenseCategory: { not: null } },
      ];
    }

    const employees = await this.prisma.employee.findMany({
      where: empWhere,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id:              true,
        employeeNumber:  true,
        firstName:       true,
        lastName:        true,
        licenseCategory: true,
      },
    });

    if (employees.length === 0) {
      throw new BadRequestException('No employees found matching the given criteria');
    }

    // Fetch all attendance records for the month in one query
    const employeeIds = employees.map((e) => e.id);
    const allRecords: any[] = await (this.prisma as any).attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        date:       { gte: from, lte: to },
      },
    });

    // Build lookup: employeeId → Map<dayOfMonth, record>
    const recordMap = new Map<string, Map<number, any>>();
    for (const rec of allRecords) {
      if (!recordMap.has(rec.employeeId)) {
        recordMap.set(rec.employeeId, new Map());
      }
      const day = new Date(rec.date).getUTCDate();
      recordMap.get(rec.employeeId)!.set(day, rec);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TempWorks Attendance Module';
    workbook.created = new Date();

    // ── Sheet 1: Attendance Summary ───────────────────────────────────────────

    const summarySheet = workbook.addWorksheet('Attendance Summary', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }],
    });

    // Build columns
    const summaryColumns: Partial<ExcelJS.Column>[] = [
      { header: 'Driver Name',       key: 'name',            width: 24 },
      { header: 'Employee ID',       key: 'employeeNumber',  width: 14 },
      { header: 'License Category',  key: 'licenseCategory', width: 16 },
    ];
    for (let d = 1; d <= daysInMonth; d++) {
      summaryColumns.push({ header: String(d), key: `day_${d}`, width: 5 });
    }
    summaryColumns.push(
      { header: 'Present',    key: 'present',      width: 9  },
      { header: 'Absent',     key: 'absent',       width: 9  },
      { header: 'Late',       key: 'late',         width: 7  },
      { header: 'On Leave',   key: 'onLeave',      width: 9  },
      { header: 'Half Day',   key: 'halfDay',      width: 9  },
      { header: 'Holiday',    key: 'holiday',      width: 9  },
      { header: 'Total Hrs',  key: 'totalHours',   width: 10 },
    );
    summarySheet.columns = summaryColumns;

    // Header row styling — blue
    summarySheet.getRow(1).eachCell((cell) => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.border    = { bottom: { style: 'thin', color: { argb: 'FF1E40AF' } } };
    });
    summarySheet.getRow(1).height = 28;

    // Data rows
    for (const emp of employees) {
      const dayMap   = recordMap.get(emp.id) ?? new Map<number, any>();
      const rowData: Record<string, any> = {
        name:            `${emp.firstName} ${emp.lastName}`,
        employeeNumber:  emp.employeeNumber ?? '',
        licenseCategory: emp.licenseCategory ?? '',
      };

      let presentCount  = 0;
      let absentCount   = 0;
      let lateCount     = 0;
      let onLeaveCount  = 0;
      let halfDayCount  = 0;
      let holidayCount  = 0;
      let totalHours    = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const rec = dayMap.get(d);
        rowData[`day_${d}`] = rec ? (STATUS_ABBR[rec.status] ?? rec.status) : '';
        if (rec) {
          switch (rec.status) {
            case 'PRESENT':  presentCount++;  break;
            case 'ABSENT':   absentCount++;   break;
            case 'LATE':     lateCount++;     break;
            case 'ON_LEAVE': onLeaveCount++;  break;
            case 'HALF_DAY': halfDayCount++;  break;
            case 'HOLIDAY':  holidayCount++;  break;
          }
          if (rec.workingHours) totalHours += Number(rec.workingHours);
        }
      }

      rowData.present    = presentCount;
      rowData.absent     = absentCount;
      rowData.late       = lateCount;
      rowData.onLeave    = onLeaveCount;
      rowData.halfDay    = halfDayCount;
      rowData.holiday    = holidayCount;
      rowData.totalHours = Math.round(totalHours * 100) / 100;

      const row = summarySheet.addRow(rowData);

      // Color each day cell by status
      for (let d = 1; d <= daysInMonth; d++) {
        const rec = dayMap.get(d);
        if (rec && STATUS_COLORS[rec.status]) {
          const cell = row.getCell(`day_${d}`);
          const colors = STATUS_COLORS[rec.status];
          cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
          cell.font  = { color: { argb: colors.fg }, bold: true, size: 9 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }

      // Color summary columns
      this.colorSummaryCell(row.getCell('present'),    STATUS_COLORS['PRESENT']);
      this.colorSummaryCell(row.getCell('absent'),     STATUS_COLORS['ABSENT']);
      this.colorSummaryCell(row.getCell('late'),       STATUS_COLORS['LATE']);
      this.colorSummaryCell(row.getCell('onLeave'),    STATUS_COLORS['ON_LEAVE']);
      this.colorSummaryCell(row.getCell('halfDay'),    STATUS_COLORS['HALF_DAY']);
      this.colorSummaryCell(row.getCell('holiday'),    STATUS_COLORS['HOLIDAY']);

      // Total hours: light blue
      const hoursCell = row.getCell('totalHours');
      hoursCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      hoursCell.font  = { bold: true, color: { argb: 'FF1E40AF' } };
      hoursCell.alignment = { horizontal: 'right' };
      hoursCell.numFmt    = '0.00';
    }

    // Auto-filter
    summarySheet.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: summarySheet.columnCount },
    };

    // ── Sheet 2: Timesheet Detail (single employee only) ─────────────────────

    if (dto.employeeId && employees.length === 1) {
      const emp = employees[0];
      const detailSheet = workbook.addWorksheet('Timesheet Detail', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      detailSheet.columns = [
        { header: 'Date',         key: 'date',         width: 14 },
        { header: 'Day',          key: 'day',          width: 12 },
        { header: 'Status',       key: 'status',       width: 12 },
        { header: 'Check In',     key: 'checkIn',      width: 10 },
        { header: 'Check Out',    key: 'checkOut',     width: 10 },
        { header: 'Hours',        key: 'hours',        width: 10 },
        { header: 'Notes',        key: 'notes',        width: 30 },
      ];

      // Header styling
      detailSheet.getRow(1).eachCell((cell) => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border    = { bottom: { style: 'thin', color: { argb: 'FF1E40AF' } } };
      });
      detailSheet.getRow(1).height = 28;

      const dayMap = recordMap.get(emp.id) ?? new Map<number, any>();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(Date.UTC(year, month - 1, d));
        const dateStr = dateObj.toISOString().split('T')[0];
        const dayName = dayNames[dateObj.getUTCDay()];
        const rec     = dayMap.get(d);

        const rowData: Record<string, any> = {
          date:    dateStr,
          day:     dayName,
          status:  rec?.status  ?? '',
          checkIn:  rec?.checkIn  ?? '',
          checkOut: rec?.checkOut ?? '',
          hours:    rec?.workingHours != null ? Number(rec.workingHours) : '',
          notes:   rec?.notes   ?? '',
        };

        const row = detailSheet.addRow(rowData);

        // Color status cell
        if (rec && STATUS_COLORS[rec.status]) {
          const colors = STATUS_COLORS[rec.status];
          const statusCell = row.getCell('status');
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
          statusCell.font = { color: { argb: colors.fg }, bold: true };
        }

        // Format hours
        if (typeof rowData.hours === 'number') {
          row.getCell('hours').numFmt = '0.00';
          row.getCell('hours').alignment = { horizontal: 'right' };
        }

        // Shade weekends lightly
        if (dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6) {
          row.eachCell((cell) => {
            if (!cell.fill || (cell.fill as any).fgColor?.argb === 'FFFFFFFF' || !(cell.fill as ExcelJS.FillPattern).fgColor) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDFDFD' } };
            }
          });
        }
      }

      // Totals row
      const dataStart = 2;
      const dataEnd   = daysInMonth + 1;
      detailSheet.addRow({});
      const totalsRow = detailSheet.addRow({
        date:  'TOTALS',
        hours: { formula: `SUM(F${dataStart}:F${dataEnd})` },
      });
      totalsRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      });
      totalsRow.getCell('hours').numFmt = '0.00';

      detailSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to:   { row: 1, column: detailSheet.columnCount },
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private colorSummaryCell(
    cell: ExcelJS.Cell,
    colors: { bg: string; fg: string },
  ): void {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
    cell.font      = { color: { argb: colors.fg }, bold: true };
    cell.alignment = { horizontal: 'center' };
  }

  private buildStatsFromGroupBy(grouped: any[]): Record<string, any> {
    const stats: Record<string, number> = {
      presentDays: 0,
      absentDays:  0,
      lateDays:    0,
      onLeaveDays: 0,
      halfDayDays: 0,
      holidayDays: 0,
    };
    let totalWorkingHours = 0;

    for (const g of grouped) {
      const count = g._count?.status ?? 0;
      const hours = Number(g._sum?.workingHours ?? 0);
      totalWorkingHours += hours;

      switch (g.status) {
        case 'PRESENT':  stats.presentDays  += count; break;
        case 'ABSENT':   stats.absentDays   += count; break;
        case 'LATE':     stats.lateDays     += count; break;
        case 'ON_LEAVE': stats.onLeaveDays  += count; break;
        case 'HALF_DAY': stats.halfDayDays  += count; break;
        case 'HOLIDAY':  stats.holidayDays  += count; break;
      }
    }

    const totalRecorded =
      stats.presentDays + stats.absentDays + stats.lateDays +
      stats.onLeaveDays + stats.halfDayDays + stats.holidayDays;

    return { ...stats, totalRecorded, totalWorkingHours: Math.round(totalWorkingHours * 100) / 100 };
  }

  private buildSummaryFromRecords(records: any[]): Record<string, any> {
    const stats = {
      presentDays: 0,
      absentDays:  0,
      lateDays:    0,
      onLeaveDays: 0,
      halfDayDays: 0,
      holidayDays: 0,
      totalWorkingHours: 0,
    };

    for (const rec of records) {
      switch (rec.status) {
        case 'PRESENT':  stats.presentDays++;  break;
        case 'ABSENT':   stats.absentDays++;   break;
        case 'LATE':     stats.lateDays++;     break;
        case 'ON_LEAVE': stats.onLeaveDays++;  break;
        case 'HALF_DAY': stats.halfDayDays++;  break;
        case 'HOLIDAY':  stats.holidayDays++;  break;
      }
      if (rec.workingHours) stats.totalWorkingHours += Number(rec.workingHours);
    }

    stats.totalWorkingHours = Math.round(stats.totalWorkingHours * 100) / 100;
    return stats;
  }

  private computeDateRange(month: number, year: number): { from: Date; to: Date } {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to   = new Date(Date.UTC(year, month, 0));       // last day of month at UTC midnight
    return { from, to };
  }

  private calcWorkingHours(checkIn: string, checkOut: string): number | null {
    try {
      const [inH, inM]   = checkIn.split(':').map(Number);
      const [outH, outM] = checkOut.split(':').map(Number);

      if (
        isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM) ||
        inH < 0 || inH > 23 || inM < 0 || inM > 59 ||
        outH < 0 || outH > 23 || outM < 0 || outM > 59
      ) {
        return null;
      }

      const inMinutes  = inH  * 60 + inM;
      const outMinutes = outH * 60 + outM;

      // Handle overnight shifts
      const diff = outMinutes >= inMinutes
        ? outMinutes - inMinutes
        : (24 * 60 - inMinutes) + outMinutes;

      return Math.round((diff / 60) * 100) / 100;
    } catch {
      return null;
    }
  }

  private async auditLog(
    userId: string | undefined,
    action: string,
    entityId: string,
    changes?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity:   'AttendanceRecord',
          entityId,
          changes:  changes as any,
        },
      });
    } catch {
      // Audit must never crash main flow
    }
  }
}
