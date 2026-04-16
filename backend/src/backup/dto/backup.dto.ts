import { IsOptional, IsString, IsIn, IsBoolean } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ── Restore modes ─────────────────────────────────────────────────────────────

export enum RestoreMode {
  /** Drop all DB objects, recreate from backup — pg_restore --clean --if-exists */
  FULL = 'FULL',
  /** Restore data only; current schema must match backup schema */
  DATA_ONLY = 'DATA_ONLY',
  /** TRUNCATE all tables (cascade), then restore data — safest for data refresh */
  CLEAN = 'CLEAN',
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export class CreateBackupDto {
  @ApiPropertyOptional({ description: 'Optional label / notes for this backup' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListBackupsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status (PENDING|RUNNING|COMPLETED|FAILED)' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class RestoreBackupDto {
  @ApiProperty({
    enum: RestoreMode,
    description:
      'FULL = drop + recreate all objects from backup; ' +
      'DATA_ONLY = restore row data only (schema must match); ' +
      'CLEAN = truncate all tables, then restore data',
  })
  @IsIn([RestoreMode.FULL, RestoreMode.DATA_ONLY, RestoreMode.CLEAN])
  restoreMode: RestoreMode;

  @ApiProperty({ description: 'Must equal "RESTORE DATABASE" to confirm destructive operation' })
  @IsString()
  confirmPhrase: string;

  @ApiPropertyOptional({ description: 'Optional reason / notes for the restore operation' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'When true, skip creating an automatic pre-restore safety backup. ' +
      'Default false — a safety backup is always created before restoring.',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  skipSafetyBackup?: boolean;
}
