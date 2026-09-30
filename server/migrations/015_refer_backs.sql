-- Create table for tracking Refer Back coordination
CREATE TABLE IF NOT EXISTS `refer_backs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `an` VARCHAR(15) NOT NULL COMMENT 'Admission Number',
  `hospcode` VARCHAR(10) NOT NULL COMMENT 'รหัส รพ. ที่ประสานส่งกลับ',
  `hospname` VARCHAR(255) NOT NULL COMMENT 'ชื่อ รพ. ที่ประสานส่งกลับ',
  `diagnosis` TEXT NULL COMMENT 'การวินิจฉัยโรค',
  `reason` VARCHAR(255) NOT NULL COMMENT 'เหตุที่ส่งกลับ (เช่น ดูแลต่อหลังผ่าตัด ให้ยาต่อ กายภาพบำบัด)',
  `status` ENUM('accepted', 'rejected') NOT NULL COMMENT 'ผลการประสาน: accepted (รับ) / rejected (ปฏิเสธ)',
  `responder_name` VARCHAR(150) NOT NULL COMMENT 'ชื่อผู้ตอบ รับ / ปฏิเสธ',
  `remark` TEXT NULL COMMENT 'หมายเหตุเพิ่มเติม เช่น เหตุผลที่ปฏิเสธ หรือคำแนะนำ',
  `contact_datetime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันเวลาที่ประสานงาน',
  `recorded_by` VARCHAR(50) NULL COMMENT 'username ผู้บันทึก',
  `recorded_by_name` VARCHAR(100) NULL COMMENT 'ชื่อ-สกุล ผู้บันทึก',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_refer_backs_an` (`an`),
  INDEX `idx_refer_backs_hospcode` (`hospcode`),
  INDEX `idx_refer_backs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
