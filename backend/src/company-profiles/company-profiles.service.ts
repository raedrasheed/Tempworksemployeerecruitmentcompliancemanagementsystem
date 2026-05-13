import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CompanyProfileInput {
  name: string;
  legalName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  vatNumber?: string;
  registrationNumber?: string;
  logoUrl?: string;
  footer?: string;
  isDefault?: boolean;
}

/**
 * Company Export Profile = the company-details block printed on the
 * Excel timesheet header. Tenants may keep several profiles (own
 * holding co. + client cos.) and pick one at export time.
 */
@Injectable()
export class CompanyProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId?: string | null) {
    const where: any = { deletedAt: null };
    if (tenantId) where.tenantId = tenantId;
    return (this.prisma as any).companyExportProfile.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async get(id: string) {
    const profile = await (this.prisma as any).companyExportProfile.findUnique({ where: { id } });
    if (!profile || profile.deletedAt) {
      throw new NotFoundException('Company profile not found');
    }
    return profile;
  }

  async create(dto: CompanyProfileInput, tenantId?: string | null) {
    if (dto.isDefault) await this.clearDefault(tenantId);
    return (this.prisma as any).companyExportProfile.create({
      data: { ...dto, tenantId: tenantId ?? null },
    });
  }

  async update(id: string, dto: Partial<CompanyProfileInput>) {
    const existing = await this.get(id);
    if (dto.isDefault) await this.clearDefault(existing.tenantId);
    return (this.prisma as any).companyExportProfile.update({
      where: { id },
      data: { ...dto },
    });
  }

  async remove(id: string) {
    await this.get(id);
    return (this.prisma as any).companyExportProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async clearDefault(tenantId?: string | null) {
    await (this.prisma as any).companyExportProfile.updateMany({
      where: { tenantId: tenantId ?? null, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
  }
}
