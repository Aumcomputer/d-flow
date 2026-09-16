ALTER TABLE `return_drugs`
    ADD COLUMN IF NOT EXISTS `is_correct` TINYINT(1) DEFAULT 1 COMMENT '1=ถูกต้อง, 0=ไม่ถูกต้อง',
    ADD COLUMN IF NOT EXISTS `actual_qty` INT NULL COMMENT 'จำนวนที่ถูกต้อง',
    ADD COLUMN IF NOT EXISTS `remark` VARCHAR(255) NULL COMMENT 'หมายเหตุ',
    ADD COLUMN IF NOT EXISTS `checked_by` VARCHAR(50) NULL COMMENT 'loginname ผู้ตรวจสอบ',
    ADD COLUMN IF NOT EXISTS `checked_at` DATETIME NULL COMMENT 'เวลาที่ตรวจสอบ';
