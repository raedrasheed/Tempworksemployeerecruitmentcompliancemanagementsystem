/**
 * Permissions & system-role sync.
 *
 * Adds/updates permission rows and refreshes the permission lists on every
 * system role, without touching any other seeded data (users, agencies,
 * sample employees, document types, etc.). Safe to run repeatedly.
 *
 * Run once after deploying changes that introduce new permissions:
 *   npm run db:sync-permissions
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

if (process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    u.searchParams.set('sslmode', 'disable');
    process.env.DATABASE_URL = u.toString();
  } catch {}
}

// Prisma 7.x requires a non-empty options object; pass a log level so
// construction succeeds without forcing every caller to supply datasource overrides.
const prisma = new PrismaClient({ log: ['warn', 'error'] });

const modules = [
  'dashboard',
  'employees', 'applicants', 'applications', 'documents',
  'workflow', 'agencies', 'compliance', 'reports',
  'notifications', 'settings', 'users', 'roles', 'logs',
  'vehicles', 'finance', 'attendance', 'job-ads', 'recycle-bin',
];
const actions = ['read', 'create', 'update', 'delete'];

const specialPermissions: { name: string; module: string; action: string }[] = [
  { name: 'documents:verify',      module: 'documents',   action: 'verify' },
  { name: 'compliance:resolve',    module: 'compliance',  action: 'resolve' },
  { name: 'reports:export',        module: 'reports',     action: 'export' },
  { name: 'applicants:export',     module: 'applicants',  action: 'export' },
  { name: 'employees:export',      module: 'employees',   action: 'export' },
  { name: 'vehicles:export',       module: 'vehicles',    action: 'export' },
  { name: 'finance:export',        module: 'finance',     action: 'export' },
  { name: 'attendance:export',     module: 'attendance',  action: 'export' },
  { name: 'applicants:approve',    module: 'applicants',  action: 'approve' },
  { name: 'applicants:convert',    module: 'applicants',  action: 'convert' },
  { name: 'applicants:bulk-action',module: 'applicants',  action: 'bulk-action' },
  { name: 'users:approve',         module: 'users',       action: 'approve' },
  { name: 'users:override',        module: 'users',       action: 'override' },
  { name: 'agencies:manage-permissions',    module: 'agencies',  action: 'manage-permissions' },
  { name: 'employees:manage-agency-access', module: 'employees', action: 'manage-agency-access' },
  { name: 'finance:status',        module: 'finance',     action: 'status' },
  { name: 'recycle-bin:restore',   module: 'recycle-bin', action: 'restore' },
  { name: 'job-ads:publish',       module: 'job-ads',     action: 'publish' },
];

/**
 * System role → permission names. System Admin always gets every row so its
 * list is resolved dynamically. Agency roles intentionally have no finance /
 * lead / internal-only permissions — those gates must remain Tempworks only.
 */
const rolePermissionSets: Record<string, string[]> = {
  'HR Manager': [
    'dashboard:read',
    'employees:read','employees:create','employees:update','employees:export',
    'employees:manage-agency-access',
    'applicants:read','applicants:create','applicants:update','applicants:export',
    'applicants:approve','applicants:convert','applicants:bulk-action',
    'applications:read','applications:create','applications:update',
    'documents:read','documents:create','documents:update','documents:verify',
    'workflow:read','workflow:update',
    'agencies:read','agencies:update',
    'compliance:read','compliance:resolve',
    'reports:read','reports:export',
    'notifications:read','notifications:create',
    'users:read','users:create','users:update','users:approve','users:override',
    'logs:read',
    'vehicles:read',
    'attendance:read','attendance:export',
    'job-ads:read','job-ads:create','job-ads:update','job-ads:publish',
    'recycle-bin:read',
  ],
  'Compliance Officer': [
    'dashboard:read',
    'employees:read','applicants:read','applications:read',
    'documents:read','documents:create','documents:update','documents:verify',
    'workflow:read','workflow:update',
    'compliance:read','compliance:resolve',
    'reports:read','reports:export',
    'notifications:read','notifications:create',
    'logs:read',
    'vehicles:read',
    'attendance:read',
    'recycle-bin:read',
  ],
  'Recruiter': [
    'dashboard:read',
    'employees:read',
    'applicants:read','applicants:create','applicants:update','applicants:export',
    'applicants:convert','applicants:bulk-action',
    'applications:read','applications:create','applications:update',
    'documents:read','documents:create',
    'workflow:read',
    'agencies:read',
    'compliance:read',
    'reports:read',
    'notifications:read',
    'logs:read',
    'job-ads:read','job-ads:create','job-ads:update',
    'attendance:read',
  ],
  'Agency Manager': [
    'dashboard:read',
    'employees:read',
    'applicants:read','applicants:create','applicants:update',
    'applicants:export','applicants:bulk-action',
    'applications:read',
    'documents:read','documents:create',
    'workflow:read',
    'agencies:read','agencies:update',
    'compliance:read',
    'reports:read',
    'notifications:read',
    'users:read','users:create','users:update','users:delete',
    'logs:read',
  ],
  'Agency User': [
    'dashboard:read',
    'employees:read',
    'applicants:read','applicants:create','applicants:update',
    'applications:read',
    'documents:read','documents:create',
    'workflow:read',
    'agencies:read',
    'notifications:read',
    'logs:read',
  ],
  'Finance': [
    'dashboard:read',
    'employees:read','applicants:read','applications:read',
    'agencies:read',
    'reports:read','reports:export',
    'notifications:read',
    'logs:read',
    'finance:read','finance:create','finance:update','finance:delete',
    'finance:export','finance:status',
    'attendance:read','attendance:export',
  ],
};

async function main() {
  const permissionData: { name: string; module: string; action: string }[] = [];
  for (const mod of modules) {
    for (const action of actions) {
      permissionData.push({ name: `${mod}:${action}`, module: mod, action });
    }
  }
  permissionData.push(...specialPermissions);

  for (const p of permissionData) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: { module: p.module, action: p.action },
      create: p,
    });
  }
  console.log(`Upserted ${permissionData.length} permissions`);

  const allPermissions = await prisma.permission.findMany();
  const pMap = new Map(allPermissions.map(p => [p.name, p.id]));

  const resolve = (names: string[]) =>
    names.filter(n => pMap.has(n)).map(n => pMap.get(n)!);

  // System Admin — always all permissions.
  const adminNames = allPermissions.map(p => p.name);

  const rolesToSync: Record<string, string[]> = {
    'System Admin': adminNames,
    ...rolePermissionSets,
    // Read Only picks up every `:read` permission, including new modules.
    'Read Only': allPermissions.filter(p => p.action === 'read').map(p => p.name),
  };

  for (const [roleName, names] of Object.entries(rolesToSync)) {
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) {
      console.warn(`  · Role "${roleName}" not found — skipping`);
      continue;
    }
    const permissionIds = resolve(names);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissionIds.length) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map(permissionId => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
    console.log(`  · ${roleName}: ${permissionIds.length} permissions`);
  }

  console.log('Permissions sync complete.');
}

main()
  .catch(err => { console.error('Sync failed:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
