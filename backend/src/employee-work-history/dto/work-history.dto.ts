import { IsOptional, IsString, IsIn, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const WORK_HISTORY_EVENT_TYPES = [
  'NEW_CONTRACT',
  'PROBATION_START',
  'PROBATION_END',
  'END_OF_CONTRACT',
  'UNPAID_LEAVE_START',
  'UNPAID_LEAVE_END',
  'TERMINATED',
] as const;
export type WorkHistoryEventTypeValue = typeof WORK_HISTORY_EVENT_TYPES[number];

export class CreateWorkHistoryDto {
  @ApiProperty({ description: 'Date of the event (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ enum: WORK_HISTORY_EVENT_TYPES })
  @IsIn(WORK_HISTORY_EVENT_TYPES as unknown as string[])
  eventType: string;

  @ApiPropertyOptional({ description: 'Free-text notes. Optional — the event type alone often tells the whole story (e.g. TERMINATED).' })
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'User UUID who approved / signed off on the event' })
  @IsOptional() @IsUUID()
  approvedById?: string;
}

export class UpdateWorkHistoryDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
  @ApiPropertyOptional({ enum: WORK_HISTORY_EVENT_TYPES })
  @IsOptional() @IsIn(WORK_HISTORY_EVENT_TYPES as unknown as string[])
  eventType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() approvedById?: string;
}
