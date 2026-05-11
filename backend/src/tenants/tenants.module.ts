import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { PlatformTenantGuard } from './platform-tenant.guard';

// Phase 3.15 — Tenant Management Module
// @tenant-reviewed: phase315-tenant-management-module
@Module({
  imports: [PrismaModule],
  controllers: [TenantsController],
  providers: [TenantsService, PlatformTenantGuard],
  exports: [TenantsService],
})
export class TenantsModule {}
