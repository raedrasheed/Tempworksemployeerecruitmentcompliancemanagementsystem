#!/usr/bin/env node
/**
 * Tenant + agency ownership regression check.
 *
 * Verifies the server-side invariants the team relies on for
 * Applicant, Candidate, and Employee creation in a multi-tenant
 * setting:
 *
 *   1. No create DTO exposes a `tenantId` field. Clients must NEVER
 *      be able to choose their own tenant.
 *   2. Every create flow injects tenantId via `scope().tenantData()`
 *      (or a documented public-submit attribution helper).
 *   3. Every place that accepts a client-supplied `agencyId` validates
 *      it through `findAgencyOrFail()` BEFORE the Prisma write — so a
 *      cross-tenant id is rejected, never persisted.
 *   4. The two controllers that create people records pass the full
 *      actor object (role + agencyId + agencyIsSystem) to the service,
 *      otherwise the service can't apply the external-actor pin or
 *      decide whether to require the agency validation.
 *
 * Exits 1 on any violation so CI can block.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');

function read(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

let problems = 0;
function fail(msg) {
  problems++;
  console.log(`✗ ${msg}`);
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

// ── 1. DTOs must not expose tenantId ─────────────────────────────────────────
const dtoFiles = [
  'backend/src/applicants/dto/create-applicant.dto.ts',
  'backend/src/applicants/dto/bulk-action.dto.ts',
  'backend/src/employees/dto/create-employee.dto.ts',
];
for (const f of dtoFiles) {
  const src = read(f);
  // A real `tenantId` property on the DTO is a security hole. We
  // match on `tenantId` directly outside import lines.
  const lines = src.split('\n');
  const offending = lines
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => /^\s+tenantId\s*[?:!]/.test(line));
  if (offending.length > 0) {
    fail(`${f}: exposes tenantId on DTO`);
    for (const o of offending) console.log(`    line ${o.n}: ${o.line.trim()}`);
  } else {
    ok(`${f}: no tenantId field`);
  }
}

// ── 2. Create flows inject tenantData() ──────────────────────────────────────
const createFlows = [
  { file: 'backend/src/applicants/applicants.service.ts', method: 'async create', label: 'Applicants.create' },
  { file: 'backend/src/applicants/applicants.service.ts', method: 'async convertToEmployee', label: 'Applicants.convertToEmployee' },
  { file: 'backend/src/employees/employees.service.ts',   method: 'async create', label: 'Employees.create' },
];
for (const { file, method, label } of createFlows) {
  const src = read(file);
  const idx = src.indexOf(method);
  if (idx < 0) {
    fail(`${label}: cannot locate "${method}" in ${file}`);
    continue;
  }
  // Look at the next ~120 lines of the method body.
  const slice = src.slice(idx, idx + 6000);
  if (!/scope\(\)\.tenantData\(\)/.test(slice)) {
    fail(`${label}: does not call scope().tenantData() before the Prisma create`);
  } else {
    ok(`${label}: writes tenantId via scope().tenantData()`);
  }
}

// ── 3. Cross-tenant agency validation before write ───────────────────────────
// Check that every Prisma .create / .update that writes `agencyId`
// from client input is preceded (within the same method) by a
// findAgencyOrFail() call. We do this structurally per method.
const agencyValidationChecks = [
  {
    file: 'backend/src/applicants/applicants.service.ts',
    method: 'async create',
    label: 'Applicants.create (internal-actor agencyId validation)',
    needle: 'await this.findAgencyOrFail',
  },
  {
    file: 'backend/src/applicants/applicants.service.ts',
    method: 'async convertLeadToCandidate',
    label: 'Applicants.convertLeadToCandidate (target agency validation)',
    needle: 'await this.findAgencyOrFail(targetAgencyId)',
  },
  {
    file: 'backend/src/applicants/applicants.service.ts',
    method: 'async reassignAgency',
    label: 'Applicants.reassignAgency',
    needle: 'await this.findAgencyOrFail',
  },
  {
    file: 'backend/src/applicants/applicants.service.ts',
    method: 'async bulkAction',
    label: 'Applicants.bulkAction (ASSIGN_AGENCY pre-validation)',
    needle: 'await this.findAgencyOrFail',
  },
  {
    file: 'backend/src/employees/employees.service.ts',
    method: 'async create',
    label: 'Employees.create (internal-actor agencyId validation)',
    needle: 'await this.findAgencyOrFail',
  },
];
for (const { file, method, label, needle } of agencyValidationChecks) {
  const src = read(file);
  const idx = src.indexOf(method);
  if (idx < 0) {
    fail(`${label}: cannot locate "${method}"`);
    continue;
  }
  // Find the end of this method by counting braces. Simple
  // heuristic: read a generous window and search for the needle.
  const slice = src.slice(idx, idx + 8000);
  if (!slice.includes(needle)) {
    fail(`${label}: missing ${needle}`);
  } else {
    ok(label);
  }
}

// ── 4. convertLeadToCandidate validates BEFORE the update ────────────────────
{
  const src = read('backend/src/applicants/applicants.service.ts');
  const m = src.indexOf('async convertLeadToCandidate');
  const slice = src.slice(m, m + 6000);
  const validateAt = slice.indexOf('await this.findAgencyOrFail(targetAgencyId)');
  const updateAt   = slice.indexOf('legacyPrisma.applicant.update');
  if (validateAt < 0 || updateAt < 0) {
    fail('convertLeadToCandidate: cannot locate validation and update');
  } else if (validateAt > updateAt) {
    fail('convertLeadToCandidate: findAgencyOrFail runs AFTER applicant.update — a cross-tenant id will corrupt the row before the 404 fires');
  } else {
    ok('convertLeadToCandidate: target agency validated before update');
  }
}

// ── 5. Controllers pass full actor (role + agencyId + agencyIsSystem) ────────
const controllerChecks = [
  {
    file: 'backend/src/applicants/applicants.controller.ts',
    label: 'ApplicantsController.create passes actor',
    pattern: /\.create\([^)]*role:\s*user\?\.role[^)]*agencyId:\s*user\?\.agencyId[^)]*agencyIsSystem:\s*user\?\.agencyIsSystem/s,
  },
  {
    file: 'backend/src/employees/employees.controller.ts',
    label: 'EmployeesController.create passes actor',
    pattern: /role:\s*user\?\.role[\s\S]*?agencyId:\s*user\?\.agencyId[\s\S]*?agencyIsSystem:\s*user\?\.agencyIsSystem/,
  },
];
for (const { file, label, pattern } of controllerChecks) {
  const src = read(file);
  if (!pattern.test(src)) {
    fail(`${label}: controller does not forward role/agencyId/agencyIsSystem to the service`);
  } else {
    ok(label);
  }
}

// ── 6. EmployeesService.create signature accepts actor ───────────────────────
{
  const src = read('backend/src/employees/employees.service.ts');
  if (!/async create\([\s\S]*?actor\?\s*:\s*\{[^}]*role[^}]*agencyId[^}]*agencyIsSystem/.test(src)) {
    fail('EmployeesService.create signature missing actor parameter');
  } else {
    ok('EmployeesService.create accepts actor');
  }
}

if (problems > 0) {
  console.log(`\n${problems} ownership-assignment issue(s) found.`);
  process.exit(1);
}
console.log('\nAll tenant/agency ownership checks passed.');
