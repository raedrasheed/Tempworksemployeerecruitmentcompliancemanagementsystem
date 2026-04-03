import {
  IsString, IsOptional, IsNumber, Min, IsIn, IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CONTRACT_TYPES, JOB_CATEGORIES, COMMON_CURRENCIES } from '../constants';

export class CreateJobAdDto {
  @ApiProperty({ example: 'Truck Driver – CE Licence Required' })
  @IsString() @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'URL slug. Auto-generated from title if omitted.',
    example: 'truck-driver-ce-licence-required',
  })
  @IsOptional() @IsString()
  slug?: string;

  @ApiProperty({ enum: JOB_CATEGORIES, example: 'Truck Driver' })
  @IsString() @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'We are looking for an experienced CE truck driver…' })
  @IsString() @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'Warsaw' })
  @IsString() @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Poland' })
  @IsString() @IsNotEmpty()
  country: string;

  @ApiPropertyOptional({ enum: CONTRACT_TYPES, default: 'Full-time' })
  @IsOptional() @IsString() @IsIn(CONTRACT_TYPES as unknown as string[])
  contractType?: string = 'Full-time';

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ example: 3500 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({ enum: COMMON_CURRENCIES, default: 'GBP' })
  @IsOptional() @IsString()
  currency?: string = 'GBP';

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT' })
  @IsOptional() @IsString() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: string = 'DRAFT';
}
