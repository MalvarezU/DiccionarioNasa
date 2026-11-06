-- AlterTable
ALTER TABLE `User` ADD COLUMN `onboardedAt` DATETIME(3) NULL;

-- Backfill Fase Google-first: usuarios ya verificados cuentan como onboarded.
UPDATE `User` SET `onboardedAt` = `createdAt` WHERE `emailVerified` IS NOT NULL AND `onboardedAt` IS NULL;
