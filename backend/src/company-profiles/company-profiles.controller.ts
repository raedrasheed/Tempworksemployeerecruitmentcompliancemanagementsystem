import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CompanyProfilesService } from './company-profiles.service';

const READ_ROLES  = ['System Admin', 'HR Manager', 'Finance', 'Compliance Officer'];
const WRITE_ROLES = ['System Admin', 'HR Manager', 'Finance'];

@ApiTags('Company Profiles')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('company-profiles')
export class CompanyProfilesController {
  constructor(private readonly svc: CompanyProfilesService) {}

  @Get()
  @Roles(...READ_ROLES)
  @RequirePermission('settings:read')
  @ApiOperation({ summary: 'List company export profiles for the caller tenant' })
  list(@Request() req: any) {
    return this.svc.list(req.user?.tenantId);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  @RequirePermission('settings:read')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  @RequirePermission('settings:create')
  create(@Body() body: any, @Request() req: any) {
    return this.svc.create(body, req.user?.tenantId);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @RequirePermission('settings:update')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  @RequirePermission('settings:delete')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
