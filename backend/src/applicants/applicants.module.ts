import { Module } from '@nestjs/common';
import { ApplicantsService } from './applicants.service';
import { ApplicantsController } from './applicants.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [ApplicantsController],
  providers: [ApplicantsService],
  exports: [ApplicantsService],
})
export class ApplicantsModule {}
