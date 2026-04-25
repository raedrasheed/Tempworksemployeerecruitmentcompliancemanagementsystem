import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
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

const VEHICLE_INCLUDE = {
  agency: { select: { id: true, name: true } },
  driverAssignments: {
    where: { isActive: true },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, licenseNumber: true, licenseCategory: true } },
    },
    take: 1,
  },
  maintenanceRecords: {
    where: { deletedAt: null, completedDate: { not: null } },
    include: {
      maintenanceType: { select: { id: true, name: true } },
      workshop: { select: { id: true, name: true } },
    },
    orderBy: { completedDate: 'desc' as const },
    take: 1,
  },
  _count: { select: { documents: true, maintenanceRecords: true } },
};

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Vehicles ────────────────────────────────────────────────────────────────

  async listVehicles(dto: FilterVehiclesDto) {
    const { page = 1, limit = 20, search, type, status, agencyId, expiringInDays } = dto;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { vin: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (type)     where.type     = type;
    if (status)   where.status   = status;
    if (agencyId) where.agencyId = agencyId;

    if (expiringInDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + expiringInDays);
      where.OR = [
        ...(where.OR ?? []),
        { motExpiryDate: { lte: cutoff } },
        { taxExpiryDate: { lte: cutoff } },
        { insuranceExpiryDate: { lte: cutoff } },
      ];
    }

    const [vehicles, total] = await Promise.all([
      this.prisma.vehicle.findMany({ where, skip, take: limit, include: VEHICLE_INCLUDE, orderBy: { createdAt: 'desc' } }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { data: vehicles, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getVehicle(id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
      include: {
        agency: { select: { id: true, name: true } },
        driverAssignments: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, licenseNumber: true, licenseCategory: true, photoUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        documents: { where: { deletedAt: null } as any, orderBy: { createdAt: 'desc' } },
        maintenanceRecords: {
          where: { deletedAt: null } as any,
          include: {
            maintenanceType: true,
            workshop: true,
            spareParts: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  // Centralised list of date-bearing string fields on the Vehicle DTO.
  // Each one is stored as a DATE column on the vehicles table, so empty
  // strings must be coerced to null and non-empty values parsed via Date.
  private readonly VEHICLE_DATE_FIELDS = [
    'motExpiryDate',
    'taxExpiryDate',
    'insuranceExpiryDate',
    'registrationExpiryDate',
    'purchaseDate',
    'insuranceStartDate',
    'tachographCalibrationExpiry',
    'lastPressureTestDate',
    'nextPressureTestDate',
    'atpCertificateExpiry',
  ] as const;

  /** Strip date strings out of the DTO and rewrite them as Date objects. */
  private normaliseVehicleDates(dto: any, isCreate: boolean): any {
    const data: any = { ...dto };
    for (const field of this.VEHICLE_DATE_FIELDS) {
      const v = data[field];
      if (isCreate) {
        // On create we only forward the column when the caller actually
        // supplied a value — undefined keeps the default null.
        if (v) data[field] = new Date(v);
        else delete data[field];
      } else if (v !== undefined) {
        data[field] = v ? new Date(v) : null;
      }
    }
    return data;
  }

  async createVehicle(dto: CreateVehicleDto, userId: string) {
    const data: any = this.normaliseVehicleDates(dto, true);
    data.createdById = userId;
    data.updatedById = userId;
    return this.prisma.vehicle.create({ data, include: VEHICLE_INCLUDE });
  }

  async updateVehicle(id: string, dto: UpdateVehicleDto, userId: string) {
    await this.findVehicleOrFail(id);
    const data: any = this.normaliseVehicleDates(dto, false);
    data.updatedById = userId;
    return this.prisma.vehicle.update({ where: { id }, data, include: VEHICLE_INCLUDE });
  }

  async deleteVehicle(id: string, userId: string) {
    await this.findVehicleOrFail(id);
    await this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId },
    });
    return { message: 'Vehicle deleted successfully' };
  }

  private async findVehicleOrFail(id: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { id, deletedAt: null } });
    if (!v) throw new NotFoundException('Vehicle not found');
    return v;
  }

  // ── Driver Assignments ───────────────────────────────────────────────────────

  async assignDriver(vehicleId: string, dto: AssignDriverDto, userId: string) {
    await this.findVehicleOrFail(vehicleId);

    // Deactivate any existing active assignment for this vehicle
    await this.prisma.vehicleDriverAssignment.updateMany({
      where: { vehicleId, isActive: true },
      data: { isActive: false, endDate: new Date() },
    });

    return this.prisma.vehicleDriverAssignment.create({
      data: {
        vehicleId,
        employeeId: dto.employeeId,
        startDate:  new Date(dto.startDate),
        isActive:   true,
        notes:      dto.notes,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, licenseNumber: true, licenseCategory: true } },
      },
    });
  }

  async unassignDriver(vehicleId: string, assignmentId: string) {
    const assignment = await this.prisma.vehicleDriverAssignment.findFirst({
      where: { id: assignmentId, vehicleId, isActive: true },
    });
    if (!assignment) throw new NotFoundException('Active driver assignment not found');

    return this.prisma.vehicleDriverAssignment.update({
      where: { id: assignmentId },
      data: { isActive: false, endDate: new Date() },
    });
  }

  async getDriverHistory(vehicleId: string) {
    await this.findVehicleOrFail(vehicleId);
    return this.prisma.vehicleDriverAssignment.findMany({
      where: { vehicleId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, licenseNumber: true, licenseCategory: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Documents ────────────────────────────────────────────────────────────────

  async addDocument(vehicleId: string, dto: CreateVehicleDocumentDto, userId: string, file?: Express.Multer.File) {
    await this.findVehicleOrFail(vehicleId);
    const { expiryDate, issuedDate, ...rest } = dto;
    const data: any = { ...rest, vehicleId, uploadedById: userId };
    if (expiryDate)  data.expiryDate  = new Date(expiryDate);
    if (issuedDate)  data.issuedDate  = new Date(issuedDate);
    if (file) {
      data.fileUrl  = `/uploads/${file.filename}`;
      data.fileName = file.originalname;
      data.fileSize = file.size;
    }
    return this.prisma.vehicleDocument.create({ data });
  }

  async updateDocument(vehicleId: string, docId: string, dto: UpdateVehicleDocumentDto) {
    const doc = await this.prisma.vehicleDocument.findFirst({ where: { id: docId, vehicleId } });
    if (!doc) throw new NotFoundException('Document not found');

    const { expiryDate, issuedDate, ...rest } = dto;
    const data: any = { ...rest };
    if (expiryDate !== undefined) data.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (issuedDate !== undefined) data.issuedDate = issuedDate ? new Date(issuedDate) : null;

    return this.prisma.vehicleDocument.update({ where: { id: docId }, data });
  }

  async deleteDocument(vehicleId: string, docId: string, userId?: string) {
    const doc = await this.prisma.vehicleDocument.findFirst({ where: { id: docId, vehicleId } as any });
    if (!doc) throw new NotFoundException('Document not found');
    if ((doc as any).deletedAt) throw new NotFoundException('Document not found');
    await (this.prisma.vehicleDocument as any).update({
      where: { id: docId },
      data: { deletedAt: new Date(), deletedBy: userId ?? null },
    });
    return { message: 'Document deleted successfully' };
  }

  // ── Maintenance Types ────────────────────────────────────────────────────────

  async listMaintenanceTypes() {
    return this.prisma.maintenanceType.findMany({ where: { isActive: true, deletedAt: null } as any, orderBy: { name: 'asc' } });
  }

  async createMaintenanceType(dto: CreateMaintenanceTypeDto) {
    return this.prisma.maintenanceType.create({ data: dto });
  }

  async updateMaintenanceType(id: string, dto: UpdateMaintenanceTypeDto) {
    const mt = await this.prisma.maintenanceType.findUnique({ where: { id } });
    if (!mt) throw new NotFoundException('Maintenance type not found');
    return this.prisma.maintenanceType.update({ where: { id }, data: dto });
  }

  async deleteMaintenanceType(id: string, userId?: string) {
    const mt = await this.prisma.maintenanceType.findUnique({ where: { id } });
    if (!mt) throw new NotFoundException('Maintenance type not found');
    if ((mt as any).deletedAt) throw new NotFoundException('Maintenance type not found');
    await (this.prisma.maintenanceType as any).update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId ?? null },
    });
    return { message: 'Maintenance type deleted' };
  }

  // ── Workshops ────────────────────────────────────────────────────────────────

  async listWorkshops() {
    return this.prisma.workshop.findMany({ where: { deletedAt: null } as any, orderBy: { name: 'asc' } });
  }

  async getWorkshop(id: string) {
    const w = await this.prisma.workshop.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Workshop not found');
    return w;
  }

  async createWorkshop(dto: CreateWorkshopDto) {
    return this.prisma.workshop.create({ data: dto });
  }

  async updateWorkshop(id: string, dto: UpdateWorkshopDto) {
    const w = await this.prisma.workshop.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Workshop not found');
    return this.prisma.workshop.update({ where: { id }, data: dto });
  }

  async deleteWorkshop(id: string, userId?: string) {
    const w = await this.prisma.workshop.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Workshop not found');
    if ((w as any).deletedAt) throw new NotFoundException('Workshop not found');
    await (this.prisma.workshop as any).update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId ?? null },
    });
    return { message: 'Workshop deleted successfully' };
  }

  // ── Maintenance Records ──────────────────────────────────────────────────────

  async listMaintenanceRecords(dto: FilterMaintenanceDto) {
    const { page = 1, limit = 20, vehicleId, status, dateFrom, dateTo } = dto;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null } as any;

    if (vehicleId) where.vehicleId = vehicleId;
    if (status)    where.status    = status;
    if (dateFrom || dateTo) {
      where.scheduledDate = {};
      if (dateFrom) where.scheduledDate.gte = new Date(dateFrom);
      if (dateTo)   where.scheduledDate.lte = new Date(dateTo);
    }

    const [records, total] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({
        where,
        skip,
        take: limit,
        include: {
          vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
          maintenanceType: true,
          workshop: true,
          spareParts: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.maintenanceRecord.count({ where }),
    ]);

    return { data: records, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getMaintenanceRecord(id: string) {
    const record = await this.prisma.maintenanceRecord.findUnique({
      where: { id },
      include: {
        vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
        maintenanceType: true,
        workshop: true,
        spareParts: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!record) throw new NotFoundException('Maintenance record not found');
    return record;
  }

  async createMaintenanceRecord(dto: CreateMaintenanceRecordDto, userId: string) {
    await this.findVehicleOrFail(dto.vehicleId);
    const { spareParts, scheduledDate, completedDate, nextServiceDate, ...rest } = dto;

    const data: any = { ...rest, createdById: userId, updatedById: userId };
    if (scheduledDate)   data.scheduledDate   = new Date(scheduledDate);
    if (completedDate)   data.completedDate   = new Date(completedDate);
    if (nextServiceDate) data.nextServiceDate = new Date(nextServiceDate);

    if (spareParts?.length) {
      data.spareParts = {
        create: spareParts.map((p) => ({
          partName:   p.partName,
          partNumber: p.partNumber,
          quantity:   p.quantity ?? 1,
          unitCost:   p.unitCost,
          totalCost:  p.unitCost != null ? (p.unitCost * (p.quantity ?? 1)) : undefined,
          supplier:   p.supplier,
        })),
      };
    }

    // If mileage provided, update vehicle's currentMileage
    if (dto.mileageAtService) {
      await this.prisma.vehicle.update({
        where: { id: dto.vehicleId },
        data: { currentMileage: dto.mileageAtService },
      });
    }

    const record = await this.prisma.maintenanceRecord.create({
      data,
      include: { maintenanceType: true, workshop: true, spareParts: true },
    });

    // Compute partsCost from spare parts if not provided
    if (!dto.partsCost && spareParts?.length) {
      const partsCost = record.spareParts.reduce((sum, p) => sum + (p.totalCost ?? 0), 0);
      await this.prisma.maintenanceRecord.update({ where: { id: record.id }, data: { partsCost } });
    }

    return record;
  }

  async updateMaintenanceRecord(id: string, dto: UpdateMaintenanceRecordDto, userId: string) {
    const existing = await this.prisma.maintenanceRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Maintenance record not found');

    const { spareParts, scheduledDate, completedDate, nextServiceDate, ...rest } = dto;
    const data: any = { ...rest, updatedById: userId };
    if (scheduledDate !== undefined)   data.scheduledDate   = scheduledDate ? new Date(scheduledDate) : null;
    if (completedDate !== undefined)   data.completedDate   = completedDate ? new Date(completedDate) : null;
    if (nextServiceDate !== undefined) data.nextServiceDate = nextServiceDate ? new Date(nextServiceDate) : null;

    if (spareParts !== undefined) {
      // Replace spare parts
      await this.prisma.maintenanceRecordSparePart.deleteMany({ where: { maintenanceRecordId: id } });
      if (spareParts.length) {
        data.spareParts = {
          create: spareParts.map((p) => ({
            partName:   p.partName,
            partNumber: p.partNumber,
            quantity:   p.quantity ?? 1,
            unitCost:   p.unitCost,
            totalCost:  p.unitCost != null ? (p.unitCost * (p.quantity ?? 1)) : undefined,
            supplier:   p.supplier,
          })),
        };
      }
    }

    if (dto.mileageAtService) {
      await this.prisma.vehicle.update({
        where: { id: existing.vehicleId },
        data: { currentMileage: dto.mileageAtService },
      });
    }

    return this.prisma.maintenanceRecord.update({
      where: { id },
      data,
      include: { maintenanceType: true, workshop: true, spareParts: true },
    });
  }

  async deleteMaintenanceRecord(id: string, userId?: string) {
    const existing = await this.prisma.maintenanceRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Maintenance record not found');
    if ((existing as any).deletedAt) throw new NotFoundException('Maintenance record not found');
    await (this.prisma.maintenanceRecord as any).update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId ?? null },
    });
    return { message: 'Maintenance record deleted successfully' };
  }

  // ── Dashboard Stats ──────────────────────────────────────────────────────────

  async getDashboardStats() {
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const [
      totalVehicles,
      activeVehicles,
      inMaintenance,
      scrapped,
      upcomingMaintenance,
      expiringDocs,
    ] = await Promise.all([
      this.prisma.vehicle.count({ where: { deletedAt: null } }),
      this.prisma.vehicle.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.vehicle.count({ where: { deletedAt: null, status: 'IN_MAINTENANCE' } }),
      this.prisma.vehicle.count({ where: { deletedAt: null, status: 'SCRAPPED' } }),
      this.prisma.maintenanceRecord.count({
        where: {
          status: 'SCHEDULED',
          scheduledDate: { lte: in30Days, gte: now },
        },
      }),
      this.prisma.vehicleDocument.count({
        where: {
          expiryDate: { lte: in30Days, gte: now },
        },
      }),
    ]);

    const byType = await this.prisma.vehicle.groupBy({
      by: ['type'],
      where: { deletedAt: null },
      _count: { id: true },
    });

    return {
      totalVehicles,
      activeVehicles,
      inMaintenance,
      scrapped,
      upcomingMaintenance,
      expiringDocs,
      byType: byType.map((r) => ({ type: r.type, count: r._count.id })),
    };
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  async exportVehicles(dto: ExportVehiclesDto): Promise<Buffer> {
    const where: any = { deletedAt: null };
    if (dto.type)   where.type   = dto.type;
    if (dto.status) where.status = dto.status;
    if (dto.vehicleIds?.length) where.id = { in: dto.vehicleIds };

    const vehicles = await this.prisma.vehicle.findMany({
      where,
      include: {
        agency: { select: { name: true } },
        driverAssignments: {
          where: { isActive: true },
          include: { employee: { select: { firstName: true, lastName: true } } },
          take: 1,
        },
      },
      orderBy: { registrationNumber: 'asc' },
    });

    const workbook  = new ExcelJS.Workbook();
    const sheet     = workbook.addWorksheet('Vehicles', { views: [{ state: 'frozen', ySplit: 1 }] });

    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const headers = [
      'Registration', 'Type', 'Make', 'Model', 'Year', 'Status', 'Fuel Type',
      'Mileage (km)', 'Current Driver', 'MOT Expiry', 'Tax Expiry', 'Insurance Expiry',
      'Agency', 'VIN',
    ];

    sheet.columns = headers.map((h) => ({ header: h, width: 18 }));
    sheet.getRow(1).eachCell((cell) => {
      cell.fill  = headerFill;
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    sheet.getRow(1).height = 22;

    const statusColors: Record<string, string> = {
      ACTIVE: 'FFD1FAE5', INACTIVE: 'FFFEE2E2', IN_MAINTENANCE: 'FFFEF3C7', SCRAPPED: 'FFF3F4F6',
    };

    for (const v of vehicles) {
      const driver = v.driverAssignments[0]?.employee;
      const row = sheet.addRow([
        v.registrationNumber,
        v.type,
        v.make,
        v.model,
        v.year ?? '',
        v.status,
        v.fuelType ?? '',
        v.currentMileage ?? '',
        driver ? `${driver.firstName} ${driver.lastName}` : '',
        v.motExpiryDate ? v.motExpiryDate.toISOString().split('T')[0] : '',
        v.taxExpiryDate ? v.taxExpiryDate.toISOString().split('T')[0] : '',
        v.insuranceExpiryDate ? v.insuranceExpiryDate.toISOString().split('T')[0] : '',
        v.agency?.name ?? '',
        v.vin ?? '',
      ]);
      const statusFill: ExcelJS.Fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: statusColors[v.status] ?? 'FFFFFFFF' },
      };
      row.getCell(6).fill = statusFill;
    }

    sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}1` };

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
