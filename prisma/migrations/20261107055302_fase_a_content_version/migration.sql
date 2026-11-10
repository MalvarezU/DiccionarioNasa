-- Fase A (T01, spec §1): versionado global + borrado lógico + registro de medios.
-- Migración ADITIVA e IDEMPOTENTE (CREATE/ADD/CREATE INDEX con IF NOT EXISTS,
-- INSERT IGNORE): `migrate deploy` puede correrse N veces sin errores.
--
-- Desvío deliberado respecto del SQL literal del spec §1.1: las columnas
-- `updatedAt` quedan en `DATETIME(3) NOT NULL` SIN default (forma canónica de
-- Prisma para `@updatedAt`, verificada con `migrate diff`), para que el diff
-- schema↔BD quede vacío. El backfill de filas existentes usa un DEFAULT
-- transitorio que se retira en el mismo script; la semilla explicita
-- `updatedAt = CURRENT_TIMESTAMP(3)` en el INSERT en lugar de relying en un
-- default de columna. Semántica idéntica a la del spec: tabla + semilla (1,1).

-- CreateTable (idempotente)
CREATE TABLE IF NOT EXISTS `ContentVersion` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Semilla (1,1): no-op si la fila ya existe (re-ejecución segura).
INSERT IGNORE INTO `ContentVersion` (`id`, `version`, `updatedAt`) VALUES (1, 1, CURRENT_TIMESTAMP(3));

-- AlterTable Module: updatedAt (backfill transitorio) + deletedAt (D3).
ALTER TABLE `Module` ADD COLUMN IF NOT EXISTS `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
ALTER TABLE `Module` ADD COLUMN IF NOT EXISTS `deletedAt` DATETIME(3) NULL;
ALTER TABLE `Module` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable Lesson: updatedAt (backfill transitorio) + deletedAt (D3).
ALTER TABLE `Lesson` ADD COLUMN IF NOT EXISTS `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
ALTER TABLE `Lesson` ADD COLUMN IF NOT EXISTS `deletedAt` DATETIME(3) NULL;
ALTER TABLE `Lesson` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable MediaAsset: sha256 (nullable hasta backfill T09) + updatedAt.
ALTER TABLE `MediaAsset` ADD COLUMN IF NOT EXISTS `sha256` VARCHAR(191) NULL;
ALTER TABLE `MediaAsset` ADD COLUMN IF NOT EXISTS `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
ALTER TABLE `MediaAsset` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateIndex (idempotentes): keyset futuro por updatedAt (Fase B).
CREATE INDEX IF NOT EXISTS `Lesson_updatedAt_idx` ON `Lesson`(`updatedAt`);
CREATE INDEX IF NOT EXISTS `MediaAsset_updatedAt_idx` ON `MediaAsset`(`updatedAt`);
CREATE INDEX IF NOT EXISTS `Module_updatedAt_idx` ON `Module`(`updatedAt`);
