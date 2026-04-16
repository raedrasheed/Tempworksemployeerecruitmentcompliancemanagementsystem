import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  Query, UseGuards, HttpCode, HttpStatus, UseInterceptors,
  UploadedFile, BadRequestException, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiParam, ApiConsumes, ApiBody,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import { FilterDocumentsDto } from './dto/filter-documents.dto';
import { RenewDocumentDto } from './dto/renew-document.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

const multerStorage = diskStorage({
  destination: process.env.UPLOAD_DEST || './uploads',
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

const allowedMimetypes = [
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const fileInterceptor = (optional = false) =>
  FileInterceptor('file', {
    storage: multerStorage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
    fileFilter: (_req, file, cb) => {
      if (allowedMimetypes.includes(file.mimetype)) cb(null, true);
      else cb(new BadRequestException(`File type ${file.mimetype} not allowed`), false);
    },
  });

@ApiTags('Documents')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ── List ───────────────────────────────────────────────────────────────────

  @Get()
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get all documents (filterable, sortable, paginated)' })
  findAll(@Query() filter: FilterDocumentsDto) {
    return this.documentsService.findAll(filter);
  }

  @Get('expiring')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Read Only')
  @ApiOperation({ summary: 'Get documents expiring within N days' })
  getExpiring(@Query('days') days?: number) {
    return this.documentsService.getExpiringDocuments(days || 30);
  }

  @Get('entity/:entityType/:entityId')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get all documents for a specific entity (Candidate / Employee)' })
  @ApiParam({ name: 'entityType', description: 'EMPLOYEE | APPLICANT | AGENCY | USER' })
  @ApiParam({ name: 'entityId', description: 'Entity UUID' })
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.documentsService.findByEntity(entityType, entityId, pagination);
  }

  @Get(':id')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get document by internal UUID' })
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  // ── Bulk download ──────────────────────────────────────────────────────────

  @Post('bulk-download')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download multiple documents as a structured ZIP archive' })
  async bulkDownload(@Body() dto: { ids: string[] }, @Res() res: Response) {
    if (!dto.ids?.length) { res.status(400).json({ message: 'No document IDs provided' }); return; }
    const buffer = await this.documentsService.createBulkDownloadArchive(dto.ids);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="documents_${Date.now()}.zip"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  // ── Public upload (no auth) ────────────────────────────────────────────────

  @Public()
  @Post('public/upload')
  @UseInterceptors(fileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Public document upload for applicant form submissions (no auth)' })
  @ApiBody({
    schema: {
      type: 'object', required: ['file', 'entityId', 'name'],
      properties: {
        file:             { type: 'string', format: 'binary' },
        entityId:         { type: 'string' },
        name:             { type: 'string' },
        documentTypeName: { type: 'string' },
      },
    },
  })
  async publicUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body('entityId') entityId: string,
    @Body('name') name: string,
    @Body('documentTypeName') documentTypeName: string,
  ) {
    if (!file)     throw new BadRequestException('File is required');
    if (!entityId) throw new BadRequestException('entityId is required');
    return this.documentsService.publicCreate(file, entityId, name || file.originalname, documentTypeName || 'Other');
  }

  // ── Authenticated upload ───────────────────────────────────────────────────

  @Post('upload')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User')
  @UseInterceptors(fileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document with file (authenticated)' })
  @ApiBody({
    schema: {
      type: 'object', required: ['file', 'name', 'documentTypeId', 'entityType', 'entityId'],
      properties: {
        file:           { type: 'string', format: 'binary' },
        name:           { type: 'string' },
        documentTypeId: { type: 'string' },
        entityType:     { type: 'string' },
        entityId:       { type: 'string' },
        issueDate:      { type: 'string', format: 'date' },
        expiryDate:     { type: 'string', format: 'date' },
        issueCountry:   { type: 'string' },
        issuer:         { type: 'string' },
        documentNumber: { type: 'string' },
        notes:          { type: 'string' },
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.documentsService.create(dto, file, user.id);
  }

  // ── Renew ──────────────────────────────────────────────────────────────────

  @Post(':id/renew')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager')
  @UseInterceptors(fileInterceptor(true))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Renew a document — creates a new PENDING document linked to the original',
    description: 'File upload is optional. If omitted, the original file reference is reused. The original document is not modified.',
  })
  async renew(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: RenewDocumentDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.renew(id, dto, file, user.id);
  }

  // ── Verify / reject ────────────────────────────────────────────────────────

  @Post(':id/verify')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer')
  @ApiOperation({ summary: 'Verify (approve) or reject a document' })
  verify(@Param('id') id: string, @Body() dto: VerifyDocumentDto, @CurrentUser() user: any) {
    return this.documentsService.verify(id, dto, user.id);
  }

  // ── Update metadata ────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer')
  @ApiOperation({ summary: 'Update document metadata' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateDocumentDto>, @CurrentUser() user: any) {
    return this.documentsService.update(id, dto, user?.id);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a document (System Admin only)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.remove(id, user?.id);
  }

  // ── Document-type permission matrix ───────────────────────────────────────

  @Get('type-permissions/:documentTypeId')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Get per-role permissions for a document type' })
  getDocTypePermissions(@Param('documentTypeId') documentTypeId: string) {
    return this.documentsService.getDocTypePermissions(documentTypeId);
  }

  @Post('type-permissions/:documentTypeId/:roleId')
  @Roles('System Admin', 'HR Manager')
  @ApiOperation({ summary: 'Set permissions for a role on a specific document type' })
  upsertDocTypePermission(
    @Param('documentTypeId') documentTypeId: string,
    @Param('roleId') roleId: string,
    @Body() body: { canUpload?: boolean; canView?: boolean; canEdit?: boolean; canDelete?: boolean; canRenew?: boolean },
  ) {
    return this.documentsService.upsertDocTypePermission(documentTypeId, roleId, body);
  }
}
