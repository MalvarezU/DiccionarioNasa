-- AlterTable
ALTER TABLE `MediaAsset` DROP COLUMN `data`,
    ADD COLUMN `objectKey` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `MediaAsset_objectKey_key` ON `MediaAsset`(`objectKey`);

