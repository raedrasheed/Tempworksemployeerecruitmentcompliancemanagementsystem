import { IsOptional, IsString, IsIn, IsInt, Min, Max, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE', 'HALF_DAY', 'HOLIDAY'] as const;
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
  @ApiProperty({ enum: ATTENDANCE_STATUSES }) @IsIn(ATTENDANCE_STATUSES as unknown as string[]) status: string;
  @ApiPropertyOptional({ description: 'HH:MM' }) @IsOptional() @IsString() checkIn?: string;
  @ApiPropertyOptional({ description: 'HH:MM' }) @IsOptional() @IsString() checkOut?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) workingHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateAttendanceDto {
  @ApiPropertyOptional({ enum: ATTENDANCE_STATUSES }) @IsOptional() @IsIn(ATTENDANCE_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() checkIn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() checkOut?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) workingHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class BulkUpsertAttendanceDto {
  @ApiProperty({ type: [UpsertAttendanceDto] }) records: UpsertAttendanceDto[];
}

export class ExportAttendanceDto {
  @ApiProperty({ description: 'Month 1-12' }) @Type(() => Number) @IsInt() @Min(1) @Max(12) month: number;
  @ApiProperty({ description: 'Year e.g. 2024' }) @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year: number;
  @ApiPropertyOptional({ description: 'Specific employee UUID for per-driver export' }) @IsOptional() @IsUUID() employeeId?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ obj, key }) => { const v = obj?.[key]; return v === true || v === 'true'; }) @IsBoolean() driversOnly?: boolean;
}
