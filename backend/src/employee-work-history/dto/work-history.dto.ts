import { IsOptional, IsString, IsNotEmpty, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Legacy built-in values — only kept as Swagger hints. The canonical
// list lives in the work_history_event_types settings table and is
// validated at the service layer against whatever rows are active.
export const WORK_HISTORY_EVENT_TYPES = [
  'NEW_CONTRACT',
  'PROBATION_START',
  'PROBATION_END',
  'END_OF_CONTRACT',
  'UNPAID_LEAVE_START',
  'UNPAID_LEAVE_END',
  'TERMINATED',
] as const;
export type WorkHistoryEventTypeValue = string;

export class CreateWorkHistoryDto {
  @ApiProperty({ description: 'Date of the event (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Event type value. Must match an active value from /settings/work-history-event-types.',
    example: WORK_HISTORY_EVENT_TYPES[0],
  })
  @IsString() @IsNotEmpty()
  eventType: string;

  @ApiPropertyOptional({ description: 'Free-text notes. Optional — the event type alone often tells the whole story.' })
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'User UUID who approved / signed off on the event' })
  @IsOptional() @IsUUID()
  approvedById?: string;
}

export class UpdateWorkHistoryDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() eventType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() approvedById?: string;
}
