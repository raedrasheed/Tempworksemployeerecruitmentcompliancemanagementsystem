/**
 * Phase 2.6 — TenantPrisma pilot isolation harness.
 *
 * Roles is a GLOBAL module: Role, Permission, RolePermission live in
 * `GLOBAL_MODELS`. The "isolation" check therefore proves a different
 * property than the tenant-scoped harnesses:
 *
 *   1. With pilot OFF, RolesService talks to the underlying Prisma — no
 *      tenant gates anywhere.
 *   2. With pilot ON in a safe env, RolesService talks to
 *      TenantPrismaService.client. Because the model classifier returns
 *      GLOBAL for Role/Permission/RolePermission, the wrapper does NOT
 *      filter by tenant — global rows are visible identically across
 *      tenant contexts. We assert that explicitly so a future change
 *      that accidentally re-classifies these as TENANT_SCOPED would
 *      fail this test loudly.
 *   3. Concurrent ALS frames carrying different tenants both see the
 *      same global Role rows.
 *   4. With pilot OFF the legacy path remains usable.
 *   5. The pilot accessor refuses to engage when env is unsafe — even
 *      with the flag turned on. (Simulated by overriding NODE_ENV.)
 *
 * Output:
 *   backend/reports/saas/phase2/tenantprisma-pilot-isolation.{json,md}
 *
 * Exit:
 *   0 — every assertion holds
 *   2 — at least one isolation failure
 *   3 — runtime error
 */
/* eslint-disable no-console */
import { promises as fs } from 'fs';
import path from 'path';
import { autoLoadEnv, formatDatabaseUrlMissingMessage } from './../phase1/reconciliation/lib/env';
import { classifyRuntimeEnv, isStagingClassification } from '../../../src/saas/tenancy/env-safety';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TenantPrismaService } from '../../../src/saas/prisma/tenant-prisma.service';
import { PilotPrismaAccessor } from '../../../src/saas/prisma/pilot-prisma.accessor';
import { FeatureFlagsService } from '../../../src/saas/feature-flags/feature-flags.service';
import { RolesService } from '../../../src/roles/roles.service';
import {
  TenantContext,
  withRequestContext,
  newRequestId,
} from '../../../src/saas/context/als';
import { classify, GLOBAL_MODELS } from '../../../src/saas/prisma/tenant-scoped-models';

autoLoadEnv(__filename);

const OUT_DIR = path.resolve(__dirname, '..', '..', '..', 'reports', 'saas', 'phase2');

interface CaseResult { name: string; ok: boolean; detail: string; }

class StubAuditLog { async log(_: any): Promise<void> { /* empty */ } }

async function withFlags<T>(env: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
  const prev = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try { return await fn(); }
  finally { process.env = prev; }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error(formatDatabaseUrlMissingMessage());
  const env = classifyRuntimeEnv();
  if (!isStagingClassification(env.classification)) {
    console.error(`[pilot-isolation] refusing to run on classification=${env.classification}`);
    process.exit(3);
  }

  const out: CaseResult[] = [];

  // ── 1. Model classification: pilot's tables are not tenant-scoped ──
  // Role / Permission are explicitly in GLOBAL_MODELS. RolePermission is
  // a join table — left UNKNOWN by the registry today, which is correct
  // (it has no tenantId). When TenantPrisma enforcement turns on, the
  // wrapper passes UNKNOWN models through without filtering. The pilot
  // therefore tolerates either GLOBAL or UNKNOWN for the join table.
  for (const m of ['Role', 'Permission']) {
    out.push({
      name: `model classifier: ${m} is GLOBAL`,
      ok: classify(m) === 'GLOBAL' && GLOBAL_MODELS.has(m),
      detail: `classify=${classify(m)}, inGlobal=${GLOBAL_MODELS.has(m)}`,
    });
  }
  out.push({
    name: 'model classifier: RolePermission is not TENANT-scoped',
    ok: classify('RolePermission') !== 'TENANT',
    detail: `classify=${classify('RolePermission')} (UNKNOWN ⇒ pass-through, by design)`,
  });

  // ── 2. Pilot OFF → legacy path; rows readable; pilotActive=false ──
  await withFlags({ TENANT_PRISMA_PILOT_ENABLED: 'false', TENANT_PRISMA_ENFORCEMENT: 'false' },
    async () => {
      const flags = new FeatureFlagsService();
      const prisma = new PrismaService();
      const tp = new TenantPrismaService(prisma, flags);
      const pilot = new PilotPrismaAccessor(prisma, tp, flags);
      const svc = new RolesService(prisma, new StubAuditLog() as any, pilot);
      try {
        const r = await svc.findAll('System Admin');
        out.push({
          name: 'pilot OFF → legacy reads succeed',
          ok: Array.isArray(r),
          detail: `roles=${r.length}, pilotActive=${pilot.isPilotActive()}`,
        });
        out.push({
          name: 'pilot OFF reason recorded as flag-off',
          ok: pilot.pilotReason().reason === 'TENANT_PRISMA_PILOT_ENABLED=false',
          detail: pilot.pilotReason().reason,
        });
      } finally { await prisma.$disconnect(); }
    });

  // ── 3. Pilot ON in safe env → pilot active; same row count ────────
  await withFlags({ TENANT_PRISMA_PILOT_ENABLED: 'true', TENANT_PRISMA_ENFORCEMENT: 'false' },
    async () => {
      const flags = new FeatureFlagsService();
      const prisma = new PrismaService();
      const tp = new TenantPrismaService(prisma, flags);
      const pilot = new PilotPrismaAccessor(prisma, tp, flags);
      const svc = new RolesService(prisma, new StubAuditLog() as any, pilot);
      try {
        const r = await svc.findAll('System Admin');
        out.push({
          name: 'pilot ON (safe env) → pilotActive=true',
          ok: pilot.isPilotActive() && Array.isArray(r),
          detail: `pilotActive=${pilot.isPilotActive()} reason=${pilot.pilotReason().reason}`,
        });
      } finally { await prisma.$disconnect(); }
    });

  // ── 4. Pilot ON but unsafe env override → pilot refuses ───────────
  await withFlags(
    { TENANT_PRISMA_PILOT_ENABLED: 'true', NODE_ENV: 'production' },
    async () => {
      const flags = new FeatureFlagsService();
      const prisma = new PrismaService();
      const tp = new TenantPrismaService(prisma, flags);
      const pilot = new PilotPrismaAccessor(prisma, tp, flags);
      out.push({
        name: 'pilot ON + NODE_ENV=production → pilot refuses to engage',
        ok: !pilot.isPilotActive() && /not SAFE/i.test(pilot.pilotReason().reason),
        detail: `active=${pilot.isPilotActive()} reason=${pilot.pilotReason().reason}`,
      });
      await prisma.$disconnect();
    });

  // ── 5. Cross-tenant ALS contexts both see the same global rows ────
  await withFlags({ TENANT_PRISMA_PILOT_ENABLED: 'true' }, async () => {
    const flags = new FeatureFlagsService();
    const prisma = new PrismaService();
    const tp = new TenantPrismaService(prisma, flags);
    const pilot = new PilotPrismaAccessor(prisma, tp, flags);
    const svc = new RolesService(prisma, new StubAuditLog() as any, pilot);
    try {
      const T1 = '11111111-1111-1111-1111-111111111111';
      const T2 = '22222222-2222-2222-2222-222222222222';
      const seen: Array<{ t: string; n: number }> = [];
      await Promise.all([
        withRequestContext({ requestId: newRequestId() }, async () => {
          TenantContext.attach({ id: T1, slug: 'a', name: 'A', status: 'ACTIVE', region: 'eu' });
          await new Promise((r) => setTimeout(r, 5));
          const rs = await svc.findAll('System Admin');
          seen.push({ t: T1, n: rs.length });
        }),
        withRequestContext({ requestId: newRequestId() }, async () => {
          TenantContext.attach({ id: T2, slug: 'b', name: 'B', status: 'ACTIVE', region: 'eu' });
          await new Promise((r) => setTimeout(r, 1));
          const rs = await svc.findAll('System Admin');
          seen.push({ t: T2, n: rs.length });
        }),
      ]);
      const equal = seen.length === 2 && seen[0].n === seen[1].n;
      out.push({
        name: 'concurrent tenants see identical global rows (Role is GLOBAL)',
        ok: equal,
        detail: `seen=${JSON.stringify(seen)}`,
      });
    } finally { await prisma.$disconnect(); }
  });

  // ── 6. Pilot OFF after rollback → tenantPrismaPilotEnabled() false ─
  await withFlags({ TENANT_PRISMA_PILOT_ENABLED: 'false' }, async () => {
    const flags = new FeatureFlagsService();
    out.push({
      name: 'rollback: pilot flag off ⇒ tenantPrismaPilotEnabled() false',
      ok: flags.tenantPrismaPilotEnabled() === false,
      detail: `flag=${flags.tenantPrismaPilotEnabled()}`,
    });
  });

  await fs.mkdir(OUT_DIR, { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    environment: env,
    counts: {
      total: out.length,
      passed: out.filter((r) => r.ok).length,
      failed: out.filter((r) => !r.ok).length,
    },
    results: out,
  };
  await fs.writeFile(path.join(OUT_DIR, 'tenantprisma-pilot-isolation.json'), JSON.stringify(summary, null, 2));

  const md: string[] = [];
  md.push('# Phase 2.6 — TenantPrisma Pilot Isolation (Roles)');
  md.push('');
  md.push(`Generated: ${summary.generatedAt}`);
  md.push(`Environment: ${env.classification} (${env.reason})`);
  md.push('');
  md.push(`- Cases passed: **${summary.counts.passed}** / ${summary.counts.total}`);
  md.push(`- Cases failed: ${summary.counts.failed}`);
  md.push('');
  md.push('| # | Case | Result | Detail |');
  md.push('|--:|------|:------:|--------|');
  out.forEach((r, i) => md.push(`| ${i + 1} | ${r.name} | ${r.ok ? 'PASS' : '**FAIL**'} | ${r.detail} |`));
  await fs.writeFile(path.join(OUT_DIR, 'tenantprisma-pilot-isolation.md'), md.join('\n'));

  console.log(`tenantprisma-pilot-isolation: ${summary.counts.passed}/${summary.counts.total} cases PASS`);
  if (summary.counts.failed > 0) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(3); });
