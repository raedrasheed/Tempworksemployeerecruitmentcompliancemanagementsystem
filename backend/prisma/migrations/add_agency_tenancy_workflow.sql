-- Agency tenancy workflow additions.
-- All changes are additive and backwards-compatible: existing rows default
-- to APPROVED so they remain visible after the upgrade.

-- ─── 1. Approval state on Applicants and Users ──────────────────────────
-- Used so agency-created candidates/users must be approved by Tempworks
-- staff before entering the internal workflow.

DO $$ BEGIN
  CREATE TYPE "AgencyApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "applicants"
  ADD COLUMN IF NOT EXISTS "approvalStatus" "AgencyApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "approvedById"   uuid,
  ADD COLUMN IF NOT EXISTS "approvedAt"     timestamp,
  ADD COLUMN IF NOT EXISTS "rejectionReason" text;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "approvalStatus"      "AgencyApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "approvedById"        uuid,
  ADD COLUMN IF NOT EXISTS "approvedAt"          timestamp,
  ADD COLUMN IF NOT EXISTS "allowManagerEdit"    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allowManagerDelete"  boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_applicants_approval_status" ON "applicants" ("approvalStatus");
CREATE INDEX IF NOT EXISTS "idx_users_approval_status"       ON "users" ("approvalStatus");

-- ─── 2. Employee-agency access grants ──────────────────────────────────
-- Admin-granted per-employee read access for agency users. No row = no
-- access, even when the employee's own agencyId matches the caller.

CREATE TABLE IF NOT EXISTS "employee_agency_access" (
  "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId"   uuid        NOT NULL REFERENCES "employees" ("id") ON DELETE CASCADE,
  "agencyId"     uuid        NOT NULL REFERENCES "agencies"  ("id") ON DELETE CASCADE,
  "grantedById"  uuid        REFERENCES "users" ("id") ON DELETE SET NULL,
  "grantedAt"    timestamp   NOT NULL DEFAULT now(),
  "notes"        text,
  UNIQUE ("employeeId", "agencyId")
);

CREATE INDEX IF NOT EXISTS "idx_employee_agency_access_agency"   ON "employee_agency_access" ("agencyId");
CREATE INDEX IF NOT EXISTS "idx_employee_agency_access_employee" ON "employee_agency_access" ("employeeId");

-- ─── 3. Agency-wide permission overrides ───────────────────────────────
-- Tempworks admin grants/denies specific permissions (e.g.
-- "applicants:create", "applicants:delete") for an entire agency.
-- Merged with the role's default permissions at login time.

CREATE TABLE IF NOT EXISTS "agency_permission_overrides" (
  "id"          uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  "agencyId"    uuid       NOT NULL REFERENCES "agencies" ("id") ON DELETE CASCADE,
  "permission"  text       NOT NULL,
  "allow"       boolean    NOT NULL DEFAULT true,
  "createdAt"   timestamp  NOT NULL DEFAULT now(),
  "updatedAt"   timestamp  NOT NULL DEFAULT now(),
  UNIQUE ("agencyId", "permission")
);

CREATE INDEX IF NOT EXISTS "idx_agency_permission_overrides_agency" ON "agency_permission_overrides" ("agencyId");
