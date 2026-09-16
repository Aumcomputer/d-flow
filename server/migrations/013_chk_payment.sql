ALTER TABLE an_detail ADD COLUMN IF NOT EXISTS chk_payment INT NULL AFTER chk_returnmed;
ALTER TABLE an_detail ADD COLUMN IF NOT EXISTS ward_done_by VARCHAR(50) NULL AFTER dc_done_date;
ALTER TABLE an_detail ADD COLUMN IF NOT EXISTS ward_done_date DATETIME NULL AFTER ward_done_by;
