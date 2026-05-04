import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { NotificationsModule } from '../notifications/notifications.module';

// Multer config now lives per-route (memoryStorage) — see
// common/storage/multer.config.ts. No global Multer registration is
// needed here; the previous disk-storage default is incompatible with
// the Spaces-backed StorageService.
@Module({
  imports: [NotificationsModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
