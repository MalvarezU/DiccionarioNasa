-- Limpieza Nivel 1+2: las lecciones viven solo en `content` (bloques).
-- Datos ya convertidos por prisma/migrate-legacy-blocks.ts (idempotente).
ALTER TABLE `Lesson` DROP FOREIGN KEY `Lesson_wordId_fkey`;
DROP INDEX `Lesson_wordId_fkey` ON `Lesson`;
ALTER TABLE `Lesson` DROP COLUMN `payload`,
    DROP COLUMN `type`,
    DROP COLUMN `wordId`,
    MODIFY `content` JSON NOT NULL;
