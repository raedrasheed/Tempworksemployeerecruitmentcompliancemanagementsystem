import { IsString, IsOptional, IsBoolean, IsHexColor, MaxLength, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePipelineDto {
  @ApiProperty() @IsString() @MaxLength(120) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
}

export class CreatePipelineStageDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() order: number;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() slaHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFinal?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsUUID('4', { each: true }) assignedUserIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsUUID('4', { each: true }) requiredDocTypeIds?: string[];
}

export class UpdatePipelineStageProgressDto {
  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'SKIPPED', 'BLOCKED'] })
  @IsString() status: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() flagged?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() flagReason?: string;
}

export class CreateStageNoteDto {
  @ApiProperty() @IsString() content: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrivate?: boolean;
}

export class CreateStageApprovalDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] }) @IsString() decision: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class AssignCandidateToPipelineDto {
  @ApiProperty() @IsUUID() candidateId: string;
  @ApiProperty() @IsUUID() pipelineId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
