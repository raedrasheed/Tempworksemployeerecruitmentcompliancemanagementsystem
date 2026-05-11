import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { I18nModule } from './common/i18n/i18n.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { EmployeesModule } from './employees/employees.module';
import { ApplicantsModule } from './applicants/applicants.module';
import { ApplicationDraftsModule } from './application-drafts/application-drafts.module';
import { DocumentsModule } from './documents/documents.module';
import { WorkflowModule } from './workflow/workflow.module';
import { AgenciesModule } from './agencies/agencies.module';
import { ComplianceModule } from './compliance/compliance.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SettingsModule } from './settings/settings.module';
import { LogsModule } from './logs/logs.module';
import { FinanceModule } from './finance/finance.module';
import { JobAdsModule } from './job-ads/job-ads.module';
import { RecycleBinModule } from './recycle-bin/recycle-bin.module';
import { WorkflowPipelineModule } from './pipeline/pipeline.module';
import { AttendanceModule } from './attendance/attendance.module';
import { EmployeeWorkHistoryModule } from './employee-work-history/employee-work-history.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { BackupModule }   from './backup/backup.module';
import { EmailModule } from './email/email.module';
import { TenancyModule } from './saas/tenancy/tenancy.module';
import { TenantsModule } from './tenants/tenants.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Phase 2.41 — single registration so the compliance cron has a host.
    // The cron handler itself remains gated by COMPLIANCE_ALERT_SCHEDULER_ENABLED.
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    I18nModule,
    PrismaModule,
    StorageModule,
    EmailModule,
    AuthModule,
    UsersModule,
    RolesModule,
    EmployeesModule,
    ApplicantsModule,
    ApplicationDraftsModule,
    DocumentsModule,
    WorkflowModule,
    AgenciesModule,
    ComplianceModule,
    ReportsModule,
    NotificationsModule,
    SettingsModule,
    LogsModule,
    FinanceModule,
    JobAdsModule,
    RecycleBinModule,
    WorkflowPipelineModule,
    AttendanceModule,
    EmployeeWorkHistoryModule,
    VehiclesModule,
    BackupModule,
    // Phase 2.2 SaaS scaffolding. The middleware + interceptor are
    // INERT when MULTI_TENANT_ENABLED=false (production default).
    // Activates only on staging-classified hosts.
    TenancyModule,
    // Phase 3.15 — Tenant Management module (PlatformAdmin only).
    TenantsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
