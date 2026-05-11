# Phase 3.5 — PlatformAdmin backfill harness

**16/16 PASS**

- PASS — 1. dry-run inserts zero rows — mode=dry-run inserted=0 before=1 after=1
- PASS — 2. dry-run reports eligible system-agency user — eligible=1
- PASS — 3. apply refused when PLATFORM_ADMIN_BACKFILL_ENABLED=false — mode=dry-run reason="PLATFORM_ADMIN_BACKFILL_ENABLED is not true"
- PASS — 4. apply refused when PLATFORM_ADMIN_BACKFILL_APPLY=false — mode=dry-run reason="null"
- PASS — 5. apply refused outside SAFE_CLONE/SAFE_STAGING — mode=dry-run reason="classification=UNKNOWN is not SAFE_CLONE/SAFE_STAGING"
- PASS — 6. apply inserts PlatformAdmin SUPER for eligible user — inserted=1 level=SUPER grantedBy=phase350-backfill
- PASS — 7. apply does not duplicate or modify existing PlatformAdmin row — level=SUPPORT grantedBy=pre-existing
- PASS — 8. apply skips deleted/inactive users — inserted-deleted/inactive=0
- PASS — 9. apply does not promote non-system agency user — inserted=0
- PASS — 10. multiple system-agency membership handled deterministically or reported — multiSystemAgencies=0
- PASS — 11. Agency.isSystem remains unchanged after apply — isSystem=true
- PASS — 12. rerun apply is idempotent (second run inserts 0) — inserted=0 eligible=0
- PASS — 13. PlatformAuditLog status documented (deferred when table absent) — deferred=true
- PASS — 14. PlatformAdmin readiness report wiring intact — pkg.json
- PASS — 15. Phase 3.4 employee unique harness wiring intact — pkg.json
- PASS — 16. cumulative regression chain outputs present — present=9/9
