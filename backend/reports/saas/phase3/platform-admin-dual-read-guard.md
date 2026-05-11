# Phase 3.6 — PlatformAdmin dual-read guard
**14/14 PASS**
- PASS — 1. legacy Agency.isSystem=true user returns platform admin — uLegacy
- PASS — 2. PlatformAdmin row user (non-system agency) returns platform admin — uNewOnly
- PASS — 3. user with both signals returns platform admin — uBoth
- PASS — 4. user with neither signal returns false — uNeither
- PASS — 5. deleted/inactive user returns false — uDeleted
- PASS — 6. existing PlatformAdmin row is not mutated by isPlatformAdmin() — level=SUPER grantedBy=phase360-test
- PASS — 7. Agency.isSystem is not mutated by isPlatformAdmin() — isSystem=true
- PASS — 11. PlatformAuditLog write is not attempted (table absent, no error raised) — tableExists=false
- PASS — 8. missing user returns false — result=true
- PASS — 9. PLATFORM_ADMIN_DUAL_READ_ENABLED=false falls back to legacy only — uNewOnly=false uLegacy=true
- PASS — 10. source-level inventory includes all Agency.isSystem checks — totalSites=20 mustHave=3
- PASS — 12. Phase 3.5 platform-admin-backfill wiring intact — pkg.json
- PASS — 13. Phase 3.4 employee unique harness wiring intact — pkg.json
- PASS — 14. cumulative regression chain outputs present — present=10/10
## Agency.isSystem inventory (20 sites)
| file | line | text |
| --- | --- | --- |
| src/saas/platform-admin/platform-admin-access.service.ts | 46 | `select: { id: true, agency: { select: { isSystem: true } } },` |
| src/saas/platform-admin/platform-admin-access.service.ts | 52 | `return user.agency?.isSystem === true; // @tenant-reviewed: phase380-agency-is-system-fallback` |
| src/saas/platform-admin/platform-admin-access.service.ts | 64 | `if (this.legacyFallback && user.agency?.isSystem === true) {` |
| src/saas/jobs/tenant-job-fanout-planner.ts | 28 | `readonly isSystem?: boolean;` |
| src/saas/jobs/tenant-job-fanout-planner.ts | 122 | `if (excludeSys && c.isSystem === true) {` |
| src/roles/roles.service.ts | 92 | `if (role.isSystem && dto.name && dto.name !== role.name) throw new BadRequestException('Cannot rename system roles');` |
| src/roles/roles.service.ts | 122 | `if (role.isSystem) throw new BadRequestException('Cannot delete system roles');` |
| src/recycle-bin/hard-delete.service.ts | 306 | `if (record.isSystem) {` |
| src/recycle-bin/recycle-bin.service.ts | 1147 | `extra: { isSystem: r.isSystem },` |
| src/auth/auth.service.ts | 542 | `agency: user.agency ? { id: user.agency.id, name: user.agency.name, isSystem: (user.agency as any).isSystem ?? false } : null,` |
| src/auth/auth.service.ts | 543 | `agencyIsSystem: (user.agency as any)?.isSystem ?? false,` |
| src/auth/strategies/jwt.strategy.ts | 40 | `agency: { select: { isSystem: true } },` |
| src/agencies/agencies.service.ts | 64 | `return { AND: [{ OR: [{ tenantId: s.tenantId }, { isSystem: true }] }] };` |
| src/agencies/agencies.service.ts | 151 | `if (actorRole !== 'System Admin' && 'isSystem' in (dto as any)) {` |
| src/agencies/agencies.service.ts | 152 | `delete (dto as any).isSystem;` |
| src/agencies/agencies.service.ts | 182 | `'managerId', 'maxUsersPerAgency', 'isSystem',` |
| src/agencies/agencies.service.ts | 206 | `if (actor?.role !== 'System Admin' && 'isSystem' in (dto as any)) {` |
| src/agencies/agencies.service.ts | 207 | `delete (dto as any).isSystem;` |
| src/agencies/dto/create-agency.dto.ts | 39 | `@ApiPropertyOptional({ description: 'Mark this agency as the Tempworks root/owner. Users attached to an isSystem agency bypass tenancy scoping. Only System Admins can set this — the service silently d` |
| src/agencies/dto/create-agency.dto.ts | 40 | `@IsOptional() @IsBoolean() isSystem?: boolean;` |