import { IsString, IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApplicationStatusEnum {
  DRAFT = 'DRAFT', SUBMITTED = 'SUBMITTED', UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED', REJECTED = 'REJECTED', WITHDRAWN = 'WITHDRAWN',
}

export class CreateApplicationDto {
  @ApiProperty({ description: 'Applicant UUID' }) @IsUUID() applicantId: string;
  @ApiPropertyOptional({ enum: ApplicationStatusEnum }) @IsOptional() @IsEnum(ApplicationStatusEnum) status?: ApplicationStatusEnum;
  @ApiPropertyOptional() @IsOptional() @IsUUID() jobTypeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
