-- B.lessonNumber: añadir la columna, crear índice y backfill por módulo.
-- La numeración visible "1.1, 1.2..." sale ahora de la BD (estable al reordenar).

ALTER TABLE "Lesson" ADD COLUMN "lessonNumber" INTEGER;

-- Backfill: dentro de cada módulo, numerar 1..N por (order, id).
-- "id" como desempate estable (la tabla no expone createdAt en Prisma).
WITH ranked AS (
  SELECT
    l.id,
    ROW_NUMBER() OVER (
      PARTITION BY l."moduleId"
      ORDER BY l."order" ASC, l.id ASC
    ) AS n
  FROM "Lesson" l
)
UPDATE "Lesson" l
SET "lessonNumber" = ranked.n
FROM ranked
WHERE l.id = ranked.id;

CREATE INDEX "Lesson_moduleId_lessonNumber_idx" ON "Lesson"("moduleId", "lessonNumber");
