# Phase 2.10 — Notifications Module Audit

> Read the notification bell safely before rewiring the clocktower.
> Pre-refactor audit of `src/notifications`. Fourth tenant-scoped pilot.

---

## 1. Files in module

| File | Lines | Role |
|------|------|------|
| `notifications.module.ts` | 11 | Nest module |
| `notifications.controller.ts` | 48 | HTTP surface — 6 endpoints (read-mostly) |
| `notifications.service.ts` | 551 | service layer (read paths + scheduler/fanout writes) |
| `notifications-scheduler.service.ts` | 39 | cron orchestrator — calls `runAllChecks` |
| `notification-events.ts` | 147 | event-key → notification-type map |
| `dto/*.ts` | (small) | input shapes |

Total: ~796 lines across the module.

## 2. Services / controllers

- `NotificationsService` — service layer, both read-facing and
  background paths.
- `NotificationsController` — JWT-guarded routes:
  - `GET /notifications`
  - `GET /notifications/unread-count`
  - `PATCH /notifications/:id/read`
  - `PATCH /notifications/read-all`
  - `GET /notifications/preferences`
  - `PATCH /notifications/preferences`
- `NotificationsSchedulerService` — `@Cron` driver that calls
  `NotificationsService.runAllChecks` periodically.

## 3. Prisma call sites (pre-refactor)

28 direct `this.prisma.*` call sites in the service. After Phase 2.10:
- 7 routed through `this.prisma` (= pilot accessor) and annotated
  `@tenant-reviewed: phase210-pilot-scope`.
- 2 explicitly routed through `this.legacyPrisma` for the per-user
  global `NotificationPreference` (no tenantId) — annotated
  `@tenant-reviewed: phase210-global`.
- 19 explicitly routed through `this.legacyPrisma` for the
  scheduler / notify-fanout paths — annotated
  `@tenant-reviewed: phase210-excluded-background`.

## 4. Read paths (IN scope)

| Method | Behaviour |
|---|---|
| `getUserNotifications(userId, skip, take, locale)` | paginated list per-user; pilot adds `tenantId = ctx`. |
| `getUnreadCount(userId)` | count; pilot scoped. |
| `markAsRead(notificationId)` | update; pilot pre-checks tenant ownership; legacy preserves Prisma's P2025 path. |
| `markAllAsRead(userId)` | updateMany; pilot scoped. |
| `wasHighBalanceAlertRecentlySent(entityId)` | global probe today; pilot scopes to tenant so cross-tenant alerts don't suppress current-tenant alerts. |
| `getOrCreatePreferences(userId)` | upsert on `notification_preferences` (per-user GLOBAL, no tenantId) — kept on `legacyPrisma`. |
| `updatePreferences(userId, data)` | update on global preferences — kept on `legacyPrisma`. |

## 5. Mark-as-read / update paths (IN scope)

`markAsRead` was a contract bug pre-pilot: it accepted any
`notificationId` without an ownership check. Pilot mode adds the tenant
+ "user" pre-check via `findFirst({ where: { id, tenantId } })` and
raises `NotFoundException` for a foreign-tenant id. Legacy mode is
unchanged — Prisma's P2025 still surfaces for missing ids — so the
observable behaviour with the flag off is byte-identical.

## 6. Rule / settings paths

`NotificationPreference` is a per-user global record. It has NO
`tenantId` column. Phase 2.10 routes it through `legacyPrisma`
explicitly and annotates the two sites as `phase210-global`. Future
phases that need per-tenant overrides on rules/settings can introduce
a separate model.

`NotificationRule` (a different model in the schema) is also global
today and is NOT touched in Phase 2.10.

## 7. Scheduler / background-job paths (EXPLICITLY EXCLUDED)

The following paths continue to use `legacyPrisma` and are annotated
as out-of-scope for Phase 2.10:

- `checkExpiringCompliance`
- `checkServiceDue`
- `checkOverdue`
- `checkScheduledMaintenance`
- `runAllChecks`
- `notifyUploaderAndRoles`
- `notifyUsersByRoles`
- `NotificationsSchedulerService.runAllChecks`

Reasons:
- They run without an HTTP request, so no tenant context exists in ALS
  by default. Adding tenant filtering here would require a job-context
  framework (Phase 2.11+).
- They iterate "all fleet managers" / "all users with role X" across
  tenants — the global iteration is intentional; tenant-scoping it
  silently would break cross-tenant fleet observability.
- They write notifications and would need explicit per-tenant fanout
  rules. That design is out of scope here.

The isolation harness verifies (via source inspection) that all four
`check*` methods use `legacyPrisma.user.findMany`, not
`this.prisma.user.findMany`.

## 8. Model usage

| Model | Read | Write | tenantId? |
|---|---|---|---|
| `Notification` | 6 sites (all in scope) | 4 sites (all background) | yes (Phase 2.3 denorm) |
| `NotificationPreference` | 2 sites (legacy) | 2 sites (legacy) | no — per-user GLOBAL |
| `User` | 5 sites (all background) | — | global |
| `Vehicle` | 3 sites (all background) | — | (no `tenantId` today) |
| `MaintenanceRecord` | 1 site (background) | — | (no `tenantId` today) |

## 9. Tenant ownership path

```
Notification.tenantId (Phase 2.3 denorm)
  ← derived from User → Agency → Tenant at create-time
```

Phase 2.3 added `Notification.tenantId` as nullable. This pilot writes
zero new notifications (notifications are created by the excluded
background paths) — so the column population status is unchanged by
this PR.

## 10. Current use of `tenantId`

- Pre-refactor: not consulted by any read path.
- Post-refactor: every in-scope read path spreads
  `getPilotScope(this.pilot, 'notifications').tenantWhere()` into its
  `where` clause when scope is active.

## 11. Current global scans

Pre-refactor, the dashboard read path (`getUserNotifications`) scopes
by `userId` only. Phase 2.10 adds `tenantId` to the WHERE in pilot
mode. Background paths still scan all tenants — that's by design and
covered in `SAAS_PHASE2_NOTIFICATIONS_SCOPE_SPLIT.md`.

## 12. Current risks (pre-refactor)

- **Cross-tenant `notificationId` reuse:** `markAsRead(id)` accepted
  any id — a caller could mark another tenant's notification read. The
  pilot closes this hole.
- **`wasHighBalanceAlertRecentlySent` global match:** the probe uses
  only `relatedEntityId + type + createdAt`. A cross-tenant `entityId`
  collision would suppress the current tenant's alert. Pilot scope
  fixes this by adding `tenantId`.
- **Background creators always run:** the scheduler creates
  notifications for users it discovers via global queries. This
  remains intentional (out-of-scope today).

## 13. What is included in this phase

- 5 read methods + `wasHighBalanceAlertRecentlySent`.
- Module wiring (FeatureFlagsModule + accessor + TenantPrismaService).
- Module allow-list `notifications` recognised by `getPilotScope`.
- Per-call annotations on every retained `this.prisma.*` line.
- `phase210-notifications-extension.sql` fixture extension.
- Equivalence (11) + isolation (8) harnesses.

## 14. What is explicitly excluded

- `check*` methods (4 scheduler probe methods).
- `runAllChecks` / `NotificationsSchedulerService`.
- `notifyUploaderAndRoles` / `notifyUsersByRoles` (write fanout).
- Mass deletion of legacy NULL-tenant rows.
- Any `NotificationPreference` tenant scoping (it's per-user global).
- Any `NotificationRule` tenant scoping.
- Any change to the cron scheduler.

These ship in a future Phase 2.11+ once a job-context framework
exists for background workers.
