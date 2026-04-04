import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../logs/audit-log.service';
import { PaginatedResponse } from '../common/dto/pagination-response.dto';
import { CreateBackupDto, ListBackupsDto, RestoreBackupDto, RestoreMode } from './dto/backup.dto';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// ── Helpers ────────────────────────────────────────────────────────────────────

interface DBConn {
  host:     string;
  port:     number;
  database: string;
  username: string;
  password: string;
}

function parseDatabaseUrl(url: string): DBConn {
  const u = new URL(url);
  return {
    host:     u.hostname || 'localhost',
    port:     parseInt(u.port || '5432', 10),
    database: u.pathname.slice(1),
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

/** Search common paths + PATH for a binary, return first found absolute path */
function findBinary(name: string): string | null {
  const isWin = process.platform === 'win32';
  const ext   = isWin ? '.exe' : '';
  const bin   = name + ext;

  // 1. Caller-supplied env override (highest priority)
  const envOverride = process.env.PG_BIN_PATH
    ? path.join(process.env.PG_BIN_PATH, bin)
    : null;
  if (envOverride && fs.existsSync(envOverride)) return envOverride;

  // 2. Common Linux/macOS paths
  const unixPaths = [
    `/usr/bin/${bin}`,
    `/usr/local/bin/${bin}`,
    `/opt/homebrew/bin/${bin}`,
    `/opt/homebrew/opt/postgresql@16/bin/${bin}`,
    `/opt/homebrew/opt/postgresql@15/bin/${bin}`,
    `/opt/homebrew/opt/postgresql@14/bin/${bin}`,
  ];
  for (let v = 20; v >= 10; v--) {
    unixPaths.push(`/usr/lib/postgresql/${v}/bin/${bin}`);
  }

  // 3. Windows: scan Program Files\PostgreSQL for any installed version
  const winPaths: string[] = [];
  if (isWin) {
    const roots = [
      'C:\\Program Files\\PostgreSQL',
      'C:\\Program Files (x86)\\PostgreSQL',
    ];
    for (const root of roots) {
      try {
        if (fs.existsSync(root)) {
          const versions = fs.readdirSync(root)
            .filter(d => /^\d+/.test(d))
            .sort((a, b) => parseFloat(b) - parseFloat(a)); // newest first
          for (const v of versions) {
            winPaths.push(`${root}\\${v}\\bin\\${bin}`);
          }
        }
      } catch { /* ignore read errors */ }
    }
  }

  for (const p of [...unixPaths, ...winPaths]) {
    if (fs.existsSync(p)) return p;
  }

  // 4. Try every directory in PATH
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of pathDirs) {
    try {
      const full = path.join(dir, bin);
      if (fs.existsSync(full)) return full;
    } catch { /* ignore */ }
  }

  return null;
}

function formatBytes(bytes: bigint | number | null | undefined): string {
  if (!bytes) return '—';
  const n = Number(bytes);
  if (n < 1024)        return `${n} B`;
  if (n < 1048576)     return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824)  return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

const RESTORE_CONFIRM_PHRASE = 'RESTORE DATABASE';

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class BackupService {
  private readonly logger     = new Logger('BackupService');
  private readonly backupDir  : string;

  /** Simple in-process lock — prevents concurrent backup/restore operations */
  private static operationLock = false;

  constructor(
    private prisma:    PrismaService,
    private auditLog:  AuditLogService,
  ) {
    this.backupDir = process.env.BACKUP_DIR
      ? path.resolve(process.env.BACKUP_DIR)
      : path.join(process.cwd(), 'backups');
    this.ensureBackupDir();
  }

  // ── Directory helpers ─────────────────────────────────────────────────────

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      this.logger.log(`Created backup directory: ${this.backupDir}`);
    }
  }

  private backupFilePath(fileName: string): string {
    return path.join(this.backupDir, fileName);
  }

  private getFileSize(filePath: string): bigint {
    try {
      return BigInt(fs.statSync(filePath).size);
    } catch {
      return BigInt(0);
    }
  }

  // ── pg_dump / pg_restore wrappers ─────────────────────────────────────────

  private runPgDump(conn: DBConn, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pgDump = findBinary('pg_dump');
      if (!pgDump) {
        return reject(new Error(
          'pg_dump not found. Install PostgreSQL client tools or set PG_BIN_PATH env variable.',
        ));
      }

      const args = [
        '--format=custom',
        '--no-owner',
        '--no-acl',
        '--compress=6',
        `--host=${conn.host}`,
        `--port=${conn.port}`,
        `--username=${conn.username}`,
        `--dbname=${conn.database}`,
        `--file=${outputPath}`,
      ];

      this.logger.log(`Running pg_dump → ${outputPath}`);
      const child = spawn(pgDump, args, {
        env: { ...process.env, PGPASSWORD: conn.password },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      child.on('close', (code) => {
        if (code === 0) {
          this.logger.log('pg_dump completed successfully');
          resolve();
        } else {
          reject(new Error(`pg_dump exited with code ${code}: ${stderr.trim()}`));
        }
      });

      child.on('error', (err) => reject(new Error(`pg_dump spawn error: ${err.message}`)));
    });
  }

  private runPgRestore(
    conn:       DBConn,
    backupPath: string,
    mode:       RestoreMode,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const pgRestore = findBinary('pg_restore');
      if (!pgRestore) {
        return reject(new Error(
          'pg_restore not found. Install PostgreSQL client tools or set PG_BIN_PATH env variable.',
        ));
      }

      const baseArgs = [
        '--no-owner',
        '--no-acl',
        `--host=${conn.host}`,
        `--port=${conn.port}`,
        `--username=${conn.username}`,
        `--dbname=${conn.database}`,
      ];

      let extraArgs: string[];
      switch (mode) {
        case RestoreMode.FULL:
          extraArgs = ['--clean', '--if-exists'];
          break;
        case RestoreMode.DATA_ONLY:
          extraArgs = ['--data-only', '--disable-triggers'];
          break;
        case RestoreMode.CLEAN:
          // Tables are truncated by SQL before calling this
          extraArgs = ['--data-only', '--disable-triggers'];
          break;
      }

      const args = [...baseArgs, ...extraArgs, backupPath];

      this.logger.log(`Running pg_restore (mode=${mode}) ← ${backupPath}`);
      const child = spawn(pgRestore, args, {
        env: { ...process.env, PGPASSWORD: conn.password },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      child.on('close', (code) => {
        // pg_restore exits non-zero even on minor warnings; treat 1 as non-fatal
        if (code === 0 || code === 1) {
          if (stderr.trim()) this.logger.warn(`pg_restore warnings: ${stderr.trim()}`);
          this.logger.log('pg_restore completed');
          resolve();
        } else {
          reject(new Error(`pg_restore exited with code ${code}: ${stderr.trim()}`));
        }
      });

      child.on('error', (err) => reject(new Error(`pg_restore spawn error: ${err.message}`)));
    });
  }

  // ── Metadata helpers ──────────────────────────────────────────────────────

  private async collectMetadata(conn: DBConn): Promise<Record<string, any>> {
    const meta: Record<string, any> = {
      environment: process.env.NODE_ENV ?? 'unknown',
      databaseName: conn.database,
      host: conn.host,
      collectedAt: new Date().toISOString(),
    };

    try {
      // PostgreSQL version
      const vResult = await this.prisma.$queryRaw<[{ version: string }]>`SELECT version()`;
      meta.pgVersion = vResult[0]?.version ?? 'unknown';
    } catch { /* ignore */ }

    try {
      // Table row counts (approximate via pg_stat_user_tables)
      const rows = await this.prisma.$queryRaw<{ relname: string; n_live_tup: bigint }[]>`
        SELECT relname, n_live_tup
        FROM   pg_stat_user_tables
        ORDER  BY relname
      `;
      meta.tableCount = rows.length;
      meta.rowCounts  = Object.fromEntries(
        rows.map(r => [r.relname, Number(r.n_live_tup)]),
      );
      meta.estimatedTotalRows = rows.reduce((s, r) => s + Number(r.n_live_tup), 0);
    } catch { /* ignore */ }

    return meta;
  }

  // ── Truncate all tables (CLEAN mode) ─────────────────────────────────────

  private async truncateAllTables(): Promise<void> {
    // Fetch all user tables in public schema
    const tables = await this.prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename
      FROM   pg_tables
      WHERE  schemaname = 'public'
        AND  tablename  != 'system_backups'
      ORDER  BY tablename
    `;

    if (tables.length === 0) return;

    const tableList = tables
      .map(t => `"${t.tablename}"`)
      .join(', ');

    this.logger.log(`Truncating ${tables.length} tables (CLEAN mode)…`);
    await this.prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
    );
  }

  // ── Lock helpers ──────────────────────────────────────────────────────────

  private acquireLock(operation: string): void {
    if (BackupService.operationLock) {
      throw new ServiceUnavailableException(
        'Another backup or restore operation is currently in progress. Please try again later.',
      );
    }
    BackupService.operationLock = true;
    this.logger.log(`Operation lock acquired: ${operation}`);
  }

  private releaseLock(): void {
    BackupService.operationLock = false;
    this.logger.log('Operation lock released');
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Create a full pg_dump backup and register metadata */
  async createBackup(
    dto:       CreateBackupDto,
    userId?:   string,
    userEmail?: string,
  ): Promise<any> {
    this.acquireLock('createBackup');

    const conn     = parseDatabaseUrl(process.env.DATABASE_URL!);
    const id       = uuidv4();
    const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `backup_${ts}_${id.slice(0, 8)}.dump`;
    const filePath = this.backupFilePath(fileName);

    // Register as RUNNING
    const record = await (this.prisma as any).systemBackup.create({
      data: {
        id,
        fileName,
        filePath,
        backupType:  'FULL',
        status:      'RUNNING',
        notes:       dto.notes ?? null,
        createdById: userId ?? null,
      },
    });

    this.logger.log(`Backup started: ${id} → ${fileName}`);

    try {
      const metadata = await this.collectMetadata(conn);
      await this.runPgDump(conn, filePath);

      const fileSize    = this.getFileSize(filePath);
      const completedAt = new Date();

      const updated = await (this.prisma as any).systemBackup.update({
        where: { id },
        data:  {
          status:      'COMPLETED',
          fileSize,
          completedAt,
          metadata,
        },
      });

      await this.auditLog.log({
        userId,
        userEmail,
        action:   'BACKUP_CREATED',
        entity:   'SystemBackup',
        entityId: id,
        changes:  {
          fileName,
          fileSize: Number(fileSize),
          status:   'COMPLETED',
          notes:    dto.notes,
        },
      });

      this.logger.log(`Backup completed: ${id} (${formatBytes(fileSize)})`);
      return this.formatBackup(updated);
    } catch (err: any) {
      this.logger.error(`Backup failed: ${err.message}`);

      await (this.prisma as any).systemBackup.update({
        where: { id },
        data:  { status: 'FAILED', errorMessage: err.message },
      });

      await this.auditLog.log({
        userId,
        userEmail,
        action:   'BACKUP_FAILED',
        entity:   'SystemBackup',
        entityId: id,
        changes:  { fileName, error: err.message },
      });

      throw new InternalServerErrorException(`Backup failed: ${err.message}`);
    } finally {
      this.releaseLock();
    }
  }

  /** Paginated list of backups */
  async findAll(dto: ListBackupsDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, search, status } = dto;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { notes:    { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      (this.prisma as any).systemBackup.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      (this.prisma as any).systemBackup.count({ where }),
    ]);

    return PaginatedResponse.create(
      rows.map(this.formatBackup.bind(this)),
      total,
      Number(page),
      Number(limit),
    );
  }

  /** Get single backup with existence + file check */
  async findOne(id: string): Promise<any> {
    const record = await (this.prisma as any).systemBackup.findUnique({
      where:   { id },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!record) throw new NotFoundException(`Backup ${id} not found`);
    return this.formatBackup(record);
  }

  /** Stream backup file for download (returns readable stream + filename) */
  async getDownloadStream(
    id:        string,
    userId?:   string,
    userEmail?: string,
  ): Promise<{ stream: fs.ReadStream; fileName: string; fileSize: bigint }> {
    const record = await (this.prisma as any).systemBackup.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Backup ${id} not found`);
    if (record.status !== 'COMPLETED') {
      throw new BadRequestException(`Backup is not in COMPLETED state (current: ${record.status})`);
    }
    if (!fs.existsSync(record.filePath)) {
      throw new NotFoundException(`Backup file not found on disk. It may have been deleted externally.`);
    }

    await this.auditLog.log({
      userId,
      userEmail,
      action:   'BACKUP_DOWNLOADED',
      entity:   'SystemBackup',
      entityId: id,
      changes:  { fileName: record.fileName },
    });

    return {
      stream:   fs.createReadStream(record.filePath),
      fileName: record.fileName,
      fileSize: record.fileSize ?? BigInt(0),
    };
  }

  /** Preview/validate a backup before restore */
  async previewRestore(id: string): Promise<any> {
    const record = await (this.prisma as any).systemBackup.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Backup ${id} not found`);

    const fileExists = fs.existsSync(record.filePath);
    const warnings: string[] = [];
    const compatibility: Record<string, any> = {};

    if (!fileExists) {
      warnings.push('Backup file is missing from disk. Restore will fail.');
    } else {
      // Verify file is readable and non-empty
      const stat = fs.statSync(record.filePath);
      if (stat.size === 0) warnings.push('Backup file appears to be empty (0 bytes).');

      // Check if it looks like a pg_dump custom-format file (magic bytes Fc)
      try {
        const fd = fs.openSync(record.filePath, 'r');
        const buf = Buffer.alloc(5);
        fs.readSync(fd, buf, 0, 5, 0);
        fs.closeSync(fd);
        const magic = buf.slice(0, 5).toString('hex');
        // pg_dump custom format starts with 'PGDMP' (5047444d50)
        if (!magic.startsWith('5047444d50')) {
          warnings.push('File does not appear to be a valid pg_dump custom-format backup.');
        } else {
          compatibility.formatValid = true;
        }
      } catch {
        warnings.push('Could not read backup file header for validation.');
      }
    }

    // Environment mismatch warnings
    const meta = record.metadata as Record<string, any> | null;
    if (meta) {
      const currentEnv = process.env.NODE_ENV ?? 'unknown';
      if (meta.environment && meta.environment !== currentEnv) {
        warnings.push(
          `Backup was created in "${meta.environment}" environment; ` +
          `current environment is "${currentEnv}".`,
        );
      }
      if (meta.databaseName) {
        const conn = parseDatabaseUrl(process.env.DATABASE_URL!);
        if (meta.databaseName !== conn.database) {
          warnings.push(
            `Backup database name "${meta.databaseName}" differs from current "${conn.database}".`,
          );
        }
      }
    }

    // Active operation warning
    if (BackupService.operationLock) {
      warnings.push('Another backup or restore operation is currently running.');
    }

    return {
      backup: this.formatBackup(record),
      fileExists,
      warnings,
      compatibility,
      restoreOptions: [
        {
          mode: RestoreMode.FULL,
          label: 'Full Restore',
          description: 'Drop all database objects, then restore schema + data from backup.',
          risk: 'HIGH',
          notes: 'Most complete. All current schema changes made after backup will be lost.',
        },
        {
          mode: RestoreMode.DATA_ONLY,
          label: 'Data-Only Restore',
          description: 'Restore row data only. Current schema is kept as-is.',
          risk: 'MEDIUM',
          notes: 'Only safe if current schema matches the backup schema exactly.',
        },
        {
          mode: RestoreMode.CLEAN,
          label: 'Clean Data Restore',
          description: 'TRUNCATE all tables (cascade), then restore data from backup.',
          risk: 'HIGH',
          notes:
            'Good for refreshing data without touching schema. ' +
            'Current data is wiped before restore. system_backups table is preserved.',
        },
      ],
    };
  }

  /** Execute restore from a backup with selected mode */
  async restoreBackup(
    id:        string,
    dto:       RestoreBackupDto,
    userId?:   string,
    userEmail?: string,
  ): Promise<any> {
    // ── Validate confirmation phrase ───────────────────────────────────────
    if (dto.confirmPhrase !== RESTORE_CONFIRM_PHRASE) {
      throw new BadRequestException(
        `Confirmation phrase incorrect. You must type exactly: ${RESTORE_CONFIRM_PHRASE}`,
      );
    }

    // ── Load & validate backup record ──────────────────────────────────────
    const record = await (this.prisma as any).systemBackup.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Backup ${id} not found`);
    if (record.status !== 'COMPLETED') {
      throw new BadRequestException(`Backup is not in COMPLETED state (current: ${record.status})`);
    }
    if (!fs.existsSync(record.filePath)) {
      throw new NotFoundException(`Backup file not found on disk: ${record.filePath}`);
    }

    this.acquireLock(`restoreBackup:${id}`);

    const conn = parseDatabaseUrl(process.env.DATABASE_URL!);

    await this.auditLog.log({
      userId,
      userEmail,
      action:   'RESTORE_REQUESTED',
      entity:   'SystemBackup',
      entityId: id,
      changes:  {
        fileName:    record.fileName,
        restoreMode: dto.restoreMode,
        notes:       dto.notes,
      },
    });

    let safetyBackupId: string | null = null;

    try {
      // ── Auto pre-restore safety backup ───────────────────────────────────
      if (!dto.skipSafetyBackup) {
        this.logger.log('Creating pre-restore safety backup…');
        try {
          const safetyDto = { notes: `[SAFETY] Auto-backup before restore of ${record.fileName}` };
          // Release lock temporarily so createBackup can acquire it
          this.releaseLock();
          const safetyBackup = await this.createBackup(safetyDto, userId, userEmail);
          safetyBackupId = safetyBackup.id;
          this.acquireLock(`restoreBackup:${id}`); // re-acquire
          this.logger.log(`Safety backup created: ${safetyBackupId}`);
        } catch (safetyErr: any) {
          this.acquireLock(`restoreBackup:${id}`); // re-acquire regardless
          this.logger.warn(`Safety backup failed (continuing): ${safetyErr.message}`);
          await this.auditLog.log({
            userId,
            userEmail,
            action:   'BACKUP_FAILED',
            entity:   'SystemBackup',
            entityId: 'safety-backup',
            changes:  { reason: 'Pre-restore safety backup failed', error: safetyErr.message },
          });
        }
      }

      // ── Execute restore ───────────────────────────────────────────────────
      await this.auditLog.log({
        userId,
        userEmail,
        action:   'RESTORE_STARTED',
        entity:   'SystemBackup',
        entityId: id,
        changes:  {
          fileName:      record.fileName,
          restoreMode:   dto.restoreMode,
          safetyBackupId,
        },
      });

      if (dto.restoreMode === RestoreMode.CLEAN) {
        this.logger.log('Truncating all tables before CLEAN restore…');
        await this.truncateAllTables();
      }

      await this.runPgRestore(conn, record.filePath, dto.restoreMode);

      await this.auditLog.log({
        userId,
        userEmail,
        action:   'RESTORE_COMPLETED',
        entity:   'SystemBackup',
        entityId: id,
        changes:  {
          fileName:      record.fileName,
          restoreMode:   dto.restoreMode,
          safetyBackupId,
          notes:         dto.notes,
        },
      });

      this.logger.log(`Restore completed: backup=${id}, mode=${dto.restoreMode}`);

      return {
        success:       true,
        backupId:      id,
        fileName:      record.fileName,
        restoreMode:   dto.restoreMode,
        safetyBackupId,
        completedAt:   new Date().toISOString(),
        message:
          'Restore completed successfully. ' +
          (safetyBackupId
            ? `A safety backup was created (ID: ${safetyBackupId}) in case you need to revert.`
            : 'No safety backup was created (skipSafetyBackup=true).'),
      };
    } catch (err: any) {
      this.logger.error(`Restore failed: ${err.message}`);

      await this.auditLog.log({
        userId,
        userEmail,
        action:   'RESTORE_FAILED',
        entity:   'SystemBackup',
        entityId: id,
        changes:  {
          fileName:    record.fileName,
          restoreMode: dto.restoreMode,
          error:       err.message,
          safetyBackupId,
        },
      });

      throw new InternalServerErrorException(
        `Restore failed: ${err.message}. ` +
        (safetyBackupId
          ? `A safety backup exists with ID ${safetyBackupId} — you can restore from it.`
          : ''),
      );
    } finally {
      this.releaseLock();
    }
  }

  /** Delete a backup file and its metadata */
  async deleteBackup(
    id:        string,
    userId?:   string,
    userEmail?: string,
  ): Promise<{ message: string }> {
    const record = await (this.prisma as any).systemBackup.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Backup ${id} not found`);
    if (record.status === 'RUNNING') {
      throw new BadRequestException('Cannot delete a backup that is currently in progress.');
    }

    // Delete file from disk
    if (fs.existsSync(record.filePath)) {
      fs.unlinkSync(record.filePath);
      this.logger.log(`Deleted backup file: ${record.filePath}`);
    }

    // Remove metadata
    await (this.prisma as any).systemBackup.delete({ where: { id } });

    await this.auditLog.log({
      userId,
      userEmail,
      action:   'BACKUP_DELETED',
      entity:   'SystemBackup',
      entityId: id,
      changes:  { fileName: record.fileName },
    });

    return { message: `Backup "${record.fileName}" deleted successfully.` };
  }

  /** Check if a backup/restore operation is currently running */
  getActiveOperation(): { locked: boolean } {
    return { locked: BackupService.operationLock };
  }

  // ── Private formatters ────────────────────────────────────────────────────

  private formatBackup(record: any): any {
    return {
      id:          record.id,
      fileName:    record.fileName,
      fileSize:    Number(record.fileSize ?? 0),
      fileSizeHuman: formatBytes(record.fileSize),
      backupType:  record.backupType,
      status:      record.status,
      notes:       record.notes,
      errorMessage: record.errorMessage,
      metadata:    record.metadata,
      createdAt:   record.createdAt,
      completedAt: record.completedAt,
      createdBy:   record.createdBy
        ? {
            id:    record.createdBy.id,
            name:  `${record.createdBy.firstName} ${record.createdBy.lastName}`,
            email: record.createdBy.email,
          }
        : null,
      fileExists: record.filePath ? fs.existsSync(record.filePath) : false,
    };
  }
}
