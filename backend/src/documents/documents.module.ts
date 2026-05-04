import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentIdService } from './document-id.service';
import { NotificationsModule } from '../notifications/notifications.module';

// Multer config now lives per-route (memoryStorage) — see
// common/storage/multer.config.ts. Files stream straight to Spaces via
// StorageService, so no global Multer dest is needed.
@Module({
  imports: [NotificationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentIdService],
  exports: [DocumentsService, DocumentIdService],
})
export class DocumentsModule {}
