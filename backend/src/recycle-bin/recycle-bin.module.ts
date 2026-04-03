import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LogsModule } from '../logs/logs.module';
import { RecycleBinService } from './recycle-bin.service';
import { RestoreService } from './restore.service';
import { HardDeleteService } from './hard-delete.service';
import { DatabaseCleanupService } from './database-cleanup.service';
import { RecycleBinController } from './recycle-bin.controller';

@Module({
  imports: [PrismaModule, LogsModule],
  controllers: [RecycleBinController],
  providers: [RecycleBinService, RestoreService, HardDeleteService, DatabaseCleanupService],
  exports: [RecycleBinService, RestoreService, HardDeleteService, DatabaseCleanupService],
})
export class RecycleBinModule {}
