-- Gộp 5 vai trò cũ thành 3 (ADMIN, MANAGER, STAFF), giữ nguyên dữ liệu nhân viên.
ALTER TABLE `Staff` MODIFY `role` ENUM('OWNER', 'MANAGER', 'SALES', 'WAREHOUSE', 'ACCOUNTANT', 'ADMIN', 'STAFF') NOT NULL DEFAULT 'SALES';
UPDATE `Staff` SET `role` = 'ADMIN' WHERE `role` = 'OWNER';
UPDATE `Staff` SET `role` = 'STAFF' WHERE `role` IN ('SALES', 'WAREHOUSE', 'ACCOUNTANT');
ALTER TABLE `Staff` MODIFY `role` ENUM('ADMIN', 'MANAGER', 'STAFF') NOT NULL DEFAULT 'STAFF';

-- Quyền tùy chỉnh theo vai trò (ADMIN luôn toàn quyền, không lưu ở đây).
CREATE TABLE `RolePermission` (
    `role` ENUM('ADMIN', 'MANAGER', 'STAFF') NOT NULL,
    `permission` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`role`, `permission`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
