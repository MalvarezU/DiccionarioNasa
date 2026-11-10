# DEPLOY — apk-offline-seed-fase-a en Hostinger (C4)

Orden seguro para llevar la Fase A a producción sin romper el sync ni el seed.
La migración es aditiva (columnas nullable + tabla `ContentVersion` nueva); el código viejo ignora las columnas nuevas, así que el rollback no requiere down.

## Quick path

1. **Staging:** `prisma migrate deploy` ×2 (idempotencia) + `prisma migrate diff` vacío.
2. **Smoke de bumps:** leer versión inicial, crear palabra (+1), editar (+1), archivar (+1) → versión final = inicial + 3; `GET /api/sync` y `GET /api/sync/seed` responden `contentVersion`.
3. **Prod:** migración → deploy de código → `bun run db:backfill-sha256 -- --json`; guardar el reporte (`missingInR2` / `legacyMissing`); **no auto-borrar**.
4. **Rollback (si hace falta):** no hay down; la migración aditiva se queda, el código anterior sigue operando.

## Detalles

| Paso | Comando / acción | Qué confirma |
|---|---|---|
| S1 — staging deploy ×2 | `prisma migrate deploy` dos veces seguidas contra la BD de staging | Segunda corrida = "no hay migraciones pendientes" (idempotencia real, no solo por construcción) |
| S2 — staging diff vacío | `prisma migrate diff` (staging vs migraciones aplicadas) | Sin drift entre schema y BD antes de tocar prod |
| S3 — smoke de versión | `v0` = `contentVersion` actual → crear palabra → editar → archivar → `v0 + 3` exacto | Cada mutación publicable bumpea +1; el archivado cuenta como publicación (borrado lógico visible) |
| S4 — smoke de sync/seed | `GET /api/sync` y `GET /api/sync/seed` | Ambos responden `contentVersion` coincidente con `v0 + 3`, claves preexistentes intactas |
| P1 — prod migración | `prisma migrate deploy` contra prod (ventana de mantenimiento solo si el dry-run de staging lo exigió, E7) | Tablas/columnas nuevas presentes; `ContentVersion(1, 1)` sembrada |
| P2 — prod código | Deploy del build web | Handlers con bump activos; anti-olvido vigente hacia adelante |
| P3 — prod backfill | `bun run db:backfill-sha256 -- --json` | Reporte JSON guardado como artefacto: `{ updated, skipped, missingInR2[], legacyCreated[], legacyMissing[] }` |
| P4 — huérfanos | Revisar `missingInR2` (fila sin objeto) y `legacyMissing` (legacy sin objeto) del reporte | Solo reporte: **no auto-borrar**; `r2-prune` sigue siendo el único recolector (E5) |

## Checklist

- [ ] S1 + S2 con salidas guardadas (doble deploy + diff vacío en staging)
- [ ] S3 deja `v0 + 3` exacto (crear + editar + archivar)
- [ ] S4: `sync` y `seed` responden el mismo `contentVersion`
- [ ] P3: artefacto JSON del backfill archivado (con `missingInR2` / `legacyMissing` visibles)
- [ ] Ningún borrado manual de R2 ni de filas durante el deploy

## Next step

Tras el deploy en verde: `gentle-ai sdd-attempt settle` + ARCHIVE del change → abrir PR1/PR2/PR3 (stacked-to-main).
