import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Phase 2.57 — Tenant-scoped audit search/read HTTP endpoints.
 *
 * Read-ONLY endpoints. Reuse Phase 2.56's RBAC tenant binding via
 * `LogsService.findAll` / `getStats` / `findOneForActor` /
 * `previewRetentionForActor`. NO destructive routes (no
 * retention apply, no soft-delete, no hard-delete) — those remain
 * script-only by Phase 2.53/2.54 contract.
 *
 * Roles: System Admin and Compliance Officer only. The service
 * still applies the Phase 2.56 contract from inside, so even an
 * elevated role cannot read another tenant's rows in pilot mode
 * unless `AUDIT_LOG_GLOBAL_READ_ENABLED=true` AND the role is in
 * `FULL_ACCESS_ROLES`.
 */
@ApiTags('Tenant Audit Logs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/tenant-audit')
export class TenantAuditController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @Roles('System Admin', 'Compliance Officer')
  @ApiOperation({ summary: 'Tenant-scoped audit log list (read-only)' })
  @ApiQuery({ name: 'entity',   required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'action',   required: false })
  @ApiQuery({ name: 'userId',   required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate',   required: false })
  // @tenant-reviewed: phase257-audit-log-http-read (delegates to RBAC-bound LogsService.findAll)
  list(
    @Query() pagination: PaginationDto,
    @CurrentUser() caller: any,
    @Query('entity')   entity?: string,
    @Query('entityId') entityId?: string,
    @Query('action')   action?: string,
    @Query('userId')   userId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate')   toDate?: string,
  ) {
    return this.logsService.findAll(
      pagination,
      { entity, entityId, action, userId, fromDate, toDate },
      { role: caller.role, userId: caller.id, agencyId: caller.agencyId },
    );
  }

  @Get('stats')
  @Roles('System Admin', 'Compliance Officer')
  @ApiOperation({ summary: 'Tenant-scoped audit log statistics (read-only)' })
  // @tenant-reviewed: phase257-audit-log-http-read (delegates to RBAC-bound LogsService.getStats)
  stats(@CurrentUser() caller: any) {
    return this.logsService.getStats({
      role: caller.role, userId: caller.id, agencyId: caller.agencyId,
    });
  }

  @Get('retention-preview')
  @Roles('System Admin', 'Compliance Officer')
  @ApiOperation({ summary: 'Tenant-scoped audit retention preview (count-only; never modifies data)' })
  @ApiQuery({ name: 'days', required: false })
  // @tenant-reviewed: phase257-audit-log-http-retention-preview (count-only; no destructive call)
  retentionPreview(@CurrentUser() caller: any, @Query('days') days?: string) {
    const parsedDays = days ? Number(days) : undefined;
    return this.logsService.previewRetentionForActor(
      { role: caller.role, userId: caller.id, agencyId: caller.agencyId },
      Number.isFinite(parsedDays) ? parsedDays : undefined,
    );
  }

  @Get(':id')
  @Roles('System Admin', 'Compliance Officer')
  @ApiOperation({ summary: 'Tenant-scoped audit log by id (read-only)' })
  // @tenant-reviewed: phase257-audit-log-http-read
  byId(@Param('id') id: string, @CurrentUser() caller: any) {
    return this.logsService.findOneForActor(id, {
      role: caller.role, userId: caller.id, agencyId: caller.agencyId,
    });
  }
}

// @tenant-reviewed: phase257-audit-log-http-no-destructive-routes
// This controller exposes ONLY GET routes (list / stats /
// retention-preview / by-id). Retention enforcement (Phase 2.53)
// and hard-delete (Phase 2.54) remain script-only and are not
// surfaced as HTTP endpoints by Phase 2.57 — see
// SAAS_PHASE2_AUDIT_LOG_HTTP_ENDPOINTS.md.
