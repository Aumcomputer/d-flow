ALTER TABLE `an_detail`
ADD COLUMN `grant_pttype_code` VARCHAR(20) DEFAULT NULL,
ADD COLUMN `grant_pttype_name` VARCHAR(255) DEFAULT NULL,
ADD COLUMN `grant_pttype_is_other` TINYINT(1) DEFAULT 0,
ADD COLUMN `grant_pttype_other_text` VARCHAR(255) DEFAULT NULL,
ADD COLUMN `grant_pttype_asm_type` VARCHAR(50) DEFAULT NULL COMMENT 'asm_self | asm_family',
ADD COLUMN `grant_pttype_by` VARCHAR(50) DEFAULT NULL,
ADD COLUMN `grant_pttype_date` DATETIME DEFAULT NULL;
