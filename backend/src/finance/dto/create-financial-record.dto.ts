import {
  IsString, IsOptional, IsNumber, Min, IsDateString,
  IsIn, IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TRANSACTION_TYPES, PAYMENT_METHODS } from '../constants';

export class CreateFinancialRecordDto {
  @ApiProperty({ description: "'APPLICANT' or 'EMPLOYEE'" })
  @IsString() @IsIn(['APPLICANT', 'EMPLOYEE'])
  entityType: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  entityId: string;

  @ApiProperty({ example: '2026-04-02' })
  @IsDateString()
  transactionDate: string;

  @ApiPropertyOptional({ default: 'EUR' })
  @IsOptional() @IsString()
  currency?: string = 'EUR';

  @ApiProperty({ enum: TRANSACTION_TYPES })
  @IsString() @IsIn(TRANSACTION_TYPES as unknown as string[])
  transactionType: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional() @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Display name of the person who paid/recorded' })
  @IsOptional() @IsString()
  paidByName?: string;

  @ApiPropertyOptional({ description: 'User ID (FK to users table)' })
  @IsOptional() @IsString()
  paidById?: string;

  @ApiProperty({
    description: 'Amount disbursed/paid BY the company for/to the person. Included in balance.',
    example: 250.00,
  })
  @Type(() => Number) @IsNumber() @Min(0)
  companyDisbursedAmount: number;

  @ApiPropertyOptional({
    description: 'Amount paid BY the employee or their agency. Informational only — NOT included in balance.',
    example: 0,
  })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  employeeOrAgencyPaidAmount?: number = 0;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
