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
  BulkApplyAttendanceDto,
  LockPeriodDto,
  ATTENDANCE_STATUSES,
} from './dto/attendance.dto';
import { v4 as uuidv4 } from 'uuid';

// ── Status display helpers ────────────────────────────────────────────────────

const STATUS_ABBR: Record<string, string> = {
  PRESENT:  'P',
  ABSENT:   'A',
  OFF:      'O',
  VACATION: 'V',
  SICK:     'S',
  // Legacy values — rendered compactly so existing rows still display
  // until they're edited/replaced.
  LATE:     'L',
  ON_LEAVE: 'OL',
  HALF_DAY: 'HD',
  HOLIDAY:  'H',
};

/** bg ARGB, fg ARGB */
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PRESENT:  { bg: 'FFD1FAE5', fg: 'FF065F46' },
  ABSENT:   { bg: 'FFFEE2E2', fg: 'FF991B1B' },
  OFF:      { bg: 'FFF3F4F6', fg: 'FF374151' },
  VACATION: { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
  SICK:     { bg: 'FFEDE9FE', fg: 'FF5B21B6' },
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
          photoUrl:        true,
          licenseNumber:   true,
          licenseCategory: true,
          status:          true,
          agencyId:        true,
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    // Compute date range for stats
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

    const zeroStats = {
      presentCount: 0, absentCount: 0, lateCount: 0,
      onLeaveCount: 0, halfDayCount: 0, holidayCount: 0,
      totalWorkingHours: 0, todayStatus: null as string | null,
    };

    // Enrich each employee with attendance stats — wrapped in try/catch so a
    // missing table or Prisma client mismatch never silently kills the list.
    const today = new Date().toISOString().split('T')[0];

    const enriched = await Promise.all(
      employees.map(async (emp) => {
        try {
          const attWhere: any = { employeeId: emp.id };
          if (statsFrom || statsTo) {
            attWhere.date = {};
            if (statsFrom) attWhere.date.gte = statsFrom;
            if (statsTo)   attWhere.date.lte = statsTo;
          }
          if (status) attWhere.status = status;

          const records = await (this.prisma as any).attendanceRecord.findMany({
            where: attWhere,
            select: { status: true, workingHours: true, date: true },
          });

          const counts: Record<string, number> = {
            presentCount: 0, absentCount: 0, lateCount: 0,
            onLeaveCount: 0, halfDayCount: 0, holidayCount: 0,
          };
          let totalWorkingHours = 0;
          let todayStatus: string | null = null;

          for (const r of records) {
            const dateStr = r.date instanceof Date
              ? r.date.toISOString().split('T')[0]
              : String(r.date).slice(0, 10);
            if (dateStr === today) todayStatus = r.status;

            switch (r.status) {
              case 'PRESENT':  counts.presentCount++;  break;
              case 'ABSENT':   counts.absentCount++;   break;
              case 'LATE':     counts.lateCount++;     break;
              case 'ON_LEAVE': counts.onLeaveCount++;  break;
              case 'HALF_DAY': counts.halfDayCount++;  break;
              case 'HOLIDAY':  counts.holidayCount++;  break;
            }
            if (r.workingHours) totalWorkingHours += Number(r.workingHours);
          }

          return { ...emp, ...counts, totalWorkingHours, todayStatus };
        } catch {
          return { ...emp, ...zeroStats };
        }
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
        photoUrl:        true,
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

    // Refuse writes into a locked month.
    await this.assertPeriodUnlocked(dto.date);

    // Ordering guards — so UI-side errors never slip past.
    if (dto.checkIn && dto.checkOut) {
      const ci = this.toMin(dto.checkIn);
      const co = this.toMin(dto.checkOut);
      // Overnight shifts are legal — only fail if both are same-day
      // and out < in AND the delta is small (< 4h) which almost
      // certainly means operator error rather than overnight.
      if (ci != null && co != null && co < ci && (ci - co) < 4 * 60) {
        throw new BadRequestException('Check-out is earlier than Check-in');
      }
    }
    if (dto.breakIn && dto.breakOut) {
      const bi = this.toMin(dto.breakIn);
      const bo = this.toMin(dto.breakOut);
      if (bi != null && bo != null && bo < bi) {
        throw new BadRequestException('Break-out is earlier than Break-in');
      }
    }

    // Auto-calc total hours from the four time fields unless the
    // caller explicitly passed workingHours.
    let workingHours = dto.workingHours ?? null;
    if (workingHours == null) {
      workingHours = this.calcWorkingHours(dto.checkIn, dto.checkOut, dto.breakIn, dto.breakOut);
    }
    // Statuses with no expected work hours force the total to 0 so
    // monthly totals don't accidentally count vacation/sick as worked.
    if (['OFF', 'VACATION', 'SICK', 'ABSENT', 'HOLIDAY', 'ON_LEAVE'].includes(dto.status)) {
      workingHours = 0;
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
        breakIn:      (dto as any).breakIn  ?? null,
        breakOut:     (dto as any).breakOut ?? null,
        workingHours: workingHours     ?? null,
        notes:        dto.notes        ?? null,
        createdById:  actorId          ?? null,
        updatedById:  null,
      },
      update: {
        status:       dto.status,
        checkIn:      dto.checkIn      ?? null,
        checkOut:     dto.checkOut     ?? null,
        breakIn:      (dto as any).breakIn  ?? null,
        breakOut:     (dto as any).breakOut ?? null,
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

    // Refuse writes into a locked month (based on the existing row's date).
    const existingDate = new Date(existing.date);
    const y = existingDate.getUTCFullYear();
    const m = existingDate.getUTCMonth() + 1;
    if (await this.isPeriodLocked(y, m)) {
      throw new BadRequestException(`Payroll period ${y}-${String(m).padStart(2, '0')} is locked`);
    }

    const newCheckIn  = dto.checkIn  !== undefined ? dto.checkIn  : existing.checkIn;
    const newCheckOut = dto.checkOut !== undefined ? dto.checkOut : existing.checkOut;
    const newBreakIn  = (dto as any).breakIn  !== undefined ? (dto as any).breakIn  : existing.breakIn;
    const newBreakOut = (dto as any).breakOut !== undefined ? (dto as any).breakOut : existing.breakOut;
    const newStatus   = dto.status   !== undefined ? dto.status   : existing.status;

    // Re-validate ordering with the merged values.
    if (newCheckIn && newCheckOut) {
      const ci = this.toMin(newCheckIn), co = this.toMin(newCheckOut);
      if (ci != null && co != null && co < ci && (ci - co) < 4 * 60) {
        throw new BadRequestException('Check-out is earlier than Check-in');
      }
    }
    if (newBreakIn && newBreakOut) {
      const bi = this.toMin(newBreakIn), bo = this.toMin(newBreakOut);
      if (bi != null && bo != null && bo < bi) {
        throw new BadRequestException('Break-out is earlier than Break-in');
      }
    }

    let workingHours = dto.workingHours;
    if (workingHours === undefined) {
      workingHours = this.calcWorkingHours(newCheckIn, newCheckOut, newBreakIn, newBreakOut) ?? undefined;
    }
    if (['OFF', 'VACATION', 'SICK', 'ABSENT', 'HOLIDAY', 'ON_LEAVE'].includes(newStatus)) {
      workingHours = 0;
    }

    const data: any = { updatedAt: new Date(), updatedById: actorId ?? null };
    if (dto.status       !== undefined) data.status       = dto.status;
    if (dto.checkIn      !== undefined) data.checkIn      = dto.checkIn;
    if (dto.checkOut     !== undefined) data.checkOut     = dto.checkOut;
    if ((dto as any).breakIn  !== undefined) data.breakIn  = (dto as any).breakIn;
    if ((dto as any).breakOut !== undefined) data.breakOut = (dto as any).breakOut;
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

    const existingDate = new Date(existing.date);
    const y = existingDate.getUTCFullYear();
    const m = existingDate.getUTCMonth() + 1;
    if (await this.isPeriodLocked(y, m)) {
      throw new BadRequestException(`Payroll period ${y}-${String(m).padStart(2, '0')} is locked`);
    }

    await (this.prisma as any).attendanceRecord.delete({ where: { id } });

    await this.auditLog(actorId, 'ATTENDANCE_DELETED', id, {
      employeeId: existing.employeeId,
      date:       existing.date,
      status:     existing.status,
    });

    return { message: 'Attendance record deleted' };
  }

  // ── Excel Export (Zeiterfassung template) ──────────────────────────────────

  /** Builds one Zeiterfassung sheet per employee in the workbook,
   *  matching the structure of the supplied template:
   *    row 1       : title "Zeiterfassung" (merged)
   *    row 2       : Zamestnanec / employee name
   *    row 3       : Mitarbeiter, Monat/Jahr — month + year label
   *    rows 4-5    : bilingual column headers
   *    rows 6..    : one row per day of the month (check-in, out,
   *                  break-in, out, 2nd-session in/out reserved,
   *                  total)
   *    totals rows : Odpracované (working), sviatok (holiday),
   *                  Spolu Odpracovan (working + holiday),
   *                  dovolenka (vacation), absencia (absence),
   *                  choroba (sick), Spolu (grand total all hours)
   */
  private buildZeiterfassungSheet(
    workbook: ExcelJS.Workbook,
    employee: { firstName: string; lastName: string; employeeNumber?: string | null },
    month: number, year: number,
    dayMap: Map<number, any>,
  ) {
    const MONTH_SK = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    const daysInMonth = new Date(year, month, 0).getDate();
    const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(' ');
    const monthLabel = `${MONTH_SK[month - 1]} ${year}`;
    const sheetName = `${MONTH_SK[month - 1]} ${year}`.slice(0, 31);

    const sheet = workbook.addWorksheet(sheetName, {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    });

    // Column widths tuned to the reference template.
    sheet.columns = [
      { width: 5 }, { width: 9 }, { width: 9 },
      { width: 11 }, { width: 11 },
      { width: 11 }, { width: 11 },
      { width: 10 },
    ];

    // Row 1 — title.
    sheet.mergeCells('A1:H1');
    const title = sheet.getCell('A1');
    title.value     = 'Zeiterfassung';
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.font      = { bold: true, size: 20, color: { argb: 'FF1E3A8A' } };
    sheet.getRow(1).height = 28;

    // Row 2 — employee.
    sheet.getCell('A2').value = 'Zamestnanec';
    sheet.getCell('A2').font  = { bold: true, size: 9 };
    sheet.mergeCells('B2:D2');
    sheet.getCell('B2').value = fullName || '';

    // Row 3 — month/year label.
    sheet.getCell('A3').value = 'Mitarbeiter, Monat/Jahr';
    sheet.getCell('A3').font  = { bold: true, size: 9 };
    sheet.mergeCells('B3:D3');
    sheet.getCell('B3').value = monthLabel;

    // Rows 4-5 — bilingual headers (Slovak / German stacked).
    const headerRow1 = ['den', 'zac', 'kon', 'zac pres', 'kon pres', 'zac prer', 'kon prer', 'total'];
    const headerRow2 = ['tag', 'beginn', 'ende', 'beginn pause', 'ende pause', 'beginn untrbr', 'ende untrbr', 'total'];
    headerRow1.forEach((t, i) => {
      const cell = sheet.getCell(4, i + 1);
      cell.value = t;
      cell.font  = { bold: true, size: 9, color: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow2.forEach((t, i) => {
      const cell = sheet.getCell(5, i + 1);
      cell.value = t;
      cell.font  = { italic: true, size: 8, color: { argb: 'FF64748B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sheet.getRow(4).height = 18;
    sheet.getRow(5).height = 14;

    // Rows 6..(5 + daysInMonth) — daily data.
    const dailyStart = 6;
    const dailyEnd   = dailyStart + daysInMonth - 1;
    let totalWorked  = 0;   // PRESENT hours
    let totalHoliday = 0;   // HOLIDAY legacy hours (sviatok)
    let totalVacation = 0;  // VACATION days × 8h
    let totalAbsent   = 0;  // ABSENT days × 8h
    let totalSick     = 0;  // SICK days × 8h

    for (let d = 1; d <= daysInMonth; d++) {
      const rec = dayMap.get(d);
      const r   = dailyStart + d - 1;
      sheet.getCell(r, 1).value = d;
      sheet.getCell(r, 1).alignment = { horizontal: 'center' };
      sheet.getCell(r, 1).font = { size: 9 };

      if (rec && rec.status === 'PRESENT') {
        sheet.getCell(r, 2).value = rec.checkIn  ?? '';
        sheet.getCell(r, 3).value = rec.checkOut ?? '';
        sheet.getCell(r, 4).value = rec.breakIn  ?? '';
        sheet.getCell(r, 5).value = rec.breakOut ?? '';
        const hours = Number(rec.workingHours ?? 0);
        if (hours > 0) {
          sheet.getCell(r, 8).value = this.hoursAsClock(hours);
          totalWorked += hours;
        } else {
          sheet.getCell(r, 8).value = '0:00';
        }
      } else if (rec && rec.status === 'HOLIDAY') {
        sheet.getCell(r, 8).value = '8:00';
        totalHoliday += 8;
      } else if (rec && rec.status === 'VACATION') {
        sheet.getCell(r, 8).value = '8:00';
        totalVacation += 8;
      } else if (rec && rec.status === 'ABSENT') {
        sheet.getCell(r, 8).value = '8:00';
        totalAbsent += 8;
      } else if (rec && rec.status === 'SICK') {
        sheet.getCell(r, 8).value = '8:00';
        totalSick += 8;
      } else {
        // Off / no record — show zero times so the grid matches the
        // reference template where weekends render as 0:00 rather
        // than blank.
        sheet.getCell(r, 2).value = '0:00';
        sheet.getCell(r, 3).value = '0:00';
        sheet.getCell(r, 4).value = '0:00';
        sheet.getCell(r, 5).value = '0:00';
        sheet.getCell(r, 8).value = '0:00';
      }

      // Formatting — small monospaced font, light row separators.
      for (let c = 2; c <= 8; c++) {
        const cell = sheet.getCell(r, c);
        cell.font      = { size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      sheet.getRow(r).height = 15;
    }

    // Totals block — two rows below the daily grid.
    const totalsStart = dailyEnd + 4;
    const setTotal = (row: number, label: string, value: string, tone?: 'blue' | 'red') => {
      const labelCell = sheet.getCell(row, 2);
      labelCell.value = label;
      labelCell.font  = { bold: true, size: 9 };
      const valueCell = sheet.getCell(row, 6);
      valueCell.value = 'Odpracované';
      valueCell.font  = { bold: true, size: 9 };
      const totalCell = sheet.getCell(row, 8);
      totalCell.value = value;
      totalCell.alignment = { horizontal: 'right' };
      totalCell.font      = {
        bold: true, size: 10,
        color: tone === 'blue' ? { argb: 'FF1E40AF' } : tone === 'red' ? { argb: 'FFB91C1C' } : undefined,
      };
    };
    // Row: Odpracované (worked)
    sheet.getCell(totalsStart, 2).value = 'Odpracované';
    sheet.getCell(totalsStart, 2).font = { bold: true, size: 9 };
    sheet.getCell(totalsStart, 8).value = this.hoursAsClock(totalWorked);
    sheet.getCell(totalsStart, 8).font = { bold: true };
    sheet.getCell(totalsStart, 8).alignment = { horizontal: 'right' };
    // Row: sviatok (holiday)
    sheet.getCell(totalsStart + 1, 6).value = 'sviatok';
    sheet.getCell(totalsStart + 1, 6).font = { size: 9 };
    sheet.getCell(totalsStart + 1, 8).value = this.hoursAsClock(totalHoliday);
    sheet.getCell(totalsStart + 1, 8).font = { color: { argb: 'FF7C3AED' } };
    sheet.getCell(totalsStart + 1, 8).alignment = { horizontal: 'right' };
    // Row: Spolu Odpracovan (working + holiday)
    sheet.getCell(totalsStart + 2, 6).value = 'Spolu Odpracovan';
    sheet.getCell(totalsStart + 2, 6).font = { bold: true, size: 9 };
    sheet.getCell(totalsStart + 2, 8).value = this.hoursAsClock(totalWorked + totalHoliday);
    sheet.getCell(totalsStart + 2, 8).font = { bold: true };
    sheet.getCell(totalsStart + 2, 8).alignment = { horizontal: 'right' };
    // Row: dovolenka (vacation)
    sheet.getCell(totalsStart + 3, 6).value = 'dovolenka';
    sheet.getCell(totalsStart + 3, 6).font = { size: 9 };
    sheet.getCell(totalsStart + 3, 8).value = this.hoursAsClock(totalVacation);
    sheet.getCell(totalsStart + 3, 8).font = { color: { argb: 'FFB91C1C' } };
    sheet.getCell(totalsStart + 3, 8).alignment = { horizontal: 'right' };
    // Row: absencia (absence)
    sheet.getCell(totalsStart + 4, 6).value = 'absencia';
    sheet.getCell(totalsStart + 4, 6).font = { size: 9 };
    sheet.getCell(totalsStart + 4, 8).value = this.hoursAsClock(totalAbsent);
    sheet.getCell(totalsStart + 4, 8).font = { color: { argb: 'FFB91C1C' } };
    sheet.getCell(totalsStart + 4, 8).alignment = { horizontal: 'right' };
    // Row: choroba (sick)
    sheet.getCell(totalsStart + 5, 6).value = 'choroba';
    sheet.getCell(totalsStart + 5, 6).font = { size: 9 };
    sheet.getCell(totalsStart + 5, 8).value = this.hoursAsClock(totalSick);
    sheet.getCell(totalsStart + 5, 8).font = { color: { argb: 'FFB91C1C' } };
    sheet.getCell(totalsStart + 5, 8).alignment = { horizontal: 'right' };
    // Row: Spolu (grand total — working + holiday + vacation + absence + sick)
    sheet.getCell(totalsStart + 6, 6).value = 'Spolu';
    sheet.getCell(totalsStart + 6, 6).font = { bold: true, size: 10 };
    sheet.getCell(totalsStart + 6, 8).value = this.hoursAsClock(
      totalWorked + totalHoliday + totalVacation + totalAbsent + totalSick,
    );
    sheet.getCell(totalsStart + 6, 8).font = { bold: true, size: 10 };
    sheet.getCell(totalsStart + 6, 8).alignment = { horizontal: 'right' };

    // Signature label at the bottom so the printed sheet looks like
    // the reference template's "podpis / Unterschrift" section.
    const sigRow = totalsStart + 9;
    sheet.getCell(sigRow, 2).value = 'podpis';
    sheet.getCell(sigRow, 2).font  = { size: 9, color: { argb: 'FF1E40AF' } };
    sheet.getCell(sigRow + 1, 2).value = 'Unterschrift';
    sheet.getCell(sigRow + 1, 2).font  = { italic: true, size: 8, color: { argb: 'FF64748B' } };
  }

  /** Formats a decimal hours value as "H:MM" (e.g. 8.5 → "8:30"). */
  private hoursAsClock(hours: number): string {
    if (!Number.isFinite(hours) || hours <= 0) return '0:00';
    const totalMin = Math.round(hours * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

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

    // ── Primary output: one Zeiterfassung sheet per employee,
    //    matching the reference payroll template. For multi-employee
    //    exports we still include the summary sheet below so HR can
    //    see every driver at a glance.
    for (const emp of employees) {
      const dayMap = recordMap.get(emp.id) ?? new Map<number, any>();
      this.buildZeiterfassungSheet(workbook, emp, month, year, dayMap);
    }

    // ── Secondary summary sheet — only when the caller asked for
    //    a whole-org export. Skipped for single-employee so the
    //    generated file stays clean (it matches the template exactly).
    if (dto.employeeId) {
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    }

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

  /**
   * Total Hours = (checkOut - checkIn) - (breakOut - breakIn)
   *
   * Invariants enforced here:
   *  • checkIn / checkOut are both required for any positive total;
   *    missing either returns null (status-only rows like Off / Sick).
   *  • Overnight shifts are supported (checkOut < checkIn wraps
   *    through midnight).
   *  • Partial or invalid break times are silently ignored rather than
   *    throwing — UI validators enforce ordering at entry time.
   *  • Result clamped at 0 so a too-large break never produces
   *    negative hours in reports.
   */
  private toMin(t?: string | null): number | null {
    if (!t) return null;
    const [hStr, mStr] = t.split(':');
    const h = Number(hStr), m = Number(mStr);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  private calcWorkingHours(
    checkIn?: string | null,
    checkOut?: string | null,
    breakIn?: string | null,
    breakOut?: string | null,
  ): number | null {
    const toMin = (t?: string | null) => this.toMin(t);
    const ci = toMin(checkIn);
    const co = toMin(checkOut);
    if (ci == null || co == null) return null;

    // Overnight shift — wrap through midnight.
    let shiftMin = co >= ci ? co - ci : (24 * 60 - ci) + co;

    const bi = toMin(breakIn);
    const bo = toMin(breakOut);
    if (bi != null && bo != null && bo > bi) {
      shiftMin -= (bo - bi);
    }

    if (shiftMin < 0) shiftMin = 0;
    return Math.round((shiftMin / 60) * 100) / 100;
  }

  // ── Lock periods ─────────────────────────────────────────────────────────────

  /** True if the (year, month) is locked and therefore read-only. */
  async isPeriodLocked(year: number, month: number): Promise<boolean> {
    try {
      const row = await (this.prisma as any).attendanceLockedPeriod.findUnique({
        where: { year_month: { year, month } },
        select: { id: true },
      });
      return !!row;
    } catch {
      // Prisma client may not know about the new model on first boot
      // — fail-open rather than blocking writes.
      return false;
    }
  }

  /** Throws if the given YYYY-MM-DD falls in a locked month. */
  private async assertPeriodUnlocked(dateStr: string): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    const y = Number(dateStr.slice(0, 4));
    const m = Number(dateStr.slice(5, 7));
    if (await this.isPeriodLocked(y, m)) {
      throw new BadRequestException(`Payroll period ${y}-${String(m).padStart(2, '0')} is locked`);
    }
  }

  async listLockedPeriods() {
    try {
      return await (this.prisma as any).attendanceLockedPeriod.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: { lockedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });
    } catch {
      return [];
    }
  }

  async lockPeriod(dto: LockPeriodDto, actorId?: string) {
    const existing = await (this.prisma as any).attendanceLockedPeriod.findUnique({
      where: { year_month: { year: dto.year, month: dto.month } },
    });
    if (existing) throw new BadRequestException('Period is already locked');
    const row = await (this.prisma as any).attendanceLockedPeriod.create({
      data: { year: dto.year, month: dto.month, reason: dto.reason, lockedById: actorId ?? null },
      include: { lockedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    await this.auditLog(actorId, 'ATTENDANCE_PERIOD_LOCKED', row.id, { year: dto.year, month: dto.month });
    return row;
  }

  async unlockPeriod(id: string, actorId?: string) {
    const existing = await (this.prisma as any).attendanceLockedPeriod.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Locked period not found');
    await (this.prisma as any).attendanceLockedPeriod.delete({ where: { id } });
    await this.auditLog(actorId, 'ATTENDANCE_PERIOD_UNLOCKED', id, {
      year: existing.year, month: existing.month,
    });
    return { message: 'Period unlocked' };
  }

  // ── Bulk apply ──────────────────────────────────────────────────────────────

  /**
   * Applies one status + time template to a date range or explicit
   * date list. Respects the lock table (skips locked dates) and the
   * overwriteExisting flag (skips dates with existing records when
   * false). Returns per-date outcomes so the UI can render a summary.
   */
  async bulkApply(dto: BulkApplyAttendanceDto, actorId?: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException(`Employee ${dto.employeeId} not found`);

    // Expand the target date set.
    let dates: string[] = [];
    if (Array.isArray(dto.dates) && dto.dates.length > 0) {
      dates = [...new Set(dto.dates)].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    } else if (dto.dateFrom && dto.dateTo) {
      const from = new Date(dto.dateFrom + 'T00:00:00.000Z');
      const to   = new Date(dto.dateTo   + 'T00:00:00.000Z');
      if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
        throw new BadRequestException('Invalid dateFrom / dateTo range');
      }
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        if (dto.skipWeekends) {
          const dow = d.getUTCDay();
          if (dow === 0 || dow === 6) continue;
        }
        dates.push(d.toISOString().slice(0, 10));
      }
    } else {
      throw new BadRequestException('Provide either `dates` or both `dateFrom` and `dateTo`');
    }
    if (dates.length === 0) throw new BadRequestException('No dates to process');
    if (dates.length > 366) throw new BadRequestException('Refusing to process more than 366 dates in one call');

    const overwrite = dto.overwriteExisting !== false;
    const results: Array<{ date: string; outcome: 'created' | 'updated' | 'skipped_existing' | 'skipped_locked' | 'error'; error?: string }> = [];

    for (const dateStr of dates) {
      try {
        const y = Number(dateStr.slice(0, 4));
        const m = Number(dateStr.slice(5, 7));
        if (await this.isPeriodLocked(y, m)) {
          results.push({ date: dateStr, outcome: 'skipped_locked' });
          continue;
        }
        const dateObj = new Date(dateStr + 'T00:00:00.000Z');
        const existing = await (this.prisma as any).attendanceRecord.findUnique({
          where: { employeeId_date: { employeeId: dto.employeeId, date: dateObj } },
          select: { id: true },
        });
        if (existing && !overwrite) {
          results.push({ date: dateStr, outcome: 'skipped_existing' });
          continue;
        }
        await this.upsertRecord({
          employeeId: dto.employeeId,
          date: dateStr,
          status: dto.status,
          checkIn:  dto.checkIn,
          checkOut: dto.checkOut,
          breakIn:  dto.breakIn,
          breakOut: dto.breakOut,
          notes:    dto.notes,
        } as any, actorId);
        results.push({ date: dateStr, outcome: existing ? 'updated' : 'created' });
      } catch (err: any) {
        results.push({ date: dateStr, outcome: 'error', error: err?.message ?? 'Unknown error' });
      }
    }

    const summary = {
      requested: dates.length,
      created:          results.filter(r => r.outcome === 'created').length,
      updated:          results.filter(r => r.outcome === 'updated').length,
      skipped_existing: results.filter(r => r.outcome === 'skipped_existing').length,
      skipped_locked:   results.filter(r => r.outcome === 'skipped_locked').length,
      errors:           results.filter(r => r.outcome === 'error').length,
    };
    await this.auditLog(actorId, 'ATTENDANCE_BULK_APPLY', dto.employeeId, { ...summary, status: dto.status });
    return { summary, results };
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
