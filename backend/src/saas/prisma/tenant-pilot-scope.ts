/**
 * Phase 2.7 — Tenant-scoped pilot scope helper.
 *
 * The Phase 2.6 pilot (`PilotPrismaAccessor`) chose between the legacy
 * `PrismaService` and the dormant `TenantPrismaService.client`. That
 * was enough for a GLOBAL module (`roles`) because no tenant filter is
 * ever needed.
 *
 * For a tenant-scoped module the access surface is not enough — we
 * also need a tenant-equality term in WHERE clauses and a `tenantId`
 * value in CREATE data. This helper returns a small `PilotScope` that
 * the service can spread into its existing call sites without changing
 * legacy behaviour:
 *
 *   const scope = getPilotScope(this.pilot);
 *   await this.prisma.foo.findMany({
 *     where: { employeeId, deletedAt: null, ...scope.tenantWhere() },
 *   });
 *
 *   await this.prisma.foo.create({
 *     data: { employeeId, ...scope.tenantData() },
 *   });
 *
 * `scope.active` is true iff:
 *   1. `TENANT_PRISMA_PILOT_ENABLED=true`, AND
 *   2. The runtime env classifies as SAFE_CLONE / SAFE_STAGING, AND
 *   3. A tenant is in the active ALS frame.
 *
 * If any of those conditions is false, `tenantWhere()` returns `{}`
 * and `tenantData()` returns `{}` — i.e. the call site stays exactly
 * as legacy. This is the "flag OFF ⇒ legacy" property required by the
 * Phase 2 strict rules.
 */
import { TenantContext } from '../context/als';
import { PilotPrismaAccessor } from './pilot-prisma.accessor';

export interface PilotScope {
  /** Whether tenant filtering / tenant-id injection is active. */
  active: boolean;
  /** Tenant id pulled from ALS when active; null otherwise. */
  tenantId: string | null;
  /** Human-readable reason for the active/inactive state. */
  reason: string;

  /**
   * Spread into a Prisma `where` clause to add a tenantId equality
   * filter when the pilot is active. Returns `{}` otherwise.
   */
  tenantWhere(): Record<string, unknown>;

  /**
   * Spread into a Prisma `data` object on `.create({ data: ... })` to
   * persist `tenantId` when the pilot is active. Returns `{}` otherwise.
   */
  tenantData(): Record<string, unknown>;
}

const INACTIVE = (reason: string): PilotScope => ({
  active: false,
  tenantId: null,
  reason,
  tenantWhere: () => ({}),
  tenantData:  () => ({}),
});

export function getPilotScope(pilot: PilotPrismaAccessor): PilotScope {
  const r = pilot.pilotReason();
  if (!r.active) return INACTIVE(r.reason);

  const ctx = TenantContext.optional?.();
  if (!ctx?.id) return INACTIVE('pilot ON but no TenantContext in scope (legacy fallback)');

  const tenantId = ctx.id;
  return {
    active: true,
    tenantId,
    reason: r.reason,
    tenantWhere: () => ({ tenantId }),
    tenantData:  () => ({ tenantId }),
  };
}
