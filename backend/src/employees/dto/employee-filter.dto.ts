import { IsOptional, IsEnum, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { EmployeeStatusEnum } from './create-employee.dto';

export class EmployeeFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EmployeeStatusEnum }) @IsOptional() @IsEnum(EmployeeStatusEnum) status?: EmployeeStatusEnum;
  @ApiPropertyOptional({ description: 'Agency UUID' }) @IsOptional() @IsUUID() agencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nationality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() licenseCategory?: string;
}
