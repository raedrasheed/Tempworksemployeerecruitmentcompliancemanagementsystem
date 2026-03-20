import { PartialType } from '@nestjs/swagger';
import { CreateApplicationDto } from './create-application.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {
  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  additionalNote?: string;
}
