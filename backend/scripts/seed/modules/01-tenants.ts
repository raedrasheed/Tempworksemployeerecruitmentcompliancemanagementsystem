import { prisma } from '../lib/prisma';
import { detId } from '../lib/rng';

export interface SeededTenant {
  id: string;
  slug: string;
  name: string;
}

export const TENANTS: SeededTenant[] = [
  { id: detId('tenant', 'tempworks-europe'), slug: 'tempworks-europe', name: 'TempWorks Europe' },
  { id: detId('tenant', 'rint'),             slug: 'rint',             name: 'RINT Solutions'   },
  { id: detId('tenant', 'acme'),             slug: 'acme',             name: 'Acme Staffing'    },
];

export async function seedTenants(): Promise<SeededTenant[]> {
  for (const t of TENANTS) {
    await (prisma as any).tenant.upsert({
      where: { id: t.id },
      update: { name: t.name, slug: t.slug, status: 'ACTIVE' },
      create: {
        id: t.id, slug: t.slug, name: t.name, status: 'ACTIVE', region: 'eu',
        branding: {
          tagline:      `${t.name} — Professional Recruitment Solutions`,
          primaryColor: '#2563eb',
          locale:       'en',
          timezone:     'Europe/Berlin',
        },
      },
    });
  }
  console.log(`  • tenants: ${TENANTS.length} upserted`);
  return TENANTS;
}
