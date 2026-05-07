import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const IMAGE_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
// SVG is intentionally excluded — it can carry XSS payloads. Re-enable
// only after sanitizing on the server (e.g. DOMPurify) per file.
export const LOGO_IMAGE_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const DOCUMENT_MIME = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export interface UploadConstraints {
  /** Allowed MIME types. */
  mimeTypes: readonly string[];
  /** Max upload size in bytes. */
  maxBytes: number;
}

/**
 * Build a Multer config that buffers uploads in memory (no disk writes)
 * and enforces a MIME + size policy. Use with `FileInterceptor`:
 *
 *   @UseInterceptors(FileInterceptor('photo', memoryUpload({
 *     mimeTypes: IMAGE_MIME, maxBytes: 5 * 1024 * 1024,
 *   })))
 *
 * The handler then reads `file.buffer` and passes it to StorageService.
 */
export function memoryUpload(constraints: UploadConstraints): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: { fileSize: constraints.maxBytes },
    fileFilter: (_req, file, cb) => {
      if (!constraints.mimeTypes.includes(file.mimetype)) {
        return cb(
          new BadRequestException(
            `File type ${file.mimetype} not allowed. Allowed: ${constraints.mimeTypes.join(', ')}`,
          ),
          false,
        );
      }
      cb(null, true);
    },
  };
}
