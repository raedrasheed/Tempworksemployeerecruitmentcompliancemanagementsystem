import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Catch, ArgumentsHost, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { Client } from 'pg';

async function runStartupMigrations() {
  const logger = new Logger('StartupMigrations');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();

    // 1. Drop unique CONSTRAINTS on applicants.email
    const constraints = await client.query(`
      SELECT con.conname
      FROM   pg_constraint con
      JOIN   pg_class       rel ON rel.oid = con.conrelid
      JOIN   pg_attribute   att ON att.attrelid = rel.oid
                               AND att.attnum = ANY(con.conkey)
      WHERE  rel.relname = 'applicants'
        AND  att.attname = 'email'
        AND  con.contype = 'u'
    `);
    for (const row of constraints.rows) {
      await client.query(`ALTER TABLE applicants DROP CONSTRAINT "${row.conname}"`);
      logger.log(`Dropped unique constraint "${row.conname}" on applicants.email`);
    }

    // 2. Drop unique INDEXES on applicants.email (Prisma may create an index not a constraint)
    const indexes = await client.query(`
      SELECT i.relname AS indexname
      FROM   pg_index ix
      JOIN   pg_class t  ON t.oid = ix.indrelid
      JOIN   pg_class i  ON i.oid = ix.indexrelid
      JOIN   pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE  t.relname     = 'applicants'
        AND  a.attname     = 'email'
        AND  ix.indisunique = true
    `);
    for (const row of indexes.rows) {
      await client.query(`DROP INDEX IF EXISTS "${row.indexname}"`);
      logger.log(`Dropped unique index "${row.indexname}" on applicants.email`);
    }

    if (constraints.rows.length === 0 && indexes.rows.length === 0) {
      logger.log('applicants.email — no unique constraint or index found');
    }

    // 3. Ensure the application_drafts table + upload columns exist.
    //    Save-for-later relies on photoUrl and documents being persisted
    //    on the draft row; without them the photo/document previews
    //    silently disappear after a page refresh.
    await client.query(`
      CREATE TABLE IF NOT EXISTS "application_drafts" (
        "id"          text PRIMARY KEY,
        "createdById" text NOT NULL UNIQUE,
        "jobAdId"     text,
        "formData"    jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt"   timestamptz NOT NULL DEFAULT now(),
        "updatedAt"   timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      ALTER TABLE "application_drafts"
        ADD COLUMN IF NOT EXISTS "photoUrl"  text
    `);
    await client.query(`
      ALTER TABLE "application_drafts"
        ADD COLUMN IF NOT EXISTS "documents" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    logger.log('application_drafts — photoUrl + documents columns ensured');

    // 4. Profile creation attribution. Adds createdById + source to
    //    applicants and employees so the UI can show who created a
    //    record and flag self-applied (public /apply) submissions.
    await client.query(`
      ALTER TABLE "applicants"
        ADD COLUMN IF NOT EXISTS "createdById" text,
        ADD COLUMN IF NOT EXISTS "source"      text NOT NULL DEFAULT 'STAFF_CREATED'
    `);
    await client.query(`
      ALTER TABLE "employees"
        ADD COLUMN IF NOT EXISTS "createdById" text,
        ADD COLUMN IF NOT EXISTS "source"      text NOT NULL DEFAULT 'STAFF_CREATED'
    `);
    // Add FKs if missing so Prisma can resolve the relation.
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applicants_createdById_fkey') THEN
          ALTER TABLE "applicants"
            ADD CONSTRAINT "applicants_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "users"(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_createdById_fkey') THEN
          ALTER TABLE "employees"
            ADD CONSTRAINT "employees_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "users"(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);
    logger.log('applicants/employees — createdById + source columns ensured');

    // 5. One-time cleanup of phantom "Profile Photo" document rows.
    //    Before the fix, the public /apply photo upload mis-classified
    //    the profile photo as the first-available DocumentType (usually
    //    Passport) while also correctly stamping applicant.photoUrl.
    //    Those Document rows serve no purpose — the photo is already on
    //    the applicant record — and just clutter the Documents tab.
    const deleted = await client.query(`
      DELETE FROM "documents"
      WHERE "entityType" = 'APPLICANT'
        AND "name" ILIKE 'Profile Photo'
    `);
    if (deleted.rowCount && deleted.rowCount > 0) {
      logger.log(`documents — removed ${deleted.rowCount} phantom "Profile Photo" row(s)`);
    }
  } catch (err: any) {
    logger.error('Startup migration error: ' + (err?.message ?? err));
  } finally {
    await client.end();
  }
}

@Catch()
class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const raw = (res as any).message;
        message = Array.isArray(raw) ? raw.join(', ') : String(raw ?? exception.message);
      }
    } else {
      message = String((exception as any)?.message || exception);
    }

    const logLine = `[${request.method}] ${request.url} → ${status}`;
    if (status >= 500) {
      this.logger.error(logLine);
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    } else {
      this.logger.warn(logLine);
    }
    response.status(status).json({ statusCode: status, message, path: request.url });
  }
}

async function bootstrap() {
  await runStartupMigrations();

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  // CORS
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:4173',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Swagger)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global exception logging
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Serve uploaded files
  // Ensure upload directories exist (safe on all OSes)
  mkdirSync(join(process.cwd(), 'uploads', 'avatars'), { recursive: true });
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('TempWorks Europe API')
    .setDescription('Employee Recruitment & Compliance Management System REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Roles', 'Role and permission management')
    .addTag('Employees', 'Employee management')
    .addTag('Applicants', 'Applicant management')
    .addTag('Applications', 'Application management')
    .addTag('Documents', 'Document management')
    .addTag('Workflow', 'Workflow and stage management')
    .addTag('Agencies', 'Agency management')
    .addTag('Compliance', 'Compliance monitoring')
    .addTag('Reports', 'Reporting and analytics')
    .addTag('Notifications', 'Notification management')
    .addTag('Settings', 'System settings')
    .addTag('Logs', 'Audit logs')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 TempWorks API running on: http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
