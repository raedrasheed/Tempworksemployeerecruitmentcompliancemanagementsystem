import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @Roles('System Admin', 'HR Manager', 'Read Only')
  @ApiOperation({ summary: 'List all roles' })
  findAll() { return this.rolesService.findAll(); }

  @Get('permissions')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Get all permissions' })
  getPermissions() { return this.rolesService.getPermissions(); }

  @Get('permissions-matrix')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Get permissions matrix for all roles' })
  getPermissionsMatrix() { return this.rolesService.getPermissionsMatrix(); }

  @Get(':id')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Get role by ID' })
  findOne(@Param('id') id: string) { return this.rolesService.findOne(id); }

  @Post()
  @Roles('System Admin')
  @ApiOperation({ summary: 'Create new role' })
  create(@Body() dto: CreateRoleDto) { return this.rolesService.create(dto); }

  @Patch(':id')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Update role' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateRoleDto>) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Delete role' })
  remove(@Param('id') id: string) { return this.rolesService.remove(id); }
}
