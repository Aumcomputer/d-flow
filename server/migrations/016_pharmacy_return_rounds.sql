CREATE TABLE IF NOT EXISTS `pharmacy_return_rounds` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `an` VARCHAR(20) NOT NULL,
    `round_no` INT NOT NULL DEFAULT 1,
    `note` TEXT NULL,
    `source` VARCHAR(30) DEFAULT 'admit_return',
    `created_by` VARCHAR(50) NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_an` (`an`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pharmacy_return_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `round_id` INT NOT NULL,
    `icode` VARCHAR(20) NULL,
    `drug_name` VARCHAR(255) NOT NULL,
    `qty` INT NOT NULL DEFAULT 1,
    `units` VARCHAR(50) NULL,
    INDEX `idx_round_id` (`round_id`),
    CONSTRAINT `fk_pharmacy_return_round_id` FOREIGN KEY (`round_id`) REFERENCES `pharmacy_return_rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
