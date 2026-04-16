import { Module } from '@nestjs/common';
import { WorkflowService } from './pipeline.service';
import { WorkflowController } from './pipeline.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowPipelineModule {}
