ALTER TABLE `an_detail` 
ADD COLUMN `chk_right` VARCHAR(50) NULL COMMENT 'loginname for ตรวจสอบสิทธิ์การรักษาเรียบร้อย',
ADD COLUMN `chk_bed` VARCHAR(50) NULL COMMENT 'loginname for ลงค่าเตียงเรียบร้อย',
ADD COLUMN `chk_lab_dup` VARCHAR(50) NULL COMMENT 'loginname for ตรวจสอบรายการ Lab ซ้ำซ้อนเรียบร้อย',
ADD COLUMN `chk_cost_dup` VARCHAR(50) NULL COMMENT 'loginname for ตรวจสอบค่าใช้จ่ายซ้ำซ้อนเรียบร้อย';
