import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../auth/guards/roles.guard';
import { Roles }        from '../auth/decorators/roles.decorator';
import { BackupService } from './backup.service';
import { CreateBackupDto, ListBackupsDto, RestoreBackupDto } from './dto/backup.dto';

@ApiTags('Backup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('System Admin')
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  // ── Create backup ─────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a full database backup (System Admin only)' })
  async createBackup(@Body() dto: CreateBackupDto, @Request() req: any) {
    return this.backupService.createBackup(dto, req.user?.id, req.user?.email);
  }

  // ── List backups ──────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all database backups' })
  async findAll(@Query() dto: ListBackupsDto) {
    return this.backupService.findAll(dto);
  }

  // ── Active operation status ───────────────────────────────────────────────

  @Get('status')
  @ApiOperation({ summary: 'Check if a backup or restore is currently in progress' })
  getStatus() {
    return this.backupService.getActiveOperation();
  }

  // ── Get single backup ─────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get backup metadata by ID' })
  async findOne(@Param('id') id: string) {
    return this.backupService.findOne(id);
  }

  // ── Preview / validate restore ────────────────────────────────────────────

  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview and validate backup before restore' })
  async previewRestore(@Param('id') id: string) {
    return this.backupService.previewRestore(id);
  }

  // ── Download backup ───────────────────────────────────────────────────────

  @Get(':id/download')
  @ApiOperation({ summary: 'Download backup file (System Admin only)' })
  async download(
    @Param('id') id: string,
    @Request() req:  any,
    @Res()    res:  Response,
  ) {
    const { stream, fileName, fileSize } = await this.backupService.getDownloadStream(
      id,
      req.user?.id,
      req.user?.email,
    );

    res.set({
      'Content-Type':        'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length':      fileSize.toString(),
    });

    stream.pipe(res);
  }

  // ── Restore from backup ───────────────────────────────────────────────────

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore database from a backup (System Admin only, EXTREMELY DANGEROUS)' })
  async restore(
    @Param('id') id:   string,
    @Body()     dto:  RestoreBackupDto,
    @Request()  req:  any,
  ) {
    return this.backupService.restoreBackup(id, dto, req.user?.id, req.user?.email);
  }

  // ── Delete backup ─────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a backup file and its metadata record' })
  async deleteBackup(@Param('id') id: string, @Request() req: any) {
    return this.backupService.deleteBackup(id, req.user?.id, req.user?.email);
  }
}
