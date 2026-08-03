-- Migration 002: Add extracted text and CID columns to documents

ALTER TABLE `documents`
  ADD COLUMN `extracted_text` LONGTEXT DEFAULT NULL COMMENT 'ข้อความที่ถอดได้จาก PDF' AFTER `auto_classified`,
  ADD COLUMN `extracted_cid` VARCHAR(13) DEFAULT NULL COMMENT 'เลข CID 13 หลักที่พบใน PDF' AFTER `extracted_text`;
