CREATE TABLE IF NOT EXISTS `an_detail` (
  `an` VARCHAR(9) PRIMARY KEY,
  `discharge_by` VARCHAR(50) NULL COMMENT 'loginname of person who discharged',
  `discharge_date` DATETIME NULL COMMENT 'time when discharged in d-flow',
  `chk_med` VARCHAR(50) NULL COMMENT 'loginname for บันทึกการให้ยาครบถ้วน',
  `chk_nurse` VARCHAR(50) NULL COMMENT 'loginname for บันทึกการพยาบาลครบถ้วน',
  `chk_lab` VARCHAR(50) NULL COMMENT 'loginname for ตรวจสอบผลตรวจทางห้องปฏิบัติการ',
  `chk_opnote` VARCHAR(50) NULL COMMENT 'loginname for ตรวจสอบ opertive note',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `an` VARCHAR(9) NOT NULL,
  `action_type` VARCHAR(100) NOT NULL,
  `loginname` VARCHAR(50) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `ix_an` (`an`),
  INDEX `ix_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
