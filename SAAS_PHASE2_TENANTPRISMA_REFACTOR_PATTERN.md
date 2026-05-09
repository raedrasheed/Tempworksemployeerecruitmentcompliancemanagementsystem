# Phase 2.6 — TenantPrisma Refactor Pattern

> The reusable shape every future module follows when adopting the
> tenant-aware Prisma access surface. Roles is the first user.

---

## 1. The accessor

`backend/src/saas/prisma/pilot-prisma.accessor.ts` exports a tiny
injectable that decides — per call — whether to return `PrismaService`
directly or `TenantPrismaService.client`:

```ts
@Injectable()
export class PilotPrismaAccessor {
  client(): PrismaService {
    if (!flags.tenantPrismaPilotEnabled()) return prisma;          // legacy
    const env = classifyRuntimeEnv();
    if (!isStagingClassification(env.classification)) return prisma; // hard guard
    return tenantPrisma.client;                                     // pilot
  }
}
```

Two safety properties:

1. **Flag OFF ⇒ legacy.** Production default. Behaviour identical to
   pre-pilot code.
2. **Unsafe env ⇒ legacy.** Even with the flag on, a misconfigured
   production deploy cannot route through `TenantPrismaService`.
   Belt-and-braces against an operator typo.

## 2. Service before / after

**Before** (legacy):

```ts
@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.role.findMany({...});
  }
}
```

**After** (pilot):

```ts
@Injectable()
export class RolesService {
  constructor(
    private legacyPrisma: PrismaService,        // kept for tests / fallback
    private auditLog: AuditLogService,
    private pilot: PilotPrismaAccessor,
  ) {}

  private get prisma(): PrismaService {
    return this.pilot.client();
  }

  findAll() {
    return this.prisma.role.findMany({...});    // unchanged call sites
  }
}
```

Key properties of this pattern:

- **Zero call-site churn.** `this.prisma.role.findMany(...)` reads the
  same way before and after. The only diff is the constructor and the
  private getter.
- **Reversible.** Remove the getter and the accessor injection, and the
  service is back to its pre-pilot form.
- **Testable.** The harnesses construct `RolesService` manually with a
  stubbed `AuditLogService` and an explicit `FeatureFlagsService`. No
  Nest boot needed.

## 3. How tenant context is obtained

For roles, none — `Role` is a global model. When a future tenant-scoped
module adopts the same pattern, `TenantContext.current()` is the source
of the active tenant. The accessor itself does not consume the tenant;
the underlying `TenantPrismaService` does (Phase 3).

## 4. How behaviour is preserved with flags OFF

`tenantPrismaPilotEnabled()` defaults to `false`. The accessor's first
branch returns `PrismaService` directly. No new code path executes.
The unit suite continues to see legacy behaviour without modification.

The equivalence harness (`saas:phase2-tenantprisma-pilot-equivalence`)
spins up both paths back-to-back and asserts byte-equal results across
13 cases.

## 5. How staging-only tenant filtering is enabled

```sh
export TENANT_PRISMA_PILOT_ENABLED=true
# DB must be a SAFE_CLONE or SAFE_STAGING host (the accessor rechecks
# at every call). Production hosts are refused.
```

Only modules that take `PilotPrismaAccessor` as a dependency observe
the change. Other modules continue to read `PrismaService` directly.
This is the single-knob, single-room property the pilot was designed
to provide.

## 6. How to test equivalence

`backend/scripts/saas/phase2/tenantprisma-pilot-equivalence.ts`:

1. Constructs `RolesService` twice — once with the flag OFF, once with
   the flag ON.
2. Calls every public method (`findAll` for three roles, `findOne`,
   `getPermissions`, `getPermissionsMatrix`, missing-id error path).
3. Compares row sets, ordering, response shape, and error class.
4. Emits JSON + Markdown to `backend/reports/saas/phase2/`.

Acceptance bar: **N/N PASS** with `0` failed cases. A regression in
either direction (legacy diverging from pilot, or vice versa) fails the
harness immediately.

## 7. How rollback works

```sh
unset TENANT_PRISMA_PILOT_ENABLED
# or:
export TENANT_PRISMA_PILOT_ENABLED=false
```

After the next process boot, `flags.tenantPrismaPilotEnabled()` returns
`false` and the accessor returns `PrismaService` for every call. No DB
mutation needs to be reversed because the pilot does not mutate any new
data path — it only rewires which client object handles the call.

The isolation harness's case 6 explicitly proves rollback: with the flag
flipped off, `tenantPrismaPilotEnabled() === false` and a fresh
`FeatureFlagsService` reflects the change.

## 8. Reusing this pattern in future modules

For each subsequent module:

1. Add `PilotPrismaAccessor` to the module's `imports` (via
   `FeatureFlagsModule` + the providers it depends on, or via
   `SaasModule` once that's globally registered).
2. Inject it into the service alongside the existing `PrismaService`.
3. Add the `private get prisma()` getter that returns `pilot.client()`.
4. (Optional) introduce a module-specific accessor if you want fine-
   grained control — e.g. only a subset of methods route through the
   pilot.
5. Add a per-module equivalence harness (copy `tenantprisma-pilot-equivalence.ts`
   and edit the assertions for the module's API surface).
6. Run the harness against a SAFE_CLONE DB.

The `PilotPrismaAccessor` itself is generic; the **module's** harness
is the new artifact each time. We are not adding per-module flags —
the single `TENANT_PRISMA_PILOT_ENABLED` is enough until Phase 3.

## 9. Anti-patterns the pattern guards against

- **Conditional wiring inside call sites.** Don't put
  `if (flags.pilotEnabled()) ...` next to every `this.prisma.foo()` call.
  Centralise the choice in the accessor.
- **Dynamic client juggling per call.** The accessor's `client()` is
  cheap (one boolean + one env-classification); don't memoize it
  globally — different processes / requests should be free to differ.
- **Production overrides without env safety.** Never let the pilot
  flag alone decide. The env classifier is a non-negotiable second
  gate.
- **Silent fallback when the wrapper throws.** The accessor returns a
  client that is structurally identical to `PrismaService`. Errors
  bubble up as before. We do not add try/catch fallbacks — those would
  hide bugs.
