import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogData {
  userId?: string;
  userEmail?: string;
  action: string;
  entity: string;
  entityId: string;
  changes?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private prisma: PrismaService) {}

  /** Create an audit log entry. Never throws – logging must not break the main flow. */
  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data });
    } catch (err: any) {
      this.logger.error(`Failed to write audit log: ${err?.message}`, err?.stack);
    }
  }
}
