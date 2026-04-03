import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentIdService } from './document-id.service';

@Module({
  imports: [MulterModule.register({ dest: process.env.UPLOAD_DEST || './uploads' })],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentIdService],
  exports: [DocumentsService, DocumentIdService],
})
export class DocumentsModule {}
