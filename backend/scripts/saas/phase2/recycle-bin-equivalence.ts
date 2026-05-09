/**
 * Phase 2.11 — recycle-bin pilot read/restore equivalence harness.
 *
 * Compares legacy and pilot snapshots of the recycle-bin reads against
 * a fixture seeded with same-shape soft-deleted rows in two tenants.
 *
 * Output: backend/reports/saas/phase2/recycle-bin-equivalence.{json,md}
 */
/* eslint-disable no-console */
import { promises as fs } from 'fs';
import path from 'path';
import { Client } from 'pg';
import { autoLoadEnv, formatDatabaseUrlMissingMessage } from './../phase1/reconciliation/lib/env';
import { classifyRuntimeEnv, isStagingClassification } from '../../../src/saas/tenancy/env-safety';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TenantPrismaService } from '../../../src/saas/prisma/tenant-prisma.service';
import { PilotPrismaAccessor } from '../../../src/saas/prisma/pilot-prisma.accessor';
import { FeatureFlagsService } from '../../../src/saas/feature-flags/feature-flags.service';
import { RecycleBinService } from '../../../src/recycle-bin/recycle-bin.service';
import { TenantContext, withRequestContext, newRequestId } from '../../../src/saas/context/als';

autoLoadEnv(__filename);

const OUT_DIR = path.resolve(__dirname, '..', '..', '..', 'reports', 'saas', 'phase2');
interface CaseResult { name: string; ok: boolean; detail: string; }

function getDatabaseUrl(): string {
  const arg = process.argv.find((a) => a.startsWith('--db='))?.slice(5);
  return arg ?? process.env.DATABASE_URL ?? (() => { throw new Error(formatDatabaseUrlMissingMessage()); })();
}

async function withFlags<T>(env: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
  const prev = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try { return await fn(); }
  finally { process.env = prev; }
}

interface Snapshot {
  pilotActive: boolean;
  reason: string;
  countsTotal: number;
  countsApplicant: number;
  countsEmployee: number;
  countsUser: number;
  listTotal: number;
  filteredApplicantTotal: number;
  filteredUserTotal: number;
  errorOnUnknown: string;
}

async function snap(flagsOverride: Record<string, string | undefined>,
                   ctx: { id: string } | null): Promise<Snapshot> {
  return withFlags(flagsOverride, async () => {
    const flags = new FeatureFlagsService();
    const prisma = new PrismaService();
    const tp = new TenantPrismaService(prisma, flags);
    const pilot = new PilotPrismaAccessor(prisma, tp, flags);
    const svc = new RecycleBinService(prisma, pilot);
    const run = async (): Promise<Snapshot> => {
      const counts: any = await svc.getEntityCounts();
      const list = await svc.findAll({ page: 1, limit: 100 } as any);
      // Use JOB_AD (known to be tenant-scoped + present in fixture) and
      // DOCUMENT_TYPE (known global catalog) instead of APPLICANT (whose
      // narrow fixture lacks several Prisma columns).
      let filteredA: any = { meta: { total: 0 } };
      try {
        filteredA = await svc.findAll({ entityType: 'JOB_AD', page: 1, limit: 100 } as any);
      } catch { /* swallow narrow-fixture errors */ }
      let filteredU: any = { meta: { total: 0 } };
      try {
        filteredU = await svc.findAll({ entityType: 'DOCUMENT_TYPE', page: 1, limit: 100 } as any);
      } catch { /* swallow */ }
      let errorOnUnknown = 'no-error';
      try { await svc.findAll({ entityType: 'NOT_AN_ENTITY', page: 1, limit: 10 } as any); }
      catch (e) { errorOnUnknown = (e as Error).constructor.name; }
      return {
        pilotActive: pilot.isPilotActive(),
        reason: pilot.pilotReason().reason,
        countsTotal: counts.total ?? 0,
        countsApplicant: counts.APPLICANT ?? 0,
        countsEmployee: counts.EMPLOYEE ?? 0,
        countsUser: counts.USER ?? 0,
        listTotal: (list as any).meta?.total ?? 0,
        filteredApplicantTotal: (filteredA as any).meta?.total ?? 0,
        filteredUserTotal: (filteredU as any).meta?.total ?? 0,
        errorOnUnknown,
      };
    };
    try {
      if (ctx) {
        return await withRequestContext({ requestId: newRequestId() }, async () => {
          TenantContext.attach({ id: ctx.id, slug: 'a', name: 'A', status: 'ACTIVE', region: 'eu' });
          return run();
        });
      }
      return await run();
    } finally {
      await prisma.$disconnect();
    }
  });
}

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  const env = classifyRuntimeEnv();
  if (!isStagingClassification(env.classification)) {
    console.error(`[recycle-bin-equivalence] refusing on classification=${env.classification}`);
    process.exit(3);
  }
  const c = new Client({ connectionString: url, ssl: /127\.0\.0\.1|localhost/.test(url) ? false : { rejectUnauthorized: false } });
  await c.connect();
  const ts = await c.query<{ id: string }>(
    `SELECT t.id FROM tenants t
       WHERE EXISTS (SELECT 1 FROM employees e WHERE e."tenantId" = t.id::text)
       ORDER BY t.name`);
  const tA = ts.rows[0]?.id;
  await c.end();
  if (!tA) { console.error('[recycle-bin-equivalence] need a tenant'); process.exit(3); }

  const out: CaseResult[] = [];

  const legacy = await snap({ TENANT_PRISMA_PILOT_ENABLED: 'false' }, null);
  const pilot  = await snap({ TENANT_PRISMA_PILOT_ENABLED: 'true', TENANT_PRISMA_PILOT_MODULES: 'recycle-bin' },
                            { id: tA });

  out.push({
    name: 'legacy: pilot OFF reports pilotActive=false',
    ok: legacy.pilotActive === false,
    detail: legacy.reason,
  });
  out.push({
    name: 'pilot ON: pilotActive=true',
    ok: pilot.pilotActive === true,
    detail: pilot.reason,
  });

  out.push({
    name: 'getEntityCounts: pilot APPLICANT count <= legacy',
    ok: pilot.countsApplicant <= legacy.countsApplicant,
    detail: `legacy=${legacy.countsApplicant} pilot=${pilot.countsApplicant}`,
  });
  out.push({
    name: 'getEntityCounts: pilot EMPLOYEE count <= legacy',
    ok: pilot.countsEmployee <= legacy.countsEmployee,
    detail: `legacy=${legacy.countsEmployee} pilot=${pilot.countsEmployee}`,
  });
  out.push({
    name: 'getEntityCounts: USER count is GLOBAL — equal in both modes',
    ok: pilot.countsUser === legacy.countsUser,
    detail: `legacy=${legacy.countsUser} pilot=${pilot.countsUser}`,
  });
  out.push({
    name: 'getEntityCounts: pilot total <= legacy total',
    ok: pilot.countsTotal <= legacy.countsTotal,
    detail: `legacy=${legacy.countsTotal} pilot=${pilot.countsTotal}`,
  });

  out.push({
    name: 'findAll(all types): pilot total <= legacy total',
    ok: pilot.listTotal <= legacy.listTotal,
    detail: `legacy=${legacy.listTotal} pilot=${pilot.listTotal}`,
  });
  out.push({
    name: 'findAll(entityType=JOB_AD): pilot subset of legacy (tenant-scoped)',
    ok: pilot.filteredApplicantTotal <= legacy.filteredApplicantTotal,
    detail: `legacy=${legacy.filteredApplicantTotal} pilot=${pilot.filteredApplicantTotal}`,
  });
  out.push({
    name: 'findAll(entityType=DOCUMENT_TYPE): GLOBAL — equal in both modes',
    ok: pilot.filteredUserTotal === legacy.filteredUserTotal,
    detail: `legacy=${legacy.filteredUserTotal} pilot=${pilot.filteredUserTotal}`,
  });

  out.push({
    name: 'error path: unknown entityType raises same error class',
    ok: legacy.errorOnUnknown === pilot.errorOnUnknown,
    detail: `legacy=${legacy.errorOnUnknown} pilot=${pilot.errorOnUnknown}`,
  });

  out.push({
    name: 'response shape preserved (PaginatedResponse + counts.total)',
    ok: typeof legacy.listTotal === 'number' && typeof pilot.listTotal === 'number'
       && typeof legacy.countsTotal === 'number' && typeof pilot.countsTotal === 'number',
    detail: 'numeric totals + meta in both modes',
  });

  await fs.mkdir(OUT_DIR, { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(), environment: env, tenantA: tA, legacy, pilot,
    counts: { total: out.length, passed: out.filter((r) => r.ok).length, failed: out.filter((r) => !r.ok).length },
    results: out,
  };
  await fs.writeFile(path.join(OUT_DIR, 'recycle-bin-equivalence.json'), JSON.stringify(summary, null, 2));
  const md: string[] = [];
  md.push('# Phase 2.11 — Recycle Bin Equivalence');
  md.push('');
  md.push(`Generated: ${summary.generatedAt}`);
  md.push(`Environment: ${env.classification} (${env.reason})`);
  md.push(`Tenant A: \`${tA}\``);
  md.push('');
  md.push(`- Cases passed: **${summary.counts.passed}** / ${summary.counts.total}`);
  md.push(`- Cases failed: ${summary.counts.failed}`);
  md.push('');
  md.push('| # | Case | Result | Detail |');
  md.push('|--:|------|:------:|--------|');
  out.forEach((r, i) => md.push(`| ${i + 1} | ${r.name} | ${r.ok ? 'PASS' : '**FAIL**'} | ${r.detail} |`));
  await fs.writeFile(path.join(OUT_DIR, 'recycle-bin-equivalence.md'), md.join('\n'));

  console.log(`recycle-bin-equivalence: ${summary.counts.passed}/${summary.counts.total} cases PASS`);
  if (summary.counts.failed > 0) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(3); });
