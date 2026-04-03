import { Module } from '@nestjs/common';
import { JobAdsService } from './job-ads.service';
import { JobAdsController, PublicJobAdsController } from './job-ads.controller';

@Module({
  controllers: [JobAdsController, PublicJobAdsController],
  providers: [JobAdsService],
  exports: [JobAdsService],
})
export class JobAdsModule {}
