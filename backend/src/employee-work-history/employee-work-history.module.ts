import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeeWorkHistoryService } from './employee-work-history.service';
import { EmployeeWorkHistoryController } from './employee-work-history.controller';

@Module({
  imports: [PrismaModule],
  providers: [EmployeeWorkHistoryService],
  controllers: [EmployeeWorkHistoryController],
  exports: [EmployeeWorkHistoryService],
})
export class EmployeeWorkHistoryModule {}
