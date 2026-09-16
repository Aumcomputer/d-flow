CREATE TABLE IF NOT EXISTS `pttype_comments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `an` VARCHAR(20) NOT NULL,
    `comment` TEXT NOT NULL,
    `created_by` VARCHAR(50) NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_an` (`an`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
