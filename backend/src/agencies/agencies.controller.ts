import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AgenciesService } from './agencies.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Agencies')
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  // Public endpoint — used on login page to populate agency dropdown (no auth required)
  @Get('public')
  @ApiOperation({ summary: 'List agency id+name pairs (public, for login dropdown)' })
  listPublic() {
    return this.agenciesService.listPublic();
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @ApiOperation({ summary: 'Get all agencies' })
  findAll(@Query() pagination: PaginationDto) {
    return this.agenciesService.findAll(pagination);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get agency by ID' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  findOne(@Param('id') id: string) {
    return this.agenciesService.findOne(id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/users')
  @ApiOperation({ summary: 'Get users belonging to an agency' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  getUsers(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.agenciesService.getUsers(id, pagination);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/employees')
  @ApiOperation({ summary: 'Get employees belonging to an agency' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  getEmployees(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.agenciesService.getEmployees(id, pagination);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/stats')
  @ApiOperation({ summary: 'Get agency statistics' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  getStats(@Param('id') id: string) {
    return this.agenciesService.getStats(id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Create a new agency' })
  create(@Body() dto: CreateAgencyDto, @CurrentUser() user: any) {
    return this.agenciesService.create(dto, user?.id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Update agency' })
  update(@Param('id') id: string, @Body() dto: UpdateAgencyDto, @CurrentUser() user: any) {
    return this.agenciesService.update(id, dto, user?.id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete agency' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.agenciesService.remove(id, user?.id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/manager')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Set the manager for an agency' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  setManager(@Param('id') id: string, @Body('userId') userId: string, @CurrentUser() user: any) {
    return this.agenciesService.setManager(id, userId, user?.id);
  }
}

  @Get()
  @ApiOperation({ summary: 'Get all agencies' })
  findAll(@Query() pagination: PaginationDto) {
    return this.agenciesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agency by ID' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  findOne(@Param('id') id: string) {
    return this.agenciesService.findOne(id);
  }

  @Get(':id/users')
  @ApiOperation({ summary: 'Get users belonging to an agency' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  getUsers(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.agenciesService.getUsers(id, pagination);
  }

  @Get(':id/employees')
  @ApiOperation({ summary: 'Get employees belonging to an agency' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  getEmployees(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.agenciesService.getEmployees(id, pagination);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get agency statistics' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  getStats(@Param('id') id: string) {
    return this.agenciesService.getStats(id);
  }

  @Post()
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Create a new agency' })
  create(@Body() dto: CreateAgencyDto, @CurrentUser() user: any) {
    return this.agenciesService.create(dto, user?.id);
  }

  @Patch(':id')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Update agency' })
  update(@Param('id') id: string, @Body() dto: UpdateAgencyDto, @CurrentUser() user: any) {
    return this.agenciesService.update(id, dto, user?.id);
  }

  @Delete(':id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete agency' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.agenciesService.remove(id, user?.id);
  }

  @Patch(':id/manager')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Set the manager for an agency' })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  setManager(@Param('id') id: string, @Body('userId') userId: string, @CurrentUser() user: any) {
    return this.agenciesService.setManager(id, userId, user?.id);
  }
}
