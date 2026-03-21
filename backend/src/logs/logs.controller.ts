import { Controller, Get, Delete, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Logs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @Roles('System Admin', 'HR Manager', 'Compliance Officer')
  @ApiOperation({ summary: 'Get audit logs with filtering and pagination' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('userId') userId?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.logsService.findAll(pagination, { userId, entity, entityId, action, fromDate, toDate });
  }

  @Get('stats')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer')
  @ApiOperation({ summary: 'Get audit log statistics' })
  getStats() {
    return this.logsService.getStats();
  }

  /** Clear all logs, optionally filtered by date range or entity. System Admin only. */
  @Delete()
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear audit logs (System Admin only)' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'entity', required: false })
  clearLogs(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('entity') entity?: string,
  ) {
    return this.logsService.clearLogs({ fromDate, toDate, entity });
  }

  /** Delete a single log entry. System Admin only. */
  @Delete(':id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a single log entry (System Admin only)' })
  deleteOne(@Param('id') id: string) {
    return this.logsService.deleteOne(id);
  }
}
