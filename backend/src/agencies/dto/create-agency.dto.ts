import { IsString, IsEmail, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateAgencyDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() country: string;
  @ApiProperty() @IsString() contactPerson: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() phone: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) status?: string;
  @ApiPropertyOptional({ description: 'Maximum number of users allowed for this agency', default: 10 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxUsersPerAgency?: number;
}
