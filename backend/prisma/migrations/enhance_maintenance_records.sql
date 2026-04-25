-- Add enhanced fields to maintenance_records table for driver tracking, drop-off/pick-up, and approvals
DO $$
BEGIN
  -- Add driver tracking for service technician
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'driver_id') THEN
    ALTER TABLE maintenance_records ADD COLUMN driver_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'driver_name_override') THEN
    ALTER TABLE maintenance_records ADD COLUMN driver_name_override TEXT;
  END IF;

  -- Add drop-off driver and timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'drop_off_driver_id') THEN
    ALTER TABLE maintenance_records ADD COLUMN drop_off_driver_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'drop_off_driver_name_override') THEN
    ALTER TABLE maintenance_records ADD COLUMN drop_off_driver_name_override TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'drop_off_date_time') THEN
    ALTER TABLE maintenance_records ADD COLUMN drop_off_date_time TIMESTAMP;
  END IF;

  -- Add pick-up driver and timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'pick_up_driver_id') THEN
    ALTER TABLE maintenance_records ADD COLUMN pick_up_driver_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'pick_up_driver_name_override') THEN
    ALTER TABLE maintenance_records ADD COLUMN pick_up_driver_name_override TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'pick_up_date_time') THEN
    ALTER TABLE maintenance_records ADD COLUMN pick_up_date_time TIMESTAMP;
  END IF;

  -- Add approval tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'approved_by_id') THEN
    ALTER TABLE maintenance_records ADD COLUMN approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'approved_at') THEN
    ALTER TABLE maintenance_records ADD COLUMN approved_at TIMESTAMP;
  END IF;

  -- Add work description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'work_description') THEN
    ALTER TABLE maintenance_records ADD COLUMN work_description TEXT;
  END IF;

  -- Create index on completed_date if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_name = 'maintenance_records' AND index_name = 'maintenance_records_completed_date_idx') THEN
    CREATE INDEX maintenance_records_completed_date_idx ON maintenance_records(completed_date DESC);
  END IF;
END $$;

-- Create maintenance_record_attachments table if it doesn't exist
CREATE TABLE IF NOT EXISTS maintenance_record_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_record_id UUID NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_url TEXT,
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),
  document_type VARCHAR(50),
  uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS maintenance_record_attachments_record_id_idx ON maintenance_record_attachments(maintenance_record_id);

-- Add column constraints to ensure valid state
DO $$
BEGIN
  -- Add check constraint to ensure either driverId or driverNameOverride is set for driver tracking
  -- This is handled at the application layer for flexibility

  -- Create indexes for better query performance
  CREATE INDEX IF NOT EXISTS maintenance_records_driver_id_idx ON maintenance_records(driver_id);
  CREATE INDEX IF NOT EXISTS maintenance_records_drop_off_driver_id_idx ON maintenance_records(drop_off_driver_id);
  CREATE INDEX IF NOT EXISTS maintenance_records_pick_up_driver_id_idx ON maintenance_records(pick_up_driver_id);
  CREATE INDEX IF NOT EXISTS maintenance_records_approved_by_id_idx ON maintenance_records(approved_by_id);
END $$;
