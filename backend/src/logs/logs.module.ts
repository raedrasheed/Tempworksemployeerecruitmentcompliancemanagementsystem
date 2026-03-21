import { Global, Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { AuditLogService } from './audit-log.service';

@Global()
@Module({
  controllers: [LogsController],
  providers: [LogsService, AuditLogService],
  exports: [AuditLogService],
})
export class LogsModule {}
