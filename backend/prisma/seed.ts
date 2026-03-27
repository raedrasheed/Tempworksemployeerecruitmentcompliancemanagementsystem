import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

// Use binary engine (not WASM) by disabling SSL at the URL level so Prisma's
// native engine connects without needing pg-pool/adapter-pg (which loads WASM
// and can OOM on memory-constrained servers).
if (process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    u.searchParams.set('sslmode', 'disable');
    process.env.DATABASE_URL = u.toString();
  } catch {}
}

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // ── Permissions ──────────────────────────────────────────────────────────
  const modules = [
    'dashboard',
    'employees', 'applicants', 'applications', 'documents',
    'workflow', 'agencies', 'compliance', 'reports',
    'notifications', 'settings', 'users', 'roles', 'logs',
  ];
  const actions = ['read', 'create', 'update', 'delete'];

  const permissionData: { name: string; module: string; action: string }[] = [];
  for (const mod of modules) {
    for (const action of actions) {
      permissionData.push({ name: `${mod}:${action}`, module: mod, action });
    }
  }
  // extra special permissions
  permissionData.push({ name: 'documents:verify', module: 'documents', action: 'verify' });
  permissionData.push({ name: 'compliance:resolve', module: 'compliance', action: 'resolve' });
  permissionData.push({ name: 'reports:export', module: 'reports', action: 'export' });

  for (const p of permissionData) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
  }
  console.log(`Upserted ${permissionData.length} permissions`);

  const allPermissions = await prisma.permission.findMany();
  const pMap = new Map(allPermissions.map(p => [p.name, p.id]));

  const getPerms = (...names: string[]) =>
    names.filter(n => pMap.has(n)).map(n => ({ permissionId: pMap.get(n)! }));

  // ── Roles ─────────────────────────────────────────────────────────────────
  const rolesData = [
    {
      name: 'System Admin',
      description: 'Full system access',
      isSystem: true,
      perms: allPermissions.map(p => p.name),
    },
    {
      name: 'HR Manager',
      description: 'Manages HR processes and employees',
      isSystem: true,
      perms: [
        'dashboard:read',
        'employees:read','employees:create','employees:update',
        'applicants:read','applicants:create','applicants:update',
        'applications:read','applications:create','applications:update',
        'documents:read','documents:create','documents:update','documents:verify',
        'workflow:read','workflow:update',
        'compliance:read','compliance:resolve',
        'reports:read','reports:export',
        'notifications:read','notifications:create',
        'users:read',
        'logs:read',
      ],
    },
    {
      name: 'Compliance Officer',
      description: 'Manages compliance and document verification',
      isSystem: true,
      perms: [
        'dashboard:read',
        'employees:read','applicants:read','applications:read',
        'documents:read','documents:create','documents:update','documents:verify',
        'workflow:read','workflow:update',
        'compliance:read','compliance:resolve',
        'reports:read','reports:export',
        'notifications:read','notifications:create',
        'logs:read',
      ],
    },
    {
      name: 'Recruiter',
      description: 'Handles recruitment and applications',
      isSystem: true,
      perms: [
        'dashboard:read',
        'employees:read',
        'applicants:read','applicants:create','applicants:update',
        'applications:read','applications:create','applications:update',
        'documents:read','documents:create',
        'workflow:read',
        'compliance:read',
        'reports:read',
        'notifications:read',
        'logs:read',
      ],
    },
    {
      name: 'Agency Manager',
      description: 'Manages agency-specific employees and data',
      isSystem: true,
      perms: [
        'dashboard:read',
        'employees:read','employees:create','employees:update',
        'applicants:read','applicants:create','applicants:update',
        'applications:read',
        'documents:read','documents:create',
        'workflow:read',
        'compliance:read',
        'reports:read',
        'notifications:read',
        'users:read',
        'logs:read',
      ],
    },
    {
      name: 'Agency User',
      description: 'Basic agency-level read/create access',
      isSystem: true,
      perms: [
        'dashboard:read',
        'employees:read','applicants:read','applications:read',
        'documents:read','documents:create',
        'workflow:read',
        'notifications:read',
        'logs:read',
      ],
    },
    {
      name: 'Finance',
      description: 'Financial reporting and read access',
      isSystem: true,
      perms: [
        'dashboard:read',
        'employees:read','applicants:read','applications:read',
        'reports:read','reports:export',
        'notifications:read',
        'logs:read',
      ],
    },
    {
      name: 'Read Only',
      description: 'Read-only access across the system',
      isSystem: true,
      perms: modules.map(m => `${m}:read`),
    },
  ];

  const roleMap = new Map<string, string>();
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description, isSystem: r.isSystem },
    });
    roleMap.set(r.name, role.id);

    // set permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const rolePerms = getPerms(...r.perms);
    if (rolePerms.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolePerms.map(rp => ({ roleId: role.id, permissionId: rp.permissionId })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`Upserted ${rolesData.length} roles with permissions`);

  // ── TempWorks Owner Agency (must exist before creating admin user) ─────────
  let ownerAgency = await prisma.agency.findFirst({ where: { email: 'admin@tempworks.sk' } });
  if (!ownerAgency) {
    ownerAgency = await prisma.agency.create({
      data: {
        name: 'TempWorks',
        country: 'Slovakia',
        contactPerson: 'System Owner',
        email: 'admin@tempworks.sk',
        phone: '+421 2 0000 0000',
        status: 'ACTIVE',
        notes: 'System owner agency — headquartered in Slovakia',
      },
    });
  }
  const ownerAgencyId = ownerAgency.id;
  console.log(`Owner agency: TempWorks (Slovakia) — ${ownerAgencyId}`);

  // ── Admin User ────────────────────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@tempworks.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
  const adminRoleId = roleMap.get('System Admin')!;
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { agencyId: ownerAgencyId },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      phone: '+421 2 0000 0001',
      roleId: adminRoleId,
      agencyId: ownerAgencyId,
      status: 'ACTIVE',
    },
  });
  console.log(`Admin user: ${adminEmail} → TempWorks (Slovakia)`);

  // ── Agencies ──────────────────────────────────────────────────────────────
  const agenciesData = [
    {
      name: 'TempWorks UK Ltd',
      country: 'United Kingdom',
      contactPerson: 'John Smith',
      email: 'contact@tempworks.co.uk',
      phone: '+44 20 1234 5678',
      status: 'ACTIVE' as const,
    },
    {
      name: 'EuroDrivers GmbH',
      country: 'Germany',
      contactPerson: 'Hans Mueller',
      email: 'info@eurodrivers.de',
      phone: '+49 30 9876 5432',
      status: 'ACTIVE' as const,
    },
    {
      name: 'Nordic Logistics AS',
      country: 'Norway',
      contactPerson: 'Ingrid Hansen',
      email: 'recruiter@nordiclogistics.no',
      phone: '+47 22 333 444',
      status: 'ACTIVE' as const,
    },
  ];

  const agencyMap = new Map<string, string>();
  agencyMap.set('TempWorks', ownerAgencyId); // owner agency already created

  for (const a of agenciesData) {
    const found = await prisma.agency.findFirst({ where: { email: a.email } });
    if (found) {
      agencyMap.set(a.name, found.id);
    } else {
      const agency = await prisma.agency.create({ data: a });
      agencyMap.set(a.name, agency.id);
    }
  }
  console.log(`Upserted ${agenciesData.length + 1} agencies (including TempWorks Slovakia)`);

  // ── Workflow Stages ───────────────────────────────────────────────────────
  const workflowStages = [
    { name: 'Application Received', order: 1, category: 'INITIAL', description: 'Initial application submitted and received' },
    { name: 'Document Collection', order: 2, category: 'DOCUMENTATION', description: 'Collecting required identity and qualification documents' },
    { name: 'Document Verification', order: 3, category: 'DOCUMENTATION', description: 'Verifying authenticity of submitted documents' },
    { name: 'Background Check', order: 4, category: 'COMPLIANCE', description: 'Criminal record and employment history background check' },
    { name: 'Medical Assessment', order: 5, category: 'COMPLIANCE', description: 'Medical fitness assessment for driving duties' },
    { name: 'License Verification', order: 6, category: 'COMPLIANCE', description: 'Driving license verification and category validation' },
    { name: 'Work Permit Application', order: 7, category: 'COMPLIANCE', description: 'Applying for work permit if required' },
    { name: 'Visa Processing', order: 8, category: 'COMPLIANCE', description: 'Visa application and processing' },
    { name: 'Induction Training', order: 9, category: 'TRAINING', description: 'Company induction and onboarding training' },
    { name: 'Safety Training', order: 10, category: 'TRAINING', description: 'Health & safety and compliance training' },
    { name: 'Vehicle Familiarization', order: 11, category: 'TRAINING', description: 'Training on specific vehicle types' },
    { name: 'Contract Signing', order: 12, category: 'ADMINISTRATIVE', description: 'Employment contract signing and HR paperwork' },
    { name: 'Payroll Setup', order: 13, category: 'ADMINISTRATIVE', description: 'Payroll and banking details setup' },
    { name: 'Deployment Ready', order: 14, category: 'DEPLOYMENT', description: 'Employee cleared and ready for deployment' },
  ];

  for (const stage of workflowStages) {
    await prisma.workflowStage.upsert({
      where: { name: stage.name },
      update: {},
      create: { ...stage, category: stage.category as any, isActive: true },
    });
  }
  console.log(`Upserted ${workflowStages.length} workflow stages`);

  // ── Document Types ────────────────────────────────────────────────────────
  const documentTypes = [
    { name: 'Passport', description: 'Valid national passport', category: 'Identity', required: true, trackExpiry: true, renewalPeriodDays: 90 },
    { name: 'National ID Card', description: 'National identity card', category: 'Identity', required: false, trackExpiry: true, renewalPeriodDays: 90 },
    { name: 'Driving License', description: 'Valid driving license', category: 'Qualification', required: true, trackExpiry: true, renewalPeriodDays: 90 },
    { name: 'Work Permit', description: 'Authorisation to work in the country', category: 'Legal', required: true, trackExpiry: true, renewalPeriodDays: 60 },
    { name: 'Visa', description: 'Entry and residence visa', category: 'Legal', required: false, trackExpiry: true, renewalPeriodDays: 60 },
    { name: 'Medical Certificate', description: 'Fitness to work medical certificate', category: 'Medical', required: true, trackExpiry: true, renewalPeriodDays: 30 },
    { name: 'CPC Certificate', description: 'Certificate of Professional Competence', category: 'Qualification', required: true, trackExpiry: true, renewalPeriodDays: 60 },
    { name: 'Tachograph Card', description: 'Digital tachograph driver card', category: 'Qualification', required: true, trackExpiry: true, renewalPeriodDays: 30 },
    { name: 'DBS Check', description: 'Disclosure and Barring Service check', category: 'Background', required: true, trackExpiry: true, renewalPeriodDays: 30 },
    { name: 'Proof of Address', description: 'Recent utility bill or bank statement', category: 'Identity', required: true, trackExpiry: false },
    { name: 'National Insurance Letter', description: 'National Insurance number confirmation', category: 'Legal', required: false, trackExpiry: false },
    { name: 'Employment Contract', description: 'Signed employment contract', category: 'Administrative', required: true, trackExpiry: false },
    { name: 'Reference Letter', description: 'Professional reference from previous employer', category: 'Background', required: false, trackExpiry: false },
    { name: 'Training Certificate', description: 'Evidence of completed training', category: 'Training', required: false, trackExpiry: true, renewalPeriodDays: 365 },
    { name: 'DVLA Check', description: 'DVLA licence check result', category: 'Qualification', required: true, trackExpiry: true, renewalPeriodDays: 365 },
  ];

  for (const dt of documentTypes) {
    await prisma.documentType.upsert({
      where: { name: dt.name },
      update: {},
      create: { ...dt, isActive: true },
    });
  }
  console.log(`Upserted ${documentTypes.length} document types`);

  // ── Job Types ─────────────────────────────────────────────────────────────
  const jobTypes = [
    { name: 'HGV Driver Class 1', description: 'Heavy Goods Vehicle driver with Class 1 (CE) licence' },
    { name: 'HGV Driver Class 2', description: 'Heavy Goods Vehicle driver with Class 2 (C) licence' },
    { name: 'LGV Driver', description: 'Light Goods Vehicle driver' },
    { name: 'Van Driver', description: 'Van delivery driver' },
    { name: 'Multi-Drop Driver', description: 'Multi-drop parcel and goods delivery' },
    { name: 'Tanker Driver', description: 'Tanker vehicle driver' },
    { name: 'Flatbed Driver', description: 'Flatbed truck driver' },
    { name: 'Warehouse Operative', description: 'Warehouse pick, pack, and dispatch' },
    { name: 'Forklift Operator', description: 'Certified forklift operator' },
    { name: 'Transport Manager', description: 'Fleet and transport management' },
  ];

  for (const jt of jobTypes) {
    await prisma.jobType.upsert({
      where: { name: jt.name },
      update: {},
      create: { ...jt, isActive: true },
    });
  }
  console.log(`Upserted ${jobTypes.length} job types`);

  // ── System Settings ───────────────────────────────────────────────────────
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  const settings = [
    { key: 'app.name', value: 'TempWorks Compliance', description: 'Application display name', category: 'general', isPublic: true },
    { key: 'app.timezone', value: 'Europe/London', description: 'Default timezone', category: 'general', isPublic: true },
    { key: 'app.dateFormat', value: 'DD/MM/YYYY', description: 'Default date format', category: 'general', isPublic: true },
    { key: 'compliance.expiryWarningDays', value: '30', description: 'Days before expiry to trigger warning', category: 'compliance', isPublic: false },
    { key: 'compliance.criticalExpiryDays', value: '7', description: 'Days before expiry for critical alert', category: 'compliance', isPublic: false },
    { key: 'email.enabled', value: 'false', description: 'Enable email notifications', category: 'notifications', isPublic: false },
    { key: 'upload.maxSizeMb', value: '10', description: 'Maximum upload file size in MB', category: 'files', isPublic: false },
    { key: 'upload.allowedTypes', value: 'pdf,jpg,jpeg,png,doc,docx', description: 'Allowed file MIME types', category: 'files', isPublic: false },
    { key: 'auth.sessionTimeoutMin', value: '15', description: 'Access token expiry in minutes', category: 'security', isPublic: false },
    { key: 'auth.maxLoginAttempts', value: '5', description: 'Maximum failed login attempts', category: 'security', isPublic: false },
    { key: 'agency.maxUsersPerAgency', value: '5', description: 'Maximum number of users an Agency Manager can add to their agency', category: 'agency', isPublic: false },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { ...s, updatedById: adminUser?.id },
    });
  }
  console.log(`Upserted ${settings.length} system settings`);

  // ── Notification Rules ────────────────────────────────────────────────────
  const notificationRules = [
    {
      name: 'Passport Expiry Warning',
      trigger: 'DOCUMENT_EXPIRY',
      entityType: 'EMPLOYEE',
      daysBeforeExpiry: 30,
      channels: ['IN_APP', 'EMAIL'],
      recipientRoles: ['Compliance Officer', 'HR Manager'],
      isActive: true,
    },
    {
      name: 'Work Permit Expiry Critical',
      trigger: 'DOCUMENT_EXPIRY',
      entityType: 'EMPLOYEE',
      daysBeforeExpiry: 7,
      channels: ['IN_APP', 'EMAIL'],
      recipientRoles: ['Compliance Officer', 'HR Manager', 'System Admin'],
      isActive: true,
    },
    {
      name: 'Driving License Expiry',
      trigger: 'DOCUMENT_EXPIRY',
      entityType: 'EMPLOYEE',
      daysBeforeExpiry: 30,
      channels: ['IN_APP'],
      recipientRoles: ['Compliance Officer'],
      isActive: true,
    },
    {
      name: 'New Application Received',
      trigger: 'APPLICATION_SUBMITTED',
      entityType: 'APPLICATION',
      channels: ['IN_APP'],
      recipientRoles: ['Recruiter', 'HR Manager'],
      isActive: true,
    },
  ];

  for (const nr of notificationRules) {
    await prisma.notificationRule.upsert({
      where: { id: nr.name } as any,
      update: {},
      create: nr,
    }).catch(() =>
      prisma.notificationRule.create({ data: nr })
    );
  }
  console.log(`Created notification rules`);

  // ── Sample Employees ──────────────────────────────────────────────────────
  const firstAgencyId = agencyMap.get('TempWorks UK Ltd');
  const secondAgencyId = agencyMap.get('EuroDrivers GmbH');
  const allWorkflowStages = await prisma.workflowStage.findMany({ orderBy: { order: 'asc' } });

  const sampleEmployees = [
    {
      firstName: 'James',
      lastName: 'Wilson',
      email: 'james.wilson@example.com',
      phone: '+44 7700 900001',
      nationality: 'British',
      status: 'ACTIVE' as const,
      dateOfBirth: new Date('1985-03-15'),
      licenseNumber: 'WILSO853156JA9GV',
      licenseCategory: 'CE',
      yearsExperience: 12,
      agencyId: firstAgencyId!,
      addressLine1: '12 Oak Street',
      city: 'Manchester',
      country: 'United Kingdom',
      postalCode: 'M1 1AA',
    },
    {
      firstName: 'Maria',
      lastName: 'Kowalski',
      email: 'maria.kowalski@example.com',
      phone: '+44 7700 900002',
      nationality: 'Polish',
      status: 'ONBOARDING' as const,
      dateOfBirth: new Date('1990-07-22'),
      licenseNumber: 'KOWAL907229MA9GV',
      licenseCategory: 'C',
      yearsExperience: 5,
      agencyId: firstAgencyId!,
      addressLine1: '45 Birch Avenue',
      city: 'Birmingham',
      country: 'United Kingdom',
      postalCode: 'B1 1BB',
    },
    {
      firstName: 'Stefan',
      lastName: 'Bauer',
      email: 'stefan.bauer@example.com',
      phone: '+49 1511 0000001',
      nationality: 'German',
      status: 'PENDING' as const,
      dateOfBirth: new Date('1988-11-08'),
      licenseNumber: 'BAU88110843CE',
      licenseCategory: 'CE',
      yearsExperience: 8,
      agencyId: secondAgencyId!,
      addressLine1: 'Hauptstraße 15',
      city: 'Berlin',
      country: 'Germany',
      postalCode: '10115',
    },
  ];

  for (const emp of sampleEmployees) {
    const existing = await prisma.employee.findUnique({ where: { email: emp.email } });
    if (!existing) {
      const created = await prisma.employee.create({ data: emp });
      // Create workflow stages for active/onboarding employees
      if (emp.status !== 'PENDING') {
        for (const stage of allWorkflowStages.slice(0, 5)) {
          await prisma.employeeWorkflowStage.create({
            data: {
              employeeId: created.id,
              stageId: stage.id,
              status: stage.order <= 3 ? 'COMPLETED' : 'IN_PROGRESS',
              startedAt: new Date(),
              completedAt: stage.order <= 3 ? new Date() : null,
            },
          });
        }
      }
    }
  }
  console.log(`Created ${sampleEmployees.length} sample employees`);

  // ── Sample Applicants ─────────────────────────────────────────────────────
  const jobTypeHGV = await prisma.jobType.findFirst({ where: { name: 'HGV Driver Class 1' } });
  const sampleApplicants = [
    {
      firstName: 'David',
      lastName: 'Chen',
      email: 'david.chen@example.com',
      phone: '+44 7700 900010',
      nationality: 'British Chinese',
      dateOfBirth: new Date('1992-04-18'),
      status: 'SCREENING' as const,
      jobTypeId: jobTypeHGV?.id,
      residencyStatus: 'UK Citizen',
      hasNationalInsurance: true,
      nationalInsuranceNumber: 'AB123456C',
      hasWorkAuthorization: true,
      workAuthorizationType: 'British Citizen',
      availability: 'Immediate',
      willingToRelocate: false,
    },
    {
      firstName: 'Amara',
      lastName: 'Okafor',
      email: 'amara.okafor@example.com',
      phone: '+44 7700 900011',
      nationality: 'Nigerian',
      dateOfBirth: new Date('1987-09-30'),
      status: 'NEW' as const,
      jobTypeId: jobTypeHGV?.id,
      residencyStatus: 'Settled Status',
      hasNationalInsurance: true,
      nationalInsuranceNumber: 'CD789012E',
      hasWorkAuthorization: true,
      workAuthorizationType: 'Settled Status',
      availability: '2 weeks notice',
      willingToRelocate: true,
      preferredLocations: 'London, Birmingham',
    },
  ];

  for (const app of sampleApplicants) {
    const existing = await prisma.applicant.findUnique({ where: { email: app.email } });
    if (!existing) {
      await prisma.applicant.create({ data: app });
    }
  }
  console.log(`Created ${sampleApplicants.length} sample applicants`);

  console.log('Seed completed successfully!');
}

main()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
