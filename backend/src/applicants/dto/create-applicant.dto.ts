import {
  IsString, IsEmail, IsOptional, IsEnum, IsDateString,
  IsBoolean, IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApplicantStatusEnum {
  NEW = 'NEW', SCREENING = 'SCREENING', INTERVIEW = 'INTERVIEW',
  OFFER = 'OFFER', ACCEPTED = 'ACCEPTED', REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN', ONBOARDING = 'ONBOARDING',
}

export class CreateApplicantDto {
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() phone: string;
  @ApiProperty() @IsString() nationality: string;
  @ApiPropertyOptional({ example: '1990-01-15' }) @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional({ enum: ApplicantStatusEnum }) @IsOptional() @IsEnum(ApplicantStatusEnum) status?: ApplicantStatusEnum;
  @ApiPropertyOptional() @IsOptional() @IsUUID() jobTypeId?: string;
  @ApiProperty({ example: 'UK Citizen' }) @IsString() residencyStatus: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasNationalInsurance?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() nationalInsuranceNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasWorkAuthorization?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() workAuthorizationType?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() workAuthorizationExpiry?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() preferredStartDate?: string;
  @ApiProperty({ example: 'Immediate' }) @IsString() availability: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() willingToRelocate?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() preferredLocations?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() salaryExpectation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
