-- Migration: Add workflow columns to an_detail
ALTER TABLE an_detail 
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30) DEFAULT 'discharged' COMMENT 'discharged|pharmacy|discharge_center|finance|completed',
  ADD COLUMN IF NOT EXISTS sent_pharmacy_by VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS sent_pharmacy_date DATETIME NULL,
  ADD COLUMN IF NOT EXISTS pharmacy_done_by VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS pharmacy_done_date DATETIME NULL,
  ADD COLUMN IF NOT EXISTS sent_dc_by VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS sent_dc_date DATETIME NULL,
  ADD COLUMN IF NOT EXISTS dc_done_by VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS dc_done_date DATETIME NULL,
  ADD COLUMN IF NOT EXISTS sent_finance_by VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS sent_finance_date DATETIME NULL,
  ADD COLUMN IF NOT EXISTS finance_done_by VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS finance_done_date DATETIME NULL;

-- Set existing discharged records to 'discharged' status
UPDATE an_detail SET workflow_status = 'discharged' WHERE discharge_by IS NOT NULL AND workflow_status IS NULL;
