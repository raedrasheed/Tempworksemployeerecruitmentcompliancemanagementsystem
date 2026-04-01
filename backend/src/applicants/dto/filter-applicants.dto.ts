import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum ApplicantTierFilter {
  LEAD = 'LEAD',
  CANDIDATE = 'CANDIDATE',
}

export class FilterApplicantsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ApplicantTierFilter })
  @IsOptional()
  @IsEnum(ApplicantTierFilter)
  tier?: ApplicantTierFilter;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by agencyId' })
  @IsOptional()
  @IsString()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Filter by nationality' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ description: 'Filter by jobTypeId' })
  @IsOptional()
  @IsString()
  jobTypeId?: string;
}
