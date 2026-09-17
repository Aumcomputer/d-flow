-- Migration 014: Add pharmacy pack columns
ALTER TABLE an_detail 
  ADD COLUMN IF NOT EXISTS pharmacy_pack_by VARCHAR(50) NULL AFTER sent_pharmacy_date,
  ADD COLUMN IF NOT EXISTS pharmacy_pack_date DATETIME NULL AFTER pharmacy_pack_by;
