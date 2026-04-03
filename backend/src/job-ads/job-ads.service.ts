import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, JobAdStatus } from '@prisma/client';
import { CreateJobAdDto } from './dto/create-job-ad.dto';
import { UpdateJobAdDto } from './dto/update-job-ad.dto';
import { FilterJobAdsDto } from './dto/filter-job-ads.dto';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';
import { JOB_AD_STATUSES, CONTRACT_TYPES, JOB_CATEGORIES, COMMON_CURRENCIES } from './constants';

@Injectable()
export class JobAdsService {
  constructor(private prisma: PrismaService) {}

  // ── Slug generation ──────────────────────────────────────────────────────────

  private toSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100);
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = base;
    let attempt = 0;
    while (true) {
      const existing = await this.prisma.jobAd.findFirst({
        where: {
          slug,
          deletedAt: null,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (!existing) return slug;
      attempt++;
      slug = `${base}-${attempt}`;
    }
  }

  // ── Dashboard: list (paginated + filtered) ───────────────────────────────────

  async findAll(filter: FilterJobAdsDto) {
    const {
      page = 1, limit = 20, search, status, category, country, contractType,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = filter as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };
    if (status)       where.status       = status;
    if (category)     where.category     = category;
    if (country)      where.country      = country;
    if (contractType) where.contractType = contractType;
    if (search) {
      where.OR = [
        { title:       { contains: search, mode: 'insensitive' } },
        { category:    { contains: search, mode: 'insensitive' } },
        { city:        { contains: search, mode: 'insensitive' } },
        { country:     { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const validSort = ['createdAt', 'publishedAt', 'title', 'status', 'country', 'category'];
    const orderField = validSort.includes(sortBy) ? sortBy : 'createdAt';

    const [items, total] = await Promise.all([
      this.prisma.jobAd.findMany({
        where, skip, take: Number(limit),
        orderBy: { [orderField]: sortOrder },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { applicants: true } },
        },
      }),
      this.prisma.jobAd.count({ where }),
    ]);

    return PaginatedResponse.create(items, total, Number(page), Number(limit));
  }

  // ── Public listing (only PUBLISHED, no auth required) ────────────────────────

  async findPublished(filter: FilterJobAdsDto) {
    const {
      page = 1, limit = 20, search, category, country, contractType,
      sortBy = 'publishedAt', sortOrder = 'desc',
    } = filter as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null, status: 'PUBLISHED' };
    if (category)     where.category     = category;
    if (country)      where.country      = country;
    if (contractType) where.contractType = contractType;
    if (search) {
      where.OR = [
        { title:       { contains: search, mode: 'insensitive' } },
        { category:    { contains: search, mode: 'insensitive' } },
        { city:        { contains: search, mode: 'insensitive' } },
        { country:     { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const validSort = ['publishedAt', 'title', 'country', 'category'];
    const orderField = validSort.includes(sortBy) ? sortBy : 'publishedAt';

    const [items, total] = await Promise.all([
      this.prisma.jobAd.findMany({
        where, skip, take: Number(limit),
        orderBy: { [orderField]: sortOrder },
        select: {
          id: true, title: true, slug: true, category: true,
          city: true, country: true, contractType: true,
          salaryMin: true, salaryMax: true, currency: true,
          publishedAt: true,
          // Exclude description for listing (save bandwidth; use detail endpoint for full text)
        },
      }),
      this.prisma.jobAd.count({ where }),
    ]);

    return PaginatedResponse.create(items, total, Number(page), Number(limit));
  }

  // ── Public detail by slug ─────────────────────────────────────────────────────

  async findBySlug(slug: string) {
    const ad = await this.prisma.jobAd.findFirst({
      where: { slug, deletedAt: null, status: 'PUBLISHED' },
    });
    if (!ad) throw new NotFoundException(`Job ad '${slug}' not found`);
    return ad;
  }

  // ── Dashboard detail by ID ────────────────────────────────────────────────────

  async findOne(id: string) {
    const ad = await this.prisma.jobAd.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { applicants: true } },
      },
    });
    if (!ad) throw new NotFoundException(`Job ad ${id} not found`);
    return ad;
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async create(dto: CreateJobAdDto, userId?: string) {
    const baseSlug = dto.slug ? dto.slug.toLowerCase().replace(/\s+/g, '-') : this.toSlug(dto.title);
    const slug = await this.uniqueSlug(baseSlug);

    const publishedAt = dto.status === 'PUBLISHED' ? new Date() : null;

    return this.prisma.jobAd.create({
      data: {
        title:        dto.title,
        slug,
        category:     dto.category,
        description:  dto.description,
        city:         dto.city,
        country:      dto.country,
        contractType: dto.contractType ?? 'Full-time',
        salaryMin:    dto.salaryMin  ?? null,
        salaryMax:    dto.salaryMax  ?? null,
        currency:     dto.currency   ?? 'GBP',
        status:       (dto.status ?? 'DRAFT') as JobAdStatus,
        publishedAt,
        createdById:  userId ?? null,
      },
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateJobAdDto, userId?: string) {
    const existing = await this.findOne(id);

    // Regenerate slug if title changed and no explicit slug provided
    let slug = existing.slug;
    if (dto.slug) {
      slug = await this.uniqueSlug(dto.slug.toLowerCase().replace(/\s+/g, '-'), id);
    } else if (dto.title && dto.title !== existing.title && !dto.slug) {
      slug = await this.uniqueSlug(this.toSlug(dto.title), id);
    }

    // Auto-set publishedAt when transitioning to PUBLISHED
    let publishedAt = existing.publishedAt;
    if (dto.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      publishedAt = new Date();
    }

    return this.prisma.jobAd.update({
      where: { id },
      data: {
        ...(dto.title        !== undefined ? { title:        dto.title }        : {}),
        ...(dto.category     !== undefined ? { category:     dto.category }     : {}),
        ...(dto.description  !== undefined ? { description:  dto.description }  : {}),
        ...(dto.city         !== undefined ? { city:         dto.city }         : {}),
        ...(dto.country      !== undefined ? { country:      dto.country }      : {}),
        ...(dto.contractType !== undefined ? { contractType: dto.contractType } : {}),
        ...(dto.salaryMin    !== undefined ? { salaryMin:    dto.salaryMin }    : {}),
        ...(dto.salaryMax    !== undefined ? { salaryMax:    dto.salaryMax }    : {}),
        ...(dto.currency     !== undefined ? { currency:     dto.currency }     : {}),
        ...(dto.status       !== undefined ? { status:       dto.status as JobAdStatus } : {}),
        slug,
        publishedAt,
      },
    });
  }

  // ── Soft-delete ───────────────────────────────────────────────────────────────

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.jobAd.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ── Constants ─────────────────────────────────────────────────────────────────

  getConstants() {
    return { statuses: JOB_AD_STATUSES, contractTypes: CONTRACT_TYPES, categories: JOB_CATEGORIES, currencies: COMMON_CURRENCIES };
  }
}
