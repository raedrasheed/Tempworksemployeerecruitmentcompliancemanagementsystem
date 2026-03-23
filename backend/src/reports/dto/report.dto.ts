import {
  IsString, IsOptional, IsBoolean, IsInt, IsIn, IsArray,
  ValidateNested, Min, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Filter ──────────────────────────────────────────────────────────────────

export class ReportFilterDto {
  @ApiProperty() @IsString() fieldName: string;

  @ApiProperty({
    enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'between', 'in', 'is_null', 'is_not_null'],
  })
  @IsIn(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'between', 'in', 'is_null', 'is_not_null'])
  operator: string;

  @ApiPropertyOptional() @IsOptional() @IsString() value?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() value2?: string;

  @ApiPropertyOptional({ enum: ['string', 'number', 'date', 'boolean'] })
  @IsOptional()
  @IsIn(['string', 'number', 'date', 'boolean'])
  valueType?: string;
}

// ─── Column ──────────────────────────────────────────────────────────────────

export class ReportColumnDto {
  @ApiProperty() @IsString() columnName: string;
  @ApiProperty() @IsString() displayName: string;

  @ApiPropertyOptional({ enum: ['string', 'number', 'date', 'boolean', 'enum'] })
  @IsOptional()
  @IsIn(['string', 'number', 'date', 'boolean', 'enum'])
  dataType?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isGrouped?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isAggregated?: boolean;

  @ApiPropertyOptional({ enum: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] })
  @IsOptional()
  @IsIn(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'])
  aggregationType?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) position?: number;
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

export class ReportSortingDto {
  @ApiProperty() @IsString() columnName: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  direction?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) position?: number;
}

// ─── Create / Update Report ───────────────────────────────────────────────────

export class CreateReportDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty({
    enum: ['employees', 'applicants', 'documents', 'compliance_alerts', 'agencies', 'work_permits'],
  })
  @IsIn(['employees', 'applicants', 'documents', 'compliance_alerts', 'agencies', 'work_permits'])
  dataSource: string;

  @ApiPropertyOptional({ type: [ReportFilterDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  filters?: ReportFilterDto[];

  @ApiPropertyOptional({ type: [ReportColumnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportColumnDto)
  columns?: ReportColumnDto[];

  @ApiPropertyOptional({ type: [ReportSortingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportSortingDto)
  sorting?: ReportSortingDto[];
}

export class UpdateReportDto extends CreateReportDto {}

// ─── Run / Export ─────────────────────────────────────────────────────────────

export class RunReportDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) limit?: number;
}

export enum ExportFormat {
  EXCEL = 'excel',
  PDF = 'pdf',
  WORD = 'word',
}

export class ExportReportDto {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat)
  format: ExportFormat;
}
