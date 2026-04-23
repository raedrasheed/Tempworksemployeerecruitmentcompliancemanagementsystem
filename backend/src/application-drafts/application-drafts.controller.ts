import {
  BadRequestException, Body, Controller, Delete, Get, Param, Post, Put,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApplicationDraftsService } from './application-drafts.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { SubmitDraftDto } from './dto/submit-draft.dto';

const ROLES_THAT_CREATE_APPLICANTS = [
  'System Admin', 'HR Manager', 'Recruiter', 'Agency Manager', 'Agency User',
];

// Files land in the same `./uploads` root the rest of the app uses.
// The service moves them into /uploads/drafts/<draftId>/photo|docs so
// they're easy to purge when the draft is discarded.
const uploadStorage = diskStorage({
  destination: process.env.UPLOAD_DEST || './uploads',
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

const IMAGE_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const DOC_MIME = [
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@ApiTags('Application Drafts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('application-drafts')
export class ApplicationDraftsController {
  constructor(private readonly service: ApplicationDraftsService) {}

  @Get('mine')
  @Roles(...ROLES_THAT_CREATE_APPLICANTS)
  @RequirePermission('applicants:create')
  @ApiOperation({ summary: 'Get the caller\'s open applicant draft, or null.' })
  getMine(@CurrentUser('id') userId: string) {
    return this.service.getMine(userId);
  }

  @Put('mine')
  @Roles(...ROLES_THAT_CREATE_APPLICANTS)
  @RequirePermission('applicants:create')
  @ApiOperation({ summary: 'Upsert the caller\'s open draft. Body: { formData, jobAdId? }.' })
  saveMine(
    @CurrentUser('id') userId: string,
    @Body() dto: SaveDraftDto,
  ) {
    return this.service.saveMine(userId, dto);
  }

  @Delete('mine')
  @Roles(...ROLES_THAT_CREATE_APPLICANTS)
  @RequirePermission('applicants:create')
  @ApiOperation({ summary: 'Discard the caller\'s open draft (idempotent).' })
  deleteMine(@CurrentUser('id') userId: string) {
    return this.service.deleteMine(userId);
  }

  @Post('mine/submit')
  @Roles(...ROLES_THAT_CREATE_APPLICANTS)
  @RequirePermission('applicants:create')
  @ApiOperation({
    summary:
      'Finalise the caller\'s draft: create the Applicant (Lead) via the shared ' +
      'applicants service and delete the draft on success. Body: CreateApplicantDto ' +
      'shape with applicationData blob, same as POST /applicants.',
  })
  submitMine(@CurrentUser() user: any, @Body() dto: SubmitDraftDto) {
    return this.service.submitMine(
      { id: user?.id, role: user?.role, agencyId: user?.agencyId, agencyIsSystem: user?.agencyIsSystem },
      dto,
    );
  }

  // ── Photo ──────────────────────────────────────────────────────────────
  @Post('mine/photo')
  @Roles(...ROLES_THAT_CREATE_APPLICANTS)
  @RequirePermission('applicants:create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Attach / replace the draft\'s profile photo.' })
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', {
    storage: uploadStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!IMAGE_MIME.includes(file.mimetype)) {
        return cb(new BadRequestException('Only JPEG, PNG or WebP images are allowed'), false);
      }
      cb(null, true);
    },
  }))
  uploadPhoto(@CurrentUser('id') userId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No photo file provided');
    return this.service.uploadPhoto(userId, file);
  }

  @Delete('mine/photo')
  @Roles(...ROLES_THAT_CREATE_APPLICANTS)
  @RequirePermission('applicants:create')
  @ApiOperation({ summary: 'Remove the draft\'s profile photo.' })
  deletePhoto(@CurrentUser('id') userId: string) {
    return this.service.deletePhoto(userId);
  }

  // ── Supporting documents ───────────────────────────────────────────────
  @Post('mine/documents')
  @Roles(...ROLES_THAT_CREATE_APPLICANTS)
  @RequirePermission('applicants:create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a supporting document to the draft. Body: file + name + documentTypeName.' })
  @ApiBody({
    schema: {
      type: 'object', required: ['file'],
      properties: {
        file:             { type: 'string', format: 'binary' },
        name:             { type: 'string' },
        documentTypeName: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: uploadStorage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
    fileFilter: (_req, file, cb) => {
      if (!DOC_MIME.includes(file.mimetype)) {
        return cb(new BadRequestException(`File type ${file.mimetype} not allowed`), false);
      }
      cb(null, true);
    },
  }))
  uploadDocument(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('documentTypeName') documentTypeName: string,
    @Body('sectionKey') sectionKey: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.service.uploadDocument(
      userId,
      file,
      name || file.originalname,
      documentTypeName || 'Other',
      sectionKey || undefined,
    );
  }

  @Delete('mine/documents/:docId')
  @Roles(...ROLES_THAT_CREATE_APPLICANTS)
  @RequirePermission('applicants:create')
  @ApiOperation({ summary: 'Remove a previously-uploaded supporting document from the draft.' })
  deleteDocument(
    @CurrentUser('id') userId: string,
    @Param('docId') docId: string,
  ) {
    return this.service.deleteDocument(userId, docId);
  }
}
