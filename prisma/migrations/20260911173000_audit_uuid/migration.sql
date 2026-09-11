-- B1.7: AuditLog con IDs UUID por defecto + índice para filtros por responsable.
-- Solo cambia el DEFAULT de filas nuevas y añade un índice: sin reescritura
-- de datos, sin tocar filas existentes (conservan su id cuid()).
ALTER TABLE "AuditLog" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
