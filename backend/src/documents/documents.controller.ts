import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  Query, UseGuards, HttpCode, HttpStatus, UseInterceptors,
  UploadedFile, BadRequestException,
} from '@nestjs/common';
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
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const multerStorage = diskStorage({
  destination: process.env.UPLOAD_DEST || './uploads',
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${uuidv4()}${extname(file.originalname)}`;
    cb(null, uniqueSuffix);
  },
});

const allowedMimetypes = [
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@ApiTags('Documents')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get all documents' })
  findAll(@Query() pagination: PaginationDto) {
    return this.documentsService.findAll(pagination);
  }

  @Get('expiring')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Read Only')
  @ApiOperation({ summary: 'Get documents expiring within N days' })
  @ApiParam({ name: 'days', description: 'Days threshold', required: false })
  getExpiring(@Query('days') days?: number) {
    return this.documentsService.getExpiringDocuments(days || 30);
  }

  @Get('entity/:entityType/:entityId')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User', 'Finance', 'Read Only')
  @ApiOperation({ summary: 'Get documents for a specific entity' })
  @ApiParam({ name: 'entityType', description: 'Entity type (EMPLOYEE, APPLICANT, etc.)' })
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
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post('upload')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer', 'Recruiter', 'Agency Manager', 'Agency User')
  @UseInterceptors(FileInterceptor('file', {
    storage: multerStorage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
    fileFilter: (_req, file, cb) => {
      if (allowedMimetypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`File type ${file.mimetype} not allowed`), false);
      }
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document with file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        documentTypeId: { type: 'string' },
        entityType: { type: 'string' },
        entityId: { type: 'string' },
        issueDate: { type: 'string', format: 'date' },
        expiryDate: { type: 'string', format: 'date' },
        issuer: { type: 'string' },
        documentNumber: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['file', 'name', 'documentTypeId', 'entityType', 'entityId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.documentsService.create(dto, file, user.id);
  }

  @Patch(':id')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer')
  @ApiOperation({ summary: 'Update document metadata' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateDocumentDto>,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.update(id, dto, user?.id);
  }

  @Post(':id/verify')
  @Roles('System Admin', 'HR Manager', 'Compliance Officer')
  @ApiOperation({ summary: 'Verify or reject a document' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  verify(@Param('id') id: string, @Body() dto: VerifyDocumentDto, @CurrentUser() user: any) {
    return this.documentsService.verify(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('System Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete document' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.remove(id, user?.id);
  }
}
