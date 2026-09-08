ALTER TABLE `an_detail`
ADD COLUMN `consult_pttype_urgency` VARCHAR(50) DEFAULT NULL COMMENT 'ฉุกเฉิน / ไม่ฉุกเฉิน',
ADD COLUMN `consult_pttype_reason` TEXT DEFAULT NULL COMMENT 'สาเหตุที่ส่งปรึกษา',
ADD COLUMN `consult_pttype_doctor_code` VARCHAR(20) DEFAULT NULL,
ADD COLUMN `consult_pttype_doctor_name` VARCHAR(150) DEFAULT NULL,
ADD COLUMN `consult_pttype_by` VARCHAR(50) DEFAULT NULL,
ADD COLUMN `consult_pttype_date` DATETIME DEFAULT NULL,
ADD COLUMN `consult_pttype_status` VARCHAR(20) DEFAULT 'pending';
