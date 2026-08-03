-- D-Flow Database Migration Script
-- Database is specified via .env DFLOW_DB_NAME

-- Document types lookup table
CREATE TABLE IF NOT EXISTS `document_types` (
  `id` INT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL COMMENT 'ชื่อประเภทเอกสาร (ภาษาไทย)',
  `name_en` VARCHAR(100) NOT NULL COMMENT 'Document type name (English)',
  `is_required` TINYINT(1) DEFAULT 0 COMMENT 'จำเป็นต้องมีเพื่อ complete (1=required)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `document_types` (`id`, `name`, `name_en`, `is_required`) VALUES
  (1, 'บัตรประชาชน', 'ID Card', 1),
  (2, 'ใบตรวจสอบสิทธิ์', 'Rights Verification', 1),
  (3, 'Authen Code', 'Authen Code', 1),
  (4, 'ใบส่งตัว (Refer)', 'Referral Letter', 0),
  (5, 'อื่นๆ', 'Other', 0)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Documents index table
CREATE TABLE IF NOT EXISTS `documents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `an` VARCHAR(9) NOT NULL COMMENT 'Admission Number',
  `hn` VARCHAR(9) NOT NULL COMMENT 'Hospital Number',
  `doc_type_id` INT NOT NULL COMMENT 'FK to document_types',
  `original_filename` VARCHAR(255) NOT NULL COMMENT 'ชื่อไฟล์ต้นฉบับ',
  `stored_filename` VARCHAR(255) NOT NULL COMMENT 'ชื่อไฟล์ที่เก็บใน storage',
  `file_path` VARCHAR(500) NOT NULL COMMENT 'relative path from upload root',
  `file_size` INT NOT NULL COMMENT 'ขนาดไฟล์ (bytes)',
  `mime_type` VARCHAR(100) NOT NULL,
  `auto_classified` TINYINT(1) DEFAULT 0 COMMENT '1=ระบบจำแนกอัตโนมัติ, 0=ผู้ใช้เลือกเอง',
  `uploaded_by` VARCHAR(50) NOT NULL COMMENT 'loginname ของผู้ upload',
  `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) DEFAULT 0 COMMENT 'soft delete flag',
  `deleted_at` DATETIME DEFAULT NULL,
  `deleted_by` VARCHAR(50) DEFAULT NULL,
  INDEX `ix_an` (`an`),
  INDEX `ix_hn` (`hn`),
  INDEX `ix_doc_type` (`doc_type_id`),
  INDEX `ix_an_doc_type` (`an`, `doc_type_id`),
  INDEX `ix_uploaded_at` (`uploaded_at`),
  CONSTRAINT `fk_doc_type` FOREIGN KEY (`doc_type_id`) REFERENCES `document_types`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
