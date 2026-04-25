-- =============================================================================
-- CONSOLIDATED PRODUCTION FIX
-- =============================================================================
-- Single SQL script that adds every column the current Prisma schema expects
-- but that may be missing on a production database.
--
-- Usage:
--   1. Open your PostgreSQL admin tool (pgAdmin, phpPgAdmin, Supabase SQL
--      editor, Neon SQL editor, etc.)
--   2. Connect to your production database.
--   3. Paste this entire file.
--   4. Click Run / Execute.
--
-- All operations are idempotent (IF NOT EXISTS) — safe to run multiple times.
-- =============================================================================


-- ── APPLICANTS ───────────────────────────────────────────────────────────────
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "tier"                    TEXT NOT NULL DEFAULT 'LEAD';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "middleName"              TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "nationality"             TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "citizenship"             TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "gender"                  TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "dateOfBirth"             TIMESTAMP(3);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "countryOfBirth"          TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "cityOfBirth"             TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "photoUrl"                TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "hasDrivingLicense"       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "jobTypeId"               TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "agencyId"                TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "residencyStatus"         TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "hasNationalInsurance"    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "nationalInsuranceNumber" TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "hasWorkAuthorization"    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "workAuthorizationType"   TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "workAuthorizationExpiry" TIMESTAMP(3);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "preferredStartDate"      TIMESTAMP(3);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "availability"            TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "willingToRelocate"       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "preferredLocations"      TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "salaryExpectation"       TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "notes"                   TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "leadNumber"              TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "candidateNumber"         TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "candidateConvertedAt"    TIMESTAMP(3);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "employeeConvertedAt"     TIMESTAMP(3);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "applicationData"         JSONB;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "convertedToEmployeeId"   TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "createdById"             TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "source"                  TEXT NOT NULL DEFAULT 'STAFF_CREATED';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "deletedAt"               TIMESTAMP(3);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "deletedBy"               TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "deletionReason"          TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "currentWorkflowStageId"  TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "jobAdId"                 TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "approvalStatus"          TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "approvedById"            TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "approvedAt"              TIMESTAMP(3);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS "rejectionReason"         TEXT;


-- ── WORKSHOPS ────────────────────────────────────────────────────────────────
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "companyName"                 TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "logo"                        TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "telephone"                   TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "mobile"                      TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "telefax"                     TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "vatNumber"                   TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "businessRegistrationNumber"  TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "contactPersonEmail"          TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "contactPersonPhone"          TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "contactPersonMobile"         TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "contactPersonAddress"        TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "bankName"                    TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "iban"                        TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "swiftBicCode"                TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "establishmentYear"           INTEGER;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "specializations"             TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS "status"                      TEXT NOT NULL DEFAULT 'ACTIVE';


-- ── MAINTENANCE_TYPES (table may not exist) ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntervalMode') THEN
    CREATE TYPE "IntervalMode" AS ENUM ('DAYS', 'KM', 'BOTH');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS maintenance_types (
  "id"                  TEXT PRIMARY KEY,
  "name"                TEXT NOT NULL,
  "description"         TEXT,
  "defaultIntervalDays" INTEGER,
  "defaultIntervalKm"   INTEGER,
  "intervalMode"        "IntervalMode" DEFAULT 'KM',
  "isActive"            BOOLEAN NOT NULL DEFAULT TRUE,
  "deletedAt"           TIMESTAMP(3),
  "deletedBy"           TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ── NOTIFICATION_PREFERENCES (table may not exist) ───────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  "id"                    TEXT PRIMARY KEY,
  "userId"                TEXT NOT NULL UNIQUE,
  "complianceDaysBefore"  INTEGER NOT NULL DEFAULT 30,
  "serviceKmBefore"       INTEGER NOT NULL DEFAULT 500,
  "emailEnabled"          BOOLEAN NOT NULL DEFAULT TRUE,
  "smsEnabled"            BOOLEAN NOT NULL DEFAULT FALSE,
  "inAppEnabled"          BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ── NOTIFICATIONS extra columns ──────────────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "severity"     TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "daysUntilDue" INTEGER;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "kmUntilDue"   INTEGER;


-- ── DONE ─────────────────────────────────────────────────────────────────────
-- After running this, restart your Node.js app on the server.
