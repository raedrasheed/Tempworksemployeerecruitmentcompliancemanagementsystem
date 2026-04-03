import { IsString, IsOptional, IsBoolean, IsHexColor, MaxLength, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkflowDto {
  @ApiProperty() @IsString() @MaxLength(120) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
}

export class CreateWorkflowStageDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() slaHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFinal?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsUUID('4', { each: true }) assignedUserIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsUUID('4', { each: true }) requiredDocTypeIds?: string[];
}

export class UpdateWorkflowStageProgressDto {
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

export class AssignCandidateToWorkflowDto {
  @ApiProperty() @IsUUID() candidateId: string;
  @ApiProperty() @IsUUID() workflowId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
