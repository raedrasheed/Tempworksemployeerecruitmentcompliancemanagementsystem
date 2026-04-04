import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, Res, Request,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import {
  FilterVehiclesDto,
  CreateVehicleDto,
  UpdateVehicleDto,
  AssignDriverDto,
  CreateVehicleDocumentDto,
  UpdateVehicleDocumentDto,
  CreateMaintenanceTypeDto,
  UpdateMaintenanceTypeDto,
  CreateWorkshopDto,
  UpdateWorkshopDto,
  CreateMaintenanceRecordDto,
  UpdateMaintenanceRecordDto,
  FilterMaintenanceDto,
  ExportVehiclesDto,
} from './dto/vehicles.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const READ_ROLES   = ['System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance'];
const WRITE_ROLES  = ['System Admin', 'HR Manager', 'Agency Manager'];
const EXPORT_ROLES = ['System Admin', 'HR Manager', 'Finance', 'Compliance Officer'];

/**
 * IMPORTANT — route ordering rule (Express/NestJS):
 * Static routes MUST be declared before parametric (:id) routes so they are
 * not swallowed. Order within this controller:
 *   1. Static collection routes (stats, export, maintenance/*, workshops/*)
 *   2. Parametric single-resource routes (:id, :vehicleId/*)
 */
@ApiTags('Vehicles')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  // ── 1. Static list / utility routes (must come before :id) ──────────────────

  @Get()
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'List all vehicles with filters' })
  list(@Query() dto: FilterVehiclesDto) {
    return this.vehiclesService.listVehicles(dto);
  }

  @Get('stats')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Get vehicle dashboard statistics' })
  getStats() {
    return this.vehiclesService.getDashboardStats();
  }

  @Get('export/excel')
  @Roles(...EXPORT_ROLES)
  @ApiOperation({ summary: 'Export vehicle list as Excel' })
  async exportExcel(@Query() dto: ExportVehiclesDto, @Res() res: Response) {
    const buffer = await this.vehiclesService.exportVehicles(dto);
    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="vehicles-${new Date().toISOString().split('T')[0]}.xlsx"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  // ── 2. Static sub-resource routes — maintenance (before :id) ────────────────

  @Get('maintenance/types')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'List all maintenance types' })
  listMaintenanceTypes() {
    return this.vehiclesService.listMaintenanceTypes();
  }

  @Post('maintenance/types')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Create a maintenance type' })
  createMaintenanceType(@Body() dto: CreateMaintenanceTypeDto) {
    return this.vehiclesService.createMaintenanceType(dto);
  }

  @Patch('maintenance/types/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update a maintenance type' })
  updateMaintenanceType(@Param('id') id: string, @Body() dto: UpdateMaintenanceTypeDto) {
    return this.vehiclesService.updateMaintenanceType(id, dto);
  }

  @Delete('maintenance/types/:id')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a maintenance type' })
  deleteMaintenanceType(@Param('id') id: string) {
    return this.vehiclesService.deleteMaintenanceType(id);
  }

  @Get('maintenance/records')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'List maintenance records with filters' })
  listMaintenance(@Query() dto: FilterMaintenanceDto) {
    return this.vehiclesService.listMaintenanceRecords(dto);
  }

  @Get('maintenance/records/:id')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Get a single maintenance record' })
  getMaintenance(@Param('id') id: string) {
    return this.vehiclesService.getMaintenanceRecord(id);
  }

  @Post('maintenance/records')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Create a maintenance record' })
  createMaintenance(@Body() dto: CreateMaintenanceRecordDto, @Request() req: any) {
    return this.vehiclesService.createMaintenanceRecord(dto, req.user?.id);
  }

  @Patch('maintenance/records/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update a maintenance record' })
  updateMaintenance(@Param('id') id: string, @Body() dto: UpdateMaintenanceRecordDto, @Request() req: any) {
    return this.vehiclesService.updateMaintenanceRecord(id, dto, req.user?.id);
  }

  @Delete('maintenance/records/:id')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a maintenance record' })
  deleteMaintenance(@Param('id') id: string, @Request() req: any) {
    return this.vehiclesService.deleteMaintenanceRecord(id, req.user?.id);
  }

  // ── 3. Static sub-resource routes — workshops (before :id) ──────────────────

  @Get('workshops')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'List all workshops' })
  listWorkshops() {
    return this.vehiclesService.listWorkshops();
  }

  @Post('workshops')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Create a workshop' })
  createWorkshop(@Body() dto: CreateWorkshopDto) {
    return this.vehiclesService.createWorkshop(dto);
  }

  @Get('workshops/:id')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Get a workshop' })
  getWorkshop(@Param('id') id: string) {
    return this.vehiclesService.getWorkshop(id);
  }

  @Patch('workshops/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update a workshop' })
  updateWorkshop(@Param('id') id: string, @Body() dto: UpdateWorkshopDto) {
    return this.vehiclesService.updateWorkshop(id, dto);
  }

  @Delete('workshops/:id')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a workshop' })
  deleteWorkshop(@Param('id') id: string) {
    return this.vehiclesService.deleteWorkshop(id);
  }

  // ── 4. Parametric single-vehicle routes (:id must come last) ────────────────

  @Get(':id')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Get a single vehicle with full details' })
  getOne(@Param('id') id: string) {
    return this.vehiclesService.getVehicle(id);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Create a new vehicle' })
  create(@Body() dto: CreateVehicleDto, @Request() req: any) {
    return this.vehiclesService.createVehicle(dto, req.user?.id);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update a vehicle' })
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto, @Request() req: any) {
    return this.vehiclesService.updateVehicle(id, dto, req.user?.id);
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a vehicle' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.vehiclesService.deleteVehicle(id, req.user?.id);
  }

  // ── 5. Parametric sub-resource routes (:vehicleId/*) ────────────────────────

  @Get(':vehicleId/drivers')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Get driver assignment history for a vehicle' })
  getDriverHistory(@Param('vehicleId') vehicleId: string) {
    return this.vehiclesService.getDriverHistory(vehicleId);
  }

  @Post(':vehicleId/drivers')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Assign a driver to a vehicle (replaces current active driver)' })
  assignDriver(@Param('vehicleId') vehicleId: string, @Body() dto: AssignDriverDto, @Request() req: any) {
    return this.vehiclesService.assignDriver(vehicleId, dto, req.user?.id);
  }

  @Delete(':vehicleId/drivers/:assignmentId')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End a driver assignment' })
  unassignDriver(@Param('vehicleId') vehicleId: string, @Param('assignmentId') assignmentId: string) {
    return this.vehiclesService.unassignDriver(vehicleId, assignmentId);
  }

  @Post(':vehicleId/documents')
  @Roles(...WRITE_ROLES)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add a document (with optional file upload) to a vehicle' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DEST || './uploads',
        filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  addDocument(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CreateVehicleDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.vehiclesService.addDocument(vehicleId, dto, req.user?.id, file);
  }

  @Patch(':vehicleId/documents/:docId')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update a vehicle document' })
  updateDocument(
    @Param('vehicleId') vehicleId: string,
    @Param('docId') docId: string,
    @Body() dto: UpdateVehicleDocumentDto,
  ) {
    return this.vehiclesService.updateDocument(vehicleId, docId, dto);
  }

  @Delete(':vehicleId/documents/:docId')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a vehicle document' })
  deleteDocument(@Param('vehicleId') vehicleId: string, @Param('docId') docId: string, @Request() req: any) {
    return this.vehiclesService.deleteDocument(vehicleId, docId, req.user?.id);
  }
}
