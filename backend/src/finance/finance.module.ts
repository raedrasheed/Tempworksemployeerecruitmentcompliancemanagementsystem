import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MulterModule.register({ dest: process.env.UPLOAD_DEST || './uploads' }),
    NotificationsModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
