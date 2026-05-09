/**
 * Phase 2.1 — Read-equivalence test for tenant-safe reports.
 *
 * For every READY source, runs:
 *   (a) the legacy SQL shape (SELECT * FROM <primary> WHERE deletedAt
 *       IS NULL [+ user-supplied filters]) on the live DB
 *   (b) the tenant-safe SQL shape (with tenantId-as-$1, soft-delete,
 *       optional agency-scope filter)
 * scoped to ONE tenant, and compares row counts and row-id sets.
 *
 * The scaffolding fixture from Phase 1 (`saas_phase1_fixture`) is used
 * by default — operators can pass `--tenant <id>` to scope to a real
 * tenant on a SAFE_CLONE replica.
 *
 * Modes:
 *   --source <key>     run a single source
 *   --all              run every READY source (default)
 *   --tenant <id>      explicit tenant id (defaults to first row in `tenants`)
 *   --agency <id>      apply agency-scope filter (a.k.a. agencyIds=[id])
 *   --json --markdown  always written; flags currently no-ops
 *
 * Exit codes:
 *   0 — perfect equivalence
 *   2 — at least one source has a count or id-set delta
 *   3 — runtime error
 *
 * Reports:
 *   backend/reports/saas/phase2/reports-read-equivalence.{json,md}
 */
/* eslint-disable no-console */
import { Client } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import {
  autoLoadEnv, formatDatabaseUrlMissingMessage,
} from './../phase1/reconciliation/lib/env';
import { TENANT_SAFE_SOURCES } from '../../../src/saas/reports/runtime/report-sources';

autoLoadEnv(__filename);

const OUT_DIR = path.resolve(__dirname, '..', '..', '..', 'reports', 'saas', 'phase2');

function getDatabaseUrl(): string {
  const arg = process.argv.find((a) => a.startsWith('--db='))?.slice(5);
  const url = arg ?? process.env.DATABASE_URL;
  if (!url) throw new Error(formatDatabaseUrlMissingMessage());
  return url;
}
function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface SourceResult {
  source: string;
  status: 'READY' | 'DISABLED';
  legacyCount?: number;
  safeCount?: number;
  idsLegacy?: string[];
  idsSafe?: string[];
  setEqual?: boolean;
  delta?: { onlyLegacy: number; onlySafe: number };
  error?: string;
}

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  const requestedSource = argValue('--source');
  const requestedTenant = argValue('--tenant');
  const requestedAgency = argValue('--agency');
  const allSources = !requestedSource;

  const c = new Client({
    connectionString: url,
    ssl: /127\.0\.0\.1|localhost/.test(url) ? false : { rejectUnauthorized: false },
  });
  await c.connect();

  // Resolve a tenant id — Phase 1-applied fixture has 4; we need one.
  let tenantId = requestedTenant;
  if (!tenantId) {
    const r = await c.query<{ id: string }>(`SELECT id FROM tenants ORDER BY name LIMIT 1`);
    tenantId = r.rows[0]?.id;
    if (!tenantId) {
      console.error('No tenants in DB. Apply Phase 1 backfill first.');
      await c.end();
      process.exit(3);
    }
  }

  const sources = allSources
    ? Object.entries(TENANT_SAFE_SOURCES)
    : (TENANT_SAFE_SOURCES[requestedSource]
        ? [[requestedSource, TENANT_SAFE_SOURCES[requestedSource]] as const]
        : []);
  if (sources.length === 0) {
    console.error(`Unknown source: ${requestedSource}`);
    await c.end();
    process.exit(3);
  }

  const results: SourceResult[] = [];

  for (const [key, m] of sources) {
    if (m.status !== 'READY' || !m.def) {
      results.push({ source: key, status: 'DISABLED' });
      continue;
    }
    const def = m.def;
    const idCol = def.fields['id']?.dbCol ?? 'id';
    const tenantCol = def.tenantColumn;

    try {
      // Legacy shape: same WHERE, no tenant filter.
      const legacyParts: string[] = [];
      if (def.softDelete) legacyParts.push(`"${def.primaryAlias}"."deletedAt" IS NULL`);
      if (requestedAgency && def.agencyColumn) legacyParts.push(`"${def.primaryAlias}"."${def.agencyColumn}" = $1`);
      const legacyWhere = legacyParts.length ? `WHERE ${legacyParts.join(' AND ')}` : '';
      const legacySql = `SELECT "${def.primaryAlias}"."${idCol}"::text AS id
        FROM "${def.primaryTable}" "${def.primaryAlias}"
        ${(def.tenantAwareJoins ?? []).map((j) => `${j.joinType} JOIN "${j.table}" "${j.alias}" ON ${j.on}`).join(' ')}
        ${legacyWhere} ORDER BY id`;
      // Filter legacy to the SAME tenant for a fair comparison —
      // otherwise the legacy result includes other tenants.
      const legacyTenantFiltered = `SELECT id FROM (${legacySql}) x
        WHERE id IN (SELECT "${idCol}"::text FROM "${def.primaryTable}" WHERE "${tenantCol}" = $${requestedAgency ? 2 : 1})
        ORDER BY id`;
      const legacyParams = requestedAgency
        ? [requestedAgency, tenantId]
        : [tenantId];
      const legacy = await c.query<{ id: string }>(legacyTenantFiltered, legacyParams);

      // Safe shape: tenant-first WHERE.
      const safeParts: string[] = [`"${def.primaryAlias}"."${tenantCol}" = $1`];
      if (def.softDelete) safeParts.push(`"${def.primaryAlias}"."deletedAt" IS NULL`);
      if (requestedAgency && def.agencyColumn) safeParts.push(`"${def.primaryAlias}"."${def.agencyColumn}" = $2`);
      const safeSql = `SELECT "${def.primaryAlias}"."${idCol}"::text AS id
        FROM "${def.primaryTable}" "${def.primaryAlias}"
        ${(def.tenantAwareJoins ?? []).map((j) => `${j.joinType} JOIN "${j.table}" "${j.alias}" ON ${j.on}`).join(' ')}
        WHERE ${safeParts.join(' AND ')} ORDER BY id`;
      const safeParams = requestedAgency
        ? [tenantId, requestedAgency]
        : [tenantId];
      const safe = await c.query<{ id: string }>(safeSql, safeParams);

      const setLegacy = new Set(legacy.rows.map((r) => r.id));
      const setSafe = new Set(safe.rows.map((r) => r.id));
      const onlyLegacy = [...setLegacy].filter((x) => !setSafe.has(x)).length;
      const onlySafe = [...setSafe].filter((x) => !setLegacy.has(x)).length;
      const setEqual = onlyLegacy === 0 && onlySafe === 0;

      results.push({
        source: key,
        status: 'READY',
        legacyCount: legacy.rowCount ?? 0,
        safeCount: safe.rowCount ?? 0,
        idsLegacy: legacy.rows.slice(0, 10).map((r) => r.id),
        idsSafe: safe.rows.slice(0, 10).map((r) => r.id),
        setEqual,
        delta: { onlyLegacy, onlySafe },
      });
    } catch (e) {
      results.push({ source: key, status: 'READY', error: (e as Error).message });
    }
  }
  await c.end();

  await fs.mkdir(OUT_DIR, { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    database: url.replace(/:[^:@/]+@/, ':***@'),
    tenantId,
    agencyId: requestedAgency,
    counts: {
      total:       results.length,
      ready:       results.filter((r) => r.status === 'READY').length,
      disabled:    results.filter((r) => r.status === 'DISABLED').length,
      equal:       results.filter((r) => r.setEqual).length,
      withDelta:   results.filter((r) => r.setEqual === false).length,
      errors:      results.filter((r) => r.error).length,
    },
    results,
  };
  await fs.writeFile(path.join(OUT_DIR, 'reports-read-equivalence.json'), JSON.stringify(summary, null, 2));

  const md: string[] = [];
  md.push('# Phase 2.1 — Reports Read-Equivalence');
  md.push('');
  md.push(`Generated: ${summary.generatedAt}`);
  md.push(`Tenant: \`${tenantId}\`${requestedAgency ? ` · Agency: \`${requestedAgency}\`` : ''}`);
  md.push('');
  md.push(`- Total sources: ${summary.counts.total}`);
  md.push(`- READY: ${summary.counts.ready} (DISABLED: ${summary.counts.disabled})`);
  md.push(`- Equivalent (legacy ≡ safe): **${summary.counts.equal}**`);
  md.push(`- With deltas: ${summary.counts.withDelta}`);
  md.push(`- Errors: ${summary.counts.errors}`);
  md.push('');
  md.push('| Source | Status | Legacy n | Safe n | Equal | onlyLegacy | onlySafe | Notes |');
  md.push('|--------|--------|---------:|-------:|:-----:|-----------:|---------:|-------|');
  for (const r of results) {
    if (r.status === 'DISABLED') {
      md.push(`| \`${r.source}\` | DISABLED | — | — | — | — | — | source not yet enabled in safe mode |`);
    } else if (r.error) {
      md.push(`| \`${r.source}\` | READY | — | — | — | — | — | error: ${r.error} |`);
    } else {
      md.push(`| \`${r.source}\` | READY | ${r.legacyCount} | ${r.safeCount} | ${r.setEqual ? 'yes' : '**no**'} | ${r.delta?.onlyLegacy ?? 0} | ${r.delta?.onlySafe ?? 0} | |`);
    }
  }
  await fs.writeFile(path.join(OUT_DIR, 'reports-read-equivalence.md'), md.join('\n'));

  console.log(`reports-read-equivalence: ${summary.counts.equal}/${summary.counts.ready} sources equivalent ` +
    `(${summary.counts.withDelta} delta, ${summary.counts.errors} errors)`);
  if (summary.counts.withDelta > 0 || summary.counts.errors > 0) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(3); });
