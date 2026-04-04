-- Add soft-delete columns to vehicle_documents and maintenance_records
ALTER TABLE "vehicle_documents"    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "vehicle_documents"    ADD COLUMN IF NOT EXISTS "deletedBy"  TEXT;
ALTER TABLE "maintenance_records"  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "maintenance_records"  ADD COLUMN IF NOT EXISTS "deletedBy"  TEXT;

CREATE INDEX IF NOT EXISTS "vehicle_documents_deletedAt_idx"   ON "vehicle_documents"("deletedAt");
CREATE INDEX IF NOT EXISTS "maintenance_records_deletedAt_idx" ON "maintenance_records"("deletedAt");
