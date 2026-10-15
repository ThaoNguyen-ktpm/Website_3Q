-- AlterTable
ALTER TABLE `User` ADD COLUMN `googleSub` VARCHAR(191) NULL,
    MODIFY `passwordHash` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_googleSub_key` ON `User`(`googleSub`);

