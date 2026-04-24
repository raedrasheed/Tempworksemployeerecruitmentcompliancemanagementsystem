import { IsOptional, IsString, IsIn, IsInt, Min, Max, IsUUID, IsBoolean, ArrayNotEmpty, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

// The five canonical statuses the UI exposes. Legacy statuses
// (LATE / ON_LEAVE / HALF_DAY / HOLIDAY) are accepted on read for
// backward compatibility with old rows but are not offered in the
// status dropdown any more.
export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'OFF', 'VACATION', 'SICK'] as const;
export const LEGACY_ATTENDANCE_STATUSES = ['LATE', 'ON_LEAVE', 'HALF_DAY', 'HOLIDAY'] as const;
export const ALL_ATTENDANCE_STATUSES = [...ATTENDANCE_STATUSES, ...LEGACY_ATTENDANCE_STATUSES] as const;
export type AttendanceStatusType = typeof ATTENDANCE_STATUSES[number];

export class FilterAttendanceEmployeesDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ description: 'ISO date YYYY-MM-DD' }) @IsOptional() @IsString() dateFrom?: string;
  @ApiPropertyOptional({ description: 'ISO date YYYY-MM-DD' }) @IsOptional() @IsString() dateTo?: string;
  @ApiPropertyOptional({ description: 'Month 1-12' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
  @ApiPropertyOptional({ description: 'Year e.g. 2024' }) @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
  @ApiPropertyOptional({ enum: ATTENDANCE_STATUSES }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ description: 'Filter drivers only (has licenseNumber or licenseCategory)' })
  @IsOptional() @Transform(({ obj, key }) => { const v = obj?.[key]; return v === true || v === 'true'; }) @IsBoolean() driversOnly?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() agencyId?: string;
}

export class GetEmployeeAttendanceDto {
  @ApiPropertyOptional({ description: 'Month 1-12' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
  @ApiPropertyOptional({ description: 'Year e.g. 2024' }) @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateTo?: string;
}

export class UpsertAttendanceDto {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty({ description: 'Date YYYY-MM-DD' }) @IsString() date: string;
  @ApiProperty({ enum: ALL_ATTENDANCE_STATUSES }) @IsIn(ALL_ATTENDANCE_STATUSES as unknown as string[]) status: string;
  @ApiPropertyOptional({ description: 'HH:MM' }) @IsOptional() @IsString() checkIn?: string;
  @ApiPropertyOptional({ description: 'HH:MM' }) @IsOptional() @IsString() checkOut?: string;
  @ApiPropertyOptional({ description: 'HH:MM — start of mid-shift break' }) @IsOptional() @IsString() breakIn?: string;
  @ApiPropertyOptional({ description: 'HH:MM — end of mid-shift break'   }) @IsOptional() @IsString() breakOut?: string;
  /** Optional override. When null / omitted the service recomputes from checkIn/Out - breakIn/Out. */
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) workingHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateAttendanceDto {
  @ApiPropertyOptional({ enum: ALL_ATTENDANCE_STATUSES }) @IsOptional() @IsIn(ALL_ATTENDANCE_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() checkIn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() checkOut?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() breakIn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() breakOut?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) workingHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class BulkUpsertAttendanceDto {
  @ApiProperty({ type: [UpsertAttendanceDto] }) records: UpsertAttendanceDto[];
}

/** Applies one status + time template to every date in an inclusive
 *  range or explicit date list. Used by the "mark whole week as
 *  Present 08:00-16:30" flow. */
export class BulkApplyAttendanceDto {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty({ enum: ALL_ATTENDANCE_STATUSES }) @IsIn(ALL_ATTENDANCE_STATUSES as unknown as string[]) status: string;
  @ApiPropertyOptional({ description: 'Date YYYY-MM-DD (inclusive)' }) @IsOptional() @IsString() dateFrom?: string;
  @ApiPropertyOptional({ description: 'Date YYYY-MM-DD (inclusive)' }) @IsOptional() @IsString() dateTo?: string;
  @ApiPropertyOptional({ description: 'Explicit date list (YYYY-MM-DD). Takes precedence over dateFrom/dateTo.', type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true }) dates?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() checkIn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() checkOut?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() breakIn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() breakOut?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  /** If true, replace existing rows on the target dates; if false, skip them. */
  @ApiPropertyOptional({ default: true })
  @IsOptional() @Transform(({ obj, key }) => { const v = obj?.[key]; return v === undefined || v === true || v === 'true'; })
  @IsBoolean() overwriteExisting?: boolean;
  /** Skip weekends (Sat/Sun) when expanding dateFrom..dateTo. */
  @ApiPropertyOptional({ default: false })
  @IsOptional() @Transform(({ obj, key }) => { const v = obj?.[key]; return v === true || v === 'true'; })
  @IsBoolean() skipWeekends?: boolean;
}

export class ExportAttendanceDto {
  @ApiProperty({ description: 'Month 1-12' }) @Type(() => Number) @IsInt() @Min(1) @Max(12) month: number;
  @ApiProperty({ description: 'Year e.g. 2024' }) @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year: number;
  @ApiPropertyOptional({ description: 'Specific employee UUID for per-driver export' }) @IsOptional() @IsUUID() employeeId?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ obj, key }) => { const v = obj?.[key]; return v === true || v === 'true'; }) @IsBoolean() driversOnly?: boolean;
}

export class LockPeriodDto {
  @ApiProperty({ description: 'Year e.g. 2026' }) @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year: number;
  @ApiProperty({ description: 'Month 1-12' })    @Type(() => Number) @IsInt() @Min(1) @Max(12)     month: number;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
