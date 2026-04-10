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
    // Drop any unique constraint on applicants.email (find by column, not by name)
    const res = await client.query(`
      SELECT con.conname
      FROM   pg_constraint con
      JOIN   pg_class       rel ON rel.oid = con.conrelid
      JOIN   pg_attribute   att ON att.attrelid = rel.oid
                               AND att.attnum = ANY(con.conkey)
      WHERE  rel.relname = 'applicants'
        AND  att.attname = 'email'
        AND  con.contype = 'u'
    `);
    for (const row of res.rows) {
      await client.query(`ALTER TABLE applicants DROP CONSTRAINT "${row.conname}"`);
      logger.log(`Dropped unique constraint "${row.conname}" on applicants.email`);
    }
    if (res.rows.length === 0) {
      logger.log('applicants.email unique constraint already removed');
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
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
