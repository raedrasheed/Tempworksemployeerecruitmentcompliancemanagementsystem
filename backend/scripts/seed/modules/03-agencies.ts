import { prisma } from '../lib/prisma';
import { detId, faker } from '../lib/rng';
import type { SeededTenant } from './01-tenants';

export interface SeededAgency { id: string; tenantId: string; name: string; }

export async function seedAgencies(tenants: SeededTenant[]): Promise<SeededAgency[]> {
  const out: SeededAgency[] = [];
  for (const t of tenants) {
    const a1: SeededAgency = {
      id: detId('agency', t.slug, 'primary'),
      tenantId: t.id,
      name: `${t.name} HQ`,
    };
    const a2: SeededAgency = {
      id: detId('agency', t.slug, 'branch'),
      tenantId: t.id,
      name: `${t.name} ${faker.location.city()} Branch`,
    };
    for (const a of [a1, a2]) {
      await prisma.agency.upsert({
        where: { id: a.id },
        update: { name: a.name, tenantId: t.id, status: 'ACTIVE' },
        create: {
          id: a.id, name: a.name, country: 'Germany',
          contactPerson: 'Seed Contact', email: `contact+${a.id.slice(0, 8)}@${t.slug}.example`,
          phone: '+49 30 123 4567', status: 'ACTIVE', tenantId: t.id,
          isDefault: a === a1,
        },
      });
      out.push(a);
    }
  }
  console.log(`  • agencies: ${out.length} upserted`);
  return out;
}
