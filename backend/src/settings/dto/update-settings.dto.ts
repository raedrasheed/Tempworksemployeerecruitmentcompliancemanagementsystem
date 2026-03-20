import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() value?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class BatchUpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Key-value map of settings' })
  settings: Record<string, string>;
}
