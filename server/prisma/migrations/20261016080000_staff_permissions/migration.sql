-- Quyền riêng cho từng nhân viên (TASK-017).
-- AlterTable
ALTER TABLE `Staff` ADD COLUMN `customPermissions` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `StaffPermission` (
    `staffId` INTEGER NOT NULL,
    `permission` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`staffId`, `permission`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StaffPermission` ADD CONSTRAINT `StaffPermission_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

