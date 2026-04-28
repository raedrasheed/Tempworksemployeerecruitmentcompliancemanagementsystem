import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
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
    select: {
      id: true,
      status: true,
      completedDate: true,
      description: true,
      cost: true,
      maintenanceTypeId: true,
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
          select: {
            id: true,
            status: true,
            scheduledDate: true,
            completedDate: true,
            description: true,
            mileageAtService: true,
            cost: true,
            laborCost: true,
            partsCost: true,
            notes: true,
            maintenanceTypeId: true,
            maintenanceType: { select: { id: true, name: true } },
            workshopId: true,
            workshop: { select: { id: true, name: true, address: true, city: true, country: true, phone: true, email: true } },
            spareParts: true,
            createdAt: true,
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
    try {
      return await this.prisma.maintenanceType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    } catch (error: any) {
      // If the table doesn't exist yet, return empty array gracefully
      if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }

  async createMaintenanceType(dto: CreateMaintenanceTypeDto) {
    const data: any = { ...dto };
    if (data.intervalMode) {
      data.intervalMode = data.intervalMode.toUpperCase();
    }
    return this.prisma.maintenanceType.create({ data });
  }

  async updateMaintenanceType(id: string, dto: UpdateMaintenanceTypeDto) {
    const mt = await this.prisma.maintenanceType.findUnique({ where: { id } });
    if (!mt) throw new NotFoundException('Maintenance type not found');
    const data: any = { ...dto };
    if (data.intervalMode) {
      data.intervalMode = data.intervalMode.toUpperCase();
    }
    return this.prisma.maintenanceType.update({ where: { id }, data });
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

  // Limited select to baseline columns that exist before the
  // enhance_workshop_fields migration is applied.
  private static readonly WORKSHOP_SELECT = {
    id: true,
    name: true,
    contactName: true,
    phone: true,
    email: true,
    address: true,
    city: true,
    country: true,
    notes: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  async listWorkshops() {
    return this.prisma.workshop.findMany({
      where: { deletedAt: null } as any,
      orderBy: { name: 'asc' },
      select: VehiclesService.WORKSHOP_SELECT,
    });
  }

  async getWorkshop(id: string) {
    const w = await this.prisma.workshop.findUnique({
      where: { id },
      select: VehiclesService.WORKSHOP_SELECT,
    });
    if (!w) throw new NotFoundException('Workshop not found');
    return w;
  }

  async createWorkshop(dto: CreateWorkshopDto) {
    // Strip out fields that may not exist before enhance_workshop_fields migration
    const { name, contactName, phone, email, address, city, country, notes } = dto as any;
    return this.prisma.workshop.create({
      data: { name, contactName, phone, email, address, city, country, notes },
      select: VehiclesService.WORKSHOP_SELECT,
    });
  }

  async updateWorkshop(id: string, dto: UpdateWorkshopDto) {
    const w = await this.prisma.workshop.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Workshop not found');
    // Strip out fields that may not exist before enhance_workshop_fields migration
    const { name, contactName, phone, email, address, city, country, notes, isActive } = dto as any;
    const data: any = {};
    if (name !== undefined)        data.name = name;
    if (contactName !== undefined) data.contactName = contactName;
    if (phone !== undefined)       data.phone = phone;
    if (email !== undefined)       data.email = email;
    if (address !== undefined)     data.address = address;
    if (city !== undefined)        data.city = city;
    if (country !== undefined)     data.country = country;
    if (notes !== undefined)       data.notes = notes;
    if (isActive !== undefined)    data.isActive = isActive;
    return this.prisma.workshop.update({
      where: { id },
      data,
      select: VehiclesService.WORKSHOP_SELECT,
    });
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
    const { page = 1, limit = 20, vehicleId, workshopId, status, dateFrom, dateTo } = dto;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null } as any;

    if (vehicleId) where.vehicleId = vehicleId;
    if (workshopId) where.workshopId = workshopId;
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
        select: {
          id: true,
          vehicleId: true,
          maintenanceTypeId: true,
          workshopId: true,
          status: true,
          scheduledDate: true,
          completedDate: true,
          mileageAtService: true,
          nextServiceDate: true,
          nextServiceMileage: true,
          cost: true,
          laborCost: true,
          partsCost: true,
          description: true,
          technicianName: true,
          invoiceNumber: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
          maintenanceType: { select: { id: true, name: true } },
          workshop: { select: { id: true, name: true, address: true, city: true, country: true, phone: true, email: true } },
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
      select: {
        id: true,
        vehicleId: true,
        maintenanceTypeId: true,
        workshopId: true,
        status: true,
        scheduledDate: true,
        completedDate: true,
        mileageAtService: true,
        nextServiceDate: true,
        nextServiceMileage: true,
        cost: true,
        laborCost: true,
        partsCost: true,
        description: true,
        technicianName: true,
        invoiceNumber: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
        maintenanceType: { select: { id: true, name: true } },
        workshop: { select: { id: true, name: true, address: true, city: true, country: true, phone: true, email: true } },
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
    // Strip out new fields (driver, drop-off, pick-up, approval, workDescription)
    // - they require the enhance_maintenance_records migration to be applied first.
    const {
      spareParts, scheduledDate, completedDate, nextServiceDate,
      driverId: _driverId, driverNameOverride: _driverNameOverride,
      dropOffDriverId: _dropOffDriverId, dropOffDriverNameOverride: _dropOffDriverNameOverride, dropOffDateTime: _dropOffDateTime,
      pickUpDriverId: _pickUpDriverId, pickUpDriverNameOverride: _pickUpDriverNameOverride, pickUpDateTime: _pickUpDateTime,
      approvedById: _approvedById, approvedAt: _approvedAt, workDescription: _workDescription,
      ...rest
    } = dto;

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
      select: {
        id: true,
        vehicleId: true,
        maintenanceTypeId: true,
        workshopId: true,
        status: true,
        scheduledDate: true,
        completedDate: true,
        mileageAtService: true,
        nextServiceDate: true,
        nextServiceMileage: true,
        cost: true,
        laborCost: true,
        partsCost: true,
        description: true,
        technicianName: true,
        invoiceNumber: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        maintenanceType: { select: { id: true, name: true } },
        workshop: { select: { id: true, name: true, address: true, city: true, country: true, phone: true, email: true } },
        spareParts: true,
      },
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

    // Strip out new fields - they require the enhance_maintenance_records migration first.
    const {
      spareParts, scheduledDate, completedDate, nextServiceDate,
      driverId: _driverId, driverNameOverride: _driverNameOverride,
      dropOffDriverId: _dropOffDriverId, dropOffDriverNameOverride: _dropOffDriverNameOverride, dropOffDateTime: _dropOffDateTime,
      pickUpDriverId: _pickUpDriverId, pickUpDriverNameOverride: _pickUpDriverNameOverride, pickUpDateTime: _pickUpDateTime,
      approvedById: _approvedById, approvedAt: _approvedAt, workDescription: _workDescription,
      ...rest
    } = dto;
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
      select: {
        id: true,
        vehicleId: true,
        maintenanceTypeId: true,
        workshopId: true,
        status: true,
        scheduledDate: true,
        completedDate: true,
        mileageAtService: true,
        nextServiceDate: true,
        nextServiceMileage: true,
        cost: true,
        laborCost: true,
        partsCost: true,
        description: true,
        technicianName: true,
        invoiceNumber: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        maintenanceType: { select: { id: true, name: true } },
        workshop: { select: { id: true, name: true, address: true, city: true, country: true, phone: true, email: true } },
        spareParts: true,
      },
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

  // ── Maintenance Record Attachments ───────────────────────────────────────────
  // Note: attachments require running the enhance_maintenance_records migration first.

  async addMaintenanceAttachment(_recordId: string, _fileName: string, _fileUrl: string, _fileSize?: number, _mimeType?: string, _documentType?: string, _uploadedById?: string) {
    throw new BadRequestException('Maintenance record attachments require migration. Run: npm run db:migrate:enhance-maintenance-records');
  }

  async deleteMaintenanceAttachment(_attachmentId: string) {
    throw new BadRequestException('Maintenance record attachments require migration. Run: npm run db:migrate:enhance-maintenance-records');
  }

  async getMaintenanceAttachments(_recordId: string) {
    return [];
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

  // ── Maintenance Records Export ────────────────────────────────────────────────

  /// Build the where clause used by both list and export operations.
  private buildMaintenanceWhere(dto: FilterMaintenanceDto): any {
    const where: any = { deletedAt: null };
    if (dto.vehicleId)  where.vehicleId  = dto.vehicleId;
    if (dto.workshopId) where.workshopId = dto.workshopId;
    if (dto.status)     where.status     = dto.status;
    if (dto.dateFrom || dto.dateTo) {
      where.scheduledDate = {};
      if (dto.dateFrom) where.scheduledDate.gte = new Date(dto.dateFrom);
      if (dto.dateTo)   where.scheduledDate.lte = new Date(dto.dateTo);
    }
    return where;
  }

  private async fetchMaintenanceForExport(dto: FilterMaintenanceDto, recordIds?: string[]) {
    const where = recordIds?.length ? { id: { in: recordIds } } : this.buildMaintenanceWhere(dto);
    return this.prisma.maintenanceRecord.findMany({
      where,
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        completedDate: true,
        mileageAtService: true,
        nextServiceDate: true,
        nextServiceMileage: true,
        cost: true,
        laborCost: true,
        partsCost: true,
        description: true,
        technicianName: true,
        invoiceNumber: true,
        notes: true,
        createdAt: true,
        vehicle: { select: { registrationNumber: true, make: true, model: true } },
        maintenanceType: { select: { name: true } },
        workshop: { select: { name: true, city: true, country: true } },
      },
      orderBy: [{ completedDate: 'desc' }, { scheduledDate: 'desc' }],
    });
  }

  async exportMaintenanceRecordsExcel(dto: FilterMaintenanceDto, recordIds?: string[]): Promise<Buffer> {
    const records = await this.fetchMaintenanceForExport(dto, recordIds);

    const workbook = new ExcelJS.Workbook();
    const sheet    = workbook.addWorksheet('Maintenance Records', { views: [{ state: 'frozen', ySplit: 1 }] });

    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const headers = [
      'Vehicle', 'Make/Model', 'Type', 'Workshop', 'Status',
      'Scheduled', 'Completed', 'Mileage (km)', 'Next Service Date',
      'Next Service Mileage', 'Labor Cost', 'Parts Cost', 'Total Cost',
      'Technician', 'Invoice #', 'Description', 'Notes',
    ];

    sheet.columns = headers.map((h, i) => ({
      header: h,
      width: i === 15 || i === 16 ? 30 : 16,
    }));
    sheet.getRow(1).eachCell((cell) => {
      cell.fill      = headerFill;
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    sheet.getRow(1).height = 22;

    const statusColors: Record<string, string> = {
      SCHEDULED: 'FFDBEAFE', IN_PROGRESS: 'FFFEF3C7', COMPLETED: 'FFD1FAE5', CANCELLED: 'FFF3F4F6',
    };

    for (const r of records) {
      const row = sheet.addRow([
        r.vehicle?.registrationNumber ?? '',
        r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : '',
        r.maintenanceType?.name ?? '',
        r.workshop?.name ?? '',
        r.status,
        r.scheduledDate ? r.scheduledDate.toISOString().split('T')[0] : '',
        r.completedDate ? r.completedDate.toISOString().split('T')[0] : '',
        r.mileageAtService ?? '',
        r.nextServiceDate ? r.nextServiceDate.toISOString().split('T')[0] : '',
        r.nextServiceMileage ?? '',
        r.laborCost ?? '',
        r.partsCost ?? '',
        r.cost ?? '',
        r.technicianName ?? '',
        r.invoiceNumber ?? '',
        r.description ?? '',
        r.notes ?? '',
      ]);
      const statusFill: ExcelJS.Fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: statusColors[r.status] ?? 'FFFFFFFF' },
      };
      row.getCell(5).fill = statusFill;
    }

    sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}1` };

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async exportMaintenanceRecordsPdf(dto: FilterMaintenanceDto, recordIds?: string[]): Promise<Buffer> {
    const records = await this.fetchMaintenanceForExport(dto, recordIds);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' } as any);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A')
        .text('Maintenance Records', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#64748B')
        .text(`Generated: ${new Date().toLocaleString()}  |  ${records.length} records`, { align: 'center' });
      doc.moveDown(0.6);

      const columns = [
        { label: 'Vehicle',    key: 'vehicle',     width: 70 },
        { label: 'Type',       key: 'type',        width: 80 },
        { label: 'Workshop',   key: 'workshop',    width: 90 },
        { label: 'Status',     key: 'status',      width: 70 },
        { label: 'Scheduled',  key: 'scheduled',   width: 65 },
        { label: 'Completed',  key: 'completed',   width: 65 },
        { label: 'Mileage',    key: 'mileage',     width: 60 },
        { label: 'Cost',       key: 'cost',        width: 60 },
        { label: 'Technician', key: 'technician',  width: 80 },
        { label: 'Invoice',    key: 'invoice',     width: 70 },
      ];

      const tblW   = columns.reduce((s, c) => s + c.width, 0);
      const startX = ((doc as any).page.width - tblW) / 2;
      const rowH   = 16;
      const hdrH   = 20;
      let y = (doc as any).y;

      // Header row
      doc.rect(startX, y, tblW, hdrH).fill('#2563EB');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      let x = startX;
      for (const col of columns) {
        doc.text(col.label, x + 3, y + 6, { width: col.width - 6, ellipsis: true });
        x += col.width;
      }
      y += hdrH;

      // Data rows
      doc.font('Helvetica').fontSize(7.5);
      const statusColor: Record<string, string> = {
        SCHEDULED: '#DBEAFE', IN_PROGRESS: '#FEF3C7', COMPLETED: '#D1FAE5', CANCELLED: '#F3F4F6',
      };

      records.forEach((r, ri) => {
        if (y + rowH > (doc as any).page.height - 50) {
          doc.addPage();
          y = 36;
        }
        if (ri % 2 === 0) doc.rect(startX, y, tblW, rowH).fill('#F8FAFC');

        const values = [
          r.vehicle?.registrationNumber ?? '—',
          r.maintenanceType?.name ?? '—',
          r.workshop?.name ?? '—',
          r.status,
          r.scheduledDate ? r.scheduledDate.toISOString().split('T')[0] : '—',
          r.completedDate ? r.completedDate.toISOString().split('T')[0] : '—',
          r.mileageAtService != null ? `${r.mileageAtService} km` : '—',
          r.cost != null ? `£${r.cost.toFixed(2)}` : '—',
          r.technicianName ?? '—',
          r.invoiceNumber ?? '—',
        ];

        x = startX;
        values.forEach((v, i) => {
          if (i === 3) {
            doc.rect(x + 1, y + 1, columns[i].width - 2, rowH - 2)
              .fill(statusColor[r.status] ?? '#FFFFFF');
            doc.fillColor('#0F172A');
          } else {
            doc.fillColor('#0F172A');
          }
          doc.text(String(v), x + 3, y + 4, { width: columns[i].width - 6, ellipsis: true });
          x += columns[i].width;
        });

        doc.rect(startX, y, tblW, rowH).stroke('#E2E8F0');
        y += rowH;
      });

      // Footer
      doc.fillColor('#94A3B8').fontSize(8)
        .text('TempWorks — Maintenance Records', 36, (doc as any).page.height - 24, { align: 'center' });
      doc.end();
    });
  }
}
