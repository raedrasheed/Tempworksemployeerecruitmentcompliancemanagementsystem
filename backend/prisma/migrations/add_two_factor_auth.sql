-- Email-based two-factor authentication.

-- Flag on User to indicate whether 2FA is required on login.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

-- Short-lived OTP challenges awaiting email verification.
CREATE TABLE IF NOT EXISTS "two_factor_challenges" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL,
  "challenge"  TEXT NOT NULL UNIQUE,
  "codeHash"   TEXT NOT NULL,
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "ipAddress"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "two_factor_challenges_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "two_factor_challenges_userId_idx"
  ON "two_factor_challenges"("userId");
