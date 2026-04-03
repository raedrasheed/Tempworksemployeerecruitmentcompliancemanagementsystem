import { IsOptional, IsString, IsIn, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterJobAdsDto {
  @ApiPropertyOptional() @IsOptional() @IsNumberString()
  page?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumberString()
  limit?: number;

  @ApiPropertyOptional({ description: 'Full-text search on title, category, city, country, description' })
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional() @IsString() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  category?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  country?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  contractType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional() @IsIn(['asc', 'desc'])
  sortOrder?: string;
}
