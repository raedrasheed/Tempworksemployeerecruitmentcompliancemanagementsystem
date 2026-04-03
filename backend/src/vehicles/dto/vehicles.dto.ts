import {
  IsOptional, IsString, IsIn, IsInt, Min, IsUUID, IsBoolean,
  IsNumber, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const VEHICLE_TYPES = [
  'TRUCK', 'CAR', 'VAN', 'TANKER', 'TRAILER', 'REFRIGERATED_TRAILER', 'SPECIALTY',
] as const;

export const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE', 'IN_MAINTENANCE', 'SCRAPPED'] as const;
export const FUEL_TYPES = ['DIESEL', 'PETROL', 'ELECTRIC', 'HYBRID', 'GAS', 'OTHER'] as const;
export const MAINTENANCE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

// ─── Vehicle Filters ─────────────────────────────────────────────────────────

export class FilterVehiclesDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: VEHICLE_TYPES }) @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional({ enum: VEHICLE_STATUSES }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agencyId?: string;
  @ApiPropertyOptional({ description: 'Only vehicles with expiring docs in next N days' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) expiringInDays?: number;
}

// ─── Vehicle CRUD ─────────────────────────────────────────────────────────────

export class CreateVehicleDto {
  @ApiProperty({ enum: VEHICLE_TYPES }) @IsIn(VEHICLE_TYPES as unknown as string[]) type: string;
  @ApiProperty() @IsString() registrationNumber: string;
  @ApiProperty() @IsString() make: string;
  @ApiProperty() @IsString() model: string;
  @ApiPropertyOptional({ enum: VEHICLE_STATUSES }) @IsOptional() @IsIn(VEHICLE_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vin?: string;
  @ApiPropertyOptional({ enum: FUEL_TYPES }) @IsOptional() @IsIn(FUEL_TYPES as unknown as string[]) fuelType?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() currentMileage?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() motExpiryDate?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() taxExpiryDate?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() insuranceExpiryDate?: string;
  // Type-specific
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() grossWeight?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() payloadCapacity?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() numberOfAxles?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() tankerCapacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() refrigerationUnit?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() trailerLength?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() agencyId?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional({ enum: VEHICLE_TYPES }) @IsOptional() @IsIn(VEHICLE_TYPES as unknown as string[]) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() registrationNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() make?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() model?: string;
  @ApiPropertyOptional({ enum: VEHICLE_STATUSES }) @IsOptional() @IsIn(VEHICLE_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vin?: string;
  @ApiPropertyOptional({ enum: FUEL_TYPES }) @IsOptional() @IsIn(FUEL_TYPES as unknown as string[]) fuelType?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() currentMileage?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() motExpiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxExpiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() insuranceExpiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() grossWeight?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() payloadCapacity?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() numberOfAxles?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() tankerCapacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() refrigerationUnit?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() trailerLength?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() agencyId?: string;
}

// ─── Driver Assignment ────────────────────────────────────────────────────────

export class AssignDriverDto {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty({ description: 'YYYY-MM-DD' }) @IsString() startDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

// ─── Vehicle Documents ────────────────────────────────────────────────────────

export class CreateVehicleDocumentDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() documentType: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fileUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fileName?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() fileSize?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateVehicleDocumentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documentType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

// ─── Maintenance Types ────────────────────────────────────────────────────────

export class CreateMaintenanceTypeDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() defaultIntervalDays?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() defaultIntervalKm?: number;
}

export class UpdateMaintenanceTypeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() defaultIntervalDays?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() defaultIntervalKm?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() isActive?: boolean;
}

// ─── Workshops ────────────────────────────────────────────────────────────────

export class CreateWorkshopDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateWorkshopDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() isActive?: boolean;
}

// ─── Maintenance Records ──────────────────────────────────────────────────────

export class SparePartDto {
  @ApiProperty() @IsString() partName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() partNumber?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() unitCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() supplier?: string;
}

export class CreateMaintenanceRecordDto {
  @ApiProperty() @IsUUID() vehicleId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() maintenanceTypeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
  @ApiPropertyOptional({ enum: MAINTENANCE_STATUSES }) @IsOptional() @IsIn(MAINTENANCE_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scheduledDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() completedDate?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() mileageAtService?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() nextServiceDate?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() nextServiceMileage?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() cost?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() laborCost?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() partsCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() technicianName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() invoiceNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ type: [SparePartDto] }) @IsOptional() spareParts?: SparePartDto[];
}

export class UpdateMaintenanceRecordDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() maintenanceTypeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
  @ApiPropertyOptional({ enum: MAINTENANCE_STATUSES }) @IsOptional() @IsIn(MAINTENANCE_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scheduledDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() completedDate?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() mileageAtService?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() nextServiceDate?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() nextServiceMileage?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() cost?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() laborCost?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() partsCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() technicianName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() invoiceNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ type: [SparePartDto] }) @IsOptional() spareParts?: SparePartDto[];
}

export class FilterMaintenanceDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
  @ApiPropertyOptional({ enum: MAINTENANCE_STATUSES }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateTo?: string;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export class ExportVehiclesDto {
  @ApiPropertyOptional({ enum: VEHICLE_TYPES }) @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional({ enum: VEHICLE_STATUSES }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ description: 'csv or excel' }) @IsOptional() @IsString() format?: string;
}
