# Tasks: apk-offline-seed-fase-a — Etapa 1: versionado global + borrado lógico + registro de medios

- **Change ID:** `apk-offline-seed-fase-a`
- **Branch:** `feat/etapa1-content-version`
- **Base:** `spec.md` aprobado (DDL §1, bump §2, borrado §3, medios §4, sync §5, criterios §6, bordes §7). `sinceVersion` recortado de Fase A (§5.2).
- **Método:** TDD estricto en cada tarea (RED → verificar RED → GREEN mínimo → verificar GREEN → refactor). Sin test failing previo no existe código de producción.
- **Nomenclatura de tests:** `fase-a.<grupo>.test.ts`.
- **Alcance:** solo repo web. Sin cambios en app móvil, Admin UI ni PWA.

---

## Fase 1 — Migración y helper

### T01 — Migración Prisma: `ContentVersion` + columnas aditivas + semilla (1,1)

- **Criterios que cierra:** MIG-01, MIG-02.
- **Descripción:** Crear la migración Prisma aditiva e idempotente: tabla `ContentVersion(id, version, updatedAt)`, columnas `Module.updatedAt` + `Module.deletedAt?`, `Lesson.updatedAt` + `Lesson.deletedAt?`, `MediaAsset.sha256?` + `MediaAsset.updatedAt`, índices `@@index([updatedAt])` en las tres tablas, y semilla `INSERT IGNORE (1, 1)`. Ningún campo existente cambia de tipo, nombre o nulabilidad. La fila semilla arranca en `1` (criterio `1 + N`). `sha256` permanece nullable durante toda la Fase A.
- **Archivos a tocar:**
  - `prisma/schema.prisma` (modelos `ContentVersion`, `Module`, `Lesson`, `MediaAsset`)
  - `prisma/migrations/<timestamp>_fase_a_content_version/migration.sql` (nuevo)
- **Test que la cierra (RED→GREEN):**
  - RED: `tests/fase-a/fase-a.mig.test.ts` — aserta que `ContentVersion` existe con exactamente una fila `(1, v>=1)`; introspección Prisma aserta `Module`/`Lesson` con `updatedAt` + `deletedAt` nullable e índice en `updatedAt`, y `MediaAsset` con `sha256` nullable + `updatedAt`. El test falla antes de la migración.
  - GREEN: aplicar migración; `prisma migrate deploy` corre dos veces seguidas sin errores (idempotencia, E7).
  - Comando: `npx vitest run tests/fase-a/fase-a.mig.test.ts` + `prisma migrate diff` revisado + dry-run en staging antes de producción.
- **Dependencia:** ninguna (primera tarea de la secuencia).

### T02 — Helper `bumpContentVersion` + `getContentVersion` (atómico, sin caché)

- **Criterios que cierra:** BUMP-01 (base de BUMP-02/03/04/05).
- **Descripción:** Crear `src/lib/content-version.ts` con `bumpContentVersion(tx)` (`INSERT IGNORE (1,1)` + `UPDATE ... SET version = version + 1 WHERE id = 1` vía `$executeRaw` sobre el `tx` recibido, nunca read-modify-write en JS; retorna la versión resultante) y `getContentVersion()` (lectura fresca vía `findUnique({ where: { id: 1 } })`; si no hay fila retorna `1` sin crearla). Sin caché en memoria. Documentar regla de orden: mutación primero, bump al final, dentro de la misma transacción; post-commit solo donde la transacción conjunta sea imposible, con log error si el bump falla tras mutación exitosa (R5).
- **Archivos a tocar:**
  - `src/lib/content-version.ts` (nuevo)
  - `tests/fase-a/fase-a.bump-helper.test.ts` (nuevo)
- **Test que la cierra (RED→GREEN):**
  - RED: bump sobre versión `v` debe dejar `v+1` y retornar el nuevo valor; dos bumps concurrentes (`Promise.all`) deben dejar exactamente `+2` sin lost update (E1); `getContentVersion()` sin fila retorna `1`.
  - GREEN: implementación mínima del helper; verificar `npx vitest run tests/fase-a/fase-a.bump-helper.test.ts` en verde y suite existente sin regresiones.
- **Dependencia:** T01 (requiere tabla `ContentVersion`).

---

## Fase 2 — Bumps por grupo (un bump por operación lógica)

Regla transversal (spec §2.2): fallo/validación 4xx, 404, 409 y no-op (0 filas afectadas, reorder idéntico, revert ya aplicado) no generan bump. `bulk-status`, `import/confirm`, `revert` y `reorder` generan exactamente +1 aunque toquen N filas.

### T03 — Bumps grupo words: CRUD + `bulk-status`

- **Puntos spec §2.3:** 1 (`POST /api/admin/words`), 2 (`PUT /api/admin/words/[id]`), 3 (`PATCH`, si existe; si no, N/A verificado en spec-review), 4 (`DELETE`, tras reemplazo lateral a `ARCHIVED` — ver T07), 5 (`POST /api/admin/words/bulk-status`, +1 por request con ≥1 fila afectada).
- **Criterios que cierra:** BUMP-05 (trazabilidad test↔ruta en el nombre del test), BUMP-02 (bulk = +1, no +N), BUMP-03 (400/404/bulk con 0 filas sin bump).
- **Descripción:** Envolver mutación + bump en la misma transacción Prisma en cada handler. `bulk-status` calcula filas afectadas y solo hace bump si ≥1. Respetar normalización de `status` de T07 en el mismo cambio (PUT/PATCH convierten a mayúsculas y validan contra `DRAFT|PUBLISHED|ARCHIVED`; inválido → 400 sin bump).
- **Archivos a tocar:**
  - `src/app/api/admin/words/route.ts`
  - `src/app/api/admin/words/[id]/route.ts`
  - `src/app/api/admin/words/bulk-status/route.ts`
  - `tests/fase-a/fase-a.bump-words.test.ts` (nuevo)
- **Test que la cierra (RED→GREEN):**
  - RED: cada ruta con mutación efectiva debe incrementar la versión en +1 (test falla sin la llamada a `bumpContentVersion`); `bulk-status` sobre N palabras deja +1; PUT con `status` inválido deja versión intacta; bulk con 0 filas deja versión intacta.
  - GREEN: agregar bump en cada punto; `npx vitest run tests/fase-a/fase-a.bump-words.test.ts`.
- **Dependencia:** T02.

### T04 — Bumps grupo import (dos pasos) + revert de bitácora

- **Puntos spec §2.3:** 6 (`POST /api/admin/import`, legacy — **+1 por request con ≥1 fila aplicada**), 8 (`POST /api/admin/import/preview` — **sin bump**, solo lectura), 7 (`POST /api/admin/import/confirm`, +1 por confirmación aplicada con ≥1 fila), 9 (`POST /api/admin/audit-logs/[id]/revert`, +1 solo si el revert aplica con 2xx).
- **Criterios que cierra:** BUMP-05, BUMP-02 (legacy y confirm sobre N filas = +1 cada uno, sin doble conteo entre sí), BUMP-03 (revert 404/409 sin bump; legacy con 0 filas o 4xx sin bump; E2).
- **Descripción:** Regla de import: legacy y `confirm` bumpean (+1 por request aplicada cada uno, en su propia transacción); preview nunca hace bump. Revert: 404 (entidad inexistente), 409 (ya revertido o divergencia con cambios posteriores) y 422 (revert de DELETE histórico sin snapshot completo) no generan bump ni mutación.
- **Archivos a tocar:**
  - `src/app/api/admin/import/route.ts` (bump +1 por request con ≥1 fila aplicada, misma transacción)
  - `src/app/api/admin/import/preview/route.ts` (verificar ausencia de bump)
  - `src/app/api/admin/import/confirm/route.ts`
  - `src/app/api/admin/audit-logs/[id]/revert/route.ts`
  - `tests/fase-a/fase-a.bump-import-revert.test.ts` (nuevo)
- **Test que la cierra (RED→GREEN):**
  - RED: legacy sobre N filas deja +1; legacy con 0 filas no altera la versión; preview no altera la versión; `confirm` sobre N filas deja +1; revert aplicado deja +1; revert 409/404/422 deja versión intacta.
  - GREEN: bump en legacy y en `confirm` por request aplicado, y en revert exitoso; `npx vitest run tests/fase-a/fase-a.bump-import-revert.test.ts`.
- **Dependencia:** T02. (Si el flujo import escribe `DictionaryWord`, coordinar con la normalización de T07.)

### T05 — Bumps grupo cursos: courses + modules + lessons + reorder

- **Puntos spec §2.3:** 15 (`POST /api/courses`), 16 (`PUT/DELETE /api/courses/[id]`, DELETE tras reemplazo a `ARCHIVED` — ver T07), 17 (`POST /api/modules`, `PUT/DELETE /api/modules/[id]`, DELETE tras `deletedAt = now()` — ver T07), 18 (`POST /api/modules/[id]/lessons`, `PUT|DELETE /api/lessons/[id]`, `PUT|DELETE /api/courses/[id]/lessons/[lessonId]`, DELETEs tras `deletedAt = now()`), 19 (`POST /api/courses/[id]/reorder`, +1 si ≥1 módulo o lección cambió; no-op sin bump; E3).
- **Criterios que cierra:** BUMP-05, BUMP-02 (reorder = +1), BUMP-03 (reorder no-op sin bump), DEL-01/DEL-02 en lo relativo al bump.
- **Descripción:** Insertar bump en los handlers (no en `src/app/api/courses/_lib.ts`, que es código compartido — el bump va en los handlers que llaman a `createModule`/`updateModule` para mantener +1 por operación lógica). `reorder` parcial (algunos ids ajenos al curso) hace +1 solo si ≥1 fila cambió. DELETEs físicos se convierten a borrado lógico según T07; el bump se verifica junto con esa conversión.
- **Archivos a tocar:**
  - `src/app/api/courses/route.ts`
  - `src/app/api/courses/[id]/route.ts`
  - `src/app/api/modules/route.ts`
  - `src/app/api/modules/[id]/route.ts`
  - `src/app/api/modules/[id]/lessons/route.ts`
  - `src/app/api/lessons/[id]/route.ts`
  - `src/app/api/courses/[id]/lessons/[lessonId]/route.ts`
  - `src/app/api/courses/[id]/reorder/route.ts`
  - `tests/fase-a/fase-a.bump-courses.test.ts` (nuevo)
- **Test que la cierra (RED→GREEN):**
  - RED: cada handler con mutación efectiva deja +1; `reorder` sobre N lecciones deja +1; `reorder` con listas vacías u orden idéntico deja versión intacta.
  - GREEN: bumps agregados; `npx vitest run tests/fase-a/fase-a.bump-courses.test.ts`.
- **Dependencia:** T02. DELETEs de este grupo se cierran funcionalmente con T07 (borrado lógico).

### T06 — Bumps grupo medios: uploads + deletes + legacy

- **Puntos spec §2.3:** 11 (`POST /api/admin/upload-audio`, +1 tras crear fila `MediaAsset` — reemplazo lateral), 12 (`POST /api/admin/upload-image`, +1 junto a `mediaAsset.create`; si el insert falla se borra el objeto R2 y no hay bump), 13 (`POST /api/admin/delete-audio`, +1 tras eliminar fila resuelta por `objectKey` + objeto R2; clave sin fila: se borra el objeto por compatibilidad y el bump aplica igual), 14 (`DELETE /api/media/[id]`, +1 tras `deleteMediaAssetById` exitoso; 404 sin bump), 10 (`POST /api/dictionary/update-audio` legacy, +1 si modificó ≥1 fila; marcado `@deprecated`).
- **Criterios que cierra:** BUMP-05, BUMP-03 (404/400 sin bump), DEL-03 en lo relativo al bump; HASH-01 se verifica en T08 sobre estos mismos paths.
- **Descripción:** Cerrar la brecha de inventario: `upload-audio` crea fila `MediaAsset` tras `putObject` (si el insert falla, compensación: borrar objeto, sin bump). `delete-audio` resuelve fila por `objectKey` (`audioRefToKey` + `findFirst`) y la elimina antes del borrado R2. Mantener orden vigente en `deleteMediaAssetById` (fila primero, R2 best-effort, huérfano recogido por `r2-prune`) y agregar bump posterior al borrado de fila exitoso.
- **Archivos a tocar:**
  - `src/app/api/admin/upload-audio/route.ts`
  - `src/app/api/admin/upload-image/route.ts`
  - `src/app/api/admin/delete-audio/route.ts`
  - `src/app/api/media/[id]/route.ts` (+ `src/lib/media/delete-asset.ts`, solo lectura de referencia — no alterar el orden fila→R2)
  - `src/app/api/dictionary/update-audio/route.ts` (agregar bump + marca `@deprecated` en docblock)
  - `tests/fase-a/fase-a.bump-media.test.ts` (nuevo)
- **Test que la cierra (RED→GREEN):**
  - RED: cada upload/delete efectivo deja +1; `upload-image` con insert fallido deja versión intacta y objeto compensado; `media DELETE` con 404 deja versión intacta; `update-audio` sin filas tocadas deja versión intacta.
  - GREEN: bumps agregados; `npx vitest run tests/fase-a/fase-a.bump-media.test.ts`.
- **Dependencia:** T02. El contenido `sha256` de estos paths se cierra en T08.

---

## Fase 3 — Borrado lógico, medios y sync

### T07 — Borrado lógico por entidad + normalización case + regresión `removedIds`

- **Criterios que cierra:** DEL-01, DEL-02, DEL-03 (parte semántica), R-ARCHIVED.
- **Descripción:**
  - `DictionaryWord`/`Course` (D3): DELETE físico → `update({ data: { status: "ARCHIVED" } })`; respuesta HTTP sin cambios; bitácora conserva `AuditLog(action: "DELETE")` con `entityId` para que los tombstones existentes sigan funcionando.
  - Normalización obligatoria en `DictionaryWord.status` (String libre): toda escritura convierte a `toUpperCase().trim()` y valida contra `DRAFT|PUBLISHED|ARCHIVED`; inválido → 400. `Course.status` es enum y no requiere normalización (E8), pero el sync normaliza ambos lados por igual.
  - `Module`/`Lesson`: DELETE → `update({ data: { deletedAt: new Date() } })` + bump en la misma transacción; respuesta sin cambios; revert del borrado = `deletedAt = null` + bump. Toda lectura pública y de seed del árbol (`GET /api/courses`, `GET /api/courses/[id]`, `GET /api/courses/[id]/manifest`, `GET /api/modules*`, `GET /api/modules/[id]/lessons`, `GET /api/lessons/[id]`) excluye `deletedAt != null` (`where: { deletedAt: null }`). No se agrega `status` a Module/Lesson.
  - `MediaAsset`: sin `deletedAt`; en `delete-audio`/`media DELETE` la fila se elimina (decisión de spec §3.3); reconciliación por diff de manifiesto `(objectKey, sha256)`.
  - Sync `src/app/api/sync/route.ts`: cambiar ambas comparaciones `w.status === "ARCHIVED"` a `String(w.status).toUpperCase() === "ARCHIVED"` (filtro de `words` y construcción de `removedIds`). Fase A no expone `deletedAt` de Module/Lesson en `removedIds` (árbol no expuesto en sync; primer ítem de Fase B).
- **Archivos a tocar:**
  - `src/app/api/admin/words/[id]/route.ts` (DELETE → ARCHIVED)
  - `src/app/api/courses/[id]/route.ts` (DELETE → ARCHIVED)
  - `src/app/api/modules/[id]/route.ts`, `src/app/api/lessons/[id]/route.ts`, `src/app/api/courses/[id]/lessons/[lessonId]/route.ts`, `src/app/api/modules/[id]/lessons/route.ts` (DELETE → `deletedAt`, filtros `deletedAt: null` en GETs del árbol)
  - `src/app/api/courses/route.ts` (verificar filtro ARCHIVED del árbol en spec-review)
  - `src/app/api/sync/route.ts` (comparación normalizada)
  - `tests/fase-a/fase-a.del.test.ts` (nuevo: DEL-01/02/03 + R-ARCHIVED)
- **Test que la cierra (RED→GREEN):**
  - RED: DELETE de word/course deja la fila con `ARCHIVED` y la excluye de lecturas públicas; DELETE de module/lesson deja `deletedAt` seteado y excluye del árbol; revert de `deletedAt` deja `null` + bump; palabra histórica con `status = "archived"` (minúsculas) aparece en `removedIds` y no en `words` de `GET /api/sync`.
  - GREEN: reemplazos laterales + normalización + filtros; `npx vitest run tests/fase-a/fase-a.del.test.ts`.
- **Dependencia:** T03 (words), T05 (cursos), T06 (media), T01 (columnas `deletedAt`).

### T08 — `sha256` en uploads (audio, imagen, legacy)

- **Criterios que cierra:** HASH-01.
- **Descripción:** En `upload-audio`, `upload-image` y el path de escritura de `update-audio`: calcular `sha256 = createHash("sha256").update(buffer).digest("hex")` sobre bytes originales antes del `putObject` y persistirlo en la fila `MediaAsset` (`sha256`, `objectKey`, `filename`, `mimeType`, `size`). Formato hex minúsculas, 64 caracteres. `upload-image` agrega el campo al `create` existente sin alterar compensación. `update-audio` legacy: por palabra tocada cuya `audioUrl` resuelva a objeto R2 existente, crea o actualiza la fila con hash sobre bytes descargados; referencias locales `/audio/*.wav` sin objeto R2 se reportan como fuera de inventario sin crear fila y sin bloquear (E6).
- **Archivos a tocar:**
  - `src/app/api/admin/upload-audio/route.ts`
  - `src/app/api/admin/upload-image/route.ts`
  - `src/app/api/dictionary/update-audio/route.ts`
  - `tests/fase-a/fase-a.hash-upload.test.ts` (nuevo, fixture binaria pequeña + hash calculado independientemente en el test)
- **Test que la cierra (RED→GREEN):**
  - RED: upload de audio e imagen crea fila `MediaAsset` con `sha256` igual al hash independiente; `update-audio` sobre objeto R2 existente crea/actualiza fila; sobre ruta local sin objeto no crea fila y no bloquea.
  - GREEN: cálculo y persistencia del hash; `npx vitest run tests/fase-a/fase-a.hash-upload.test.ts`.
- **Dependencia:** T06 (los paths ya crean fila y hacen bump); T01 (columna `sha256`).

### T09 — Script backfill idempotente + reporte de huérfanos

- **Criterios que cierra:** HASH-02.
- **Descripción:** Crear `scripts/backfill-media-sha256.ts` según spec §4.2: recorre `MediaAsset WHERE sha256 IS NULL` en lotes de 100 por `id` asc (reanudable, un commit por lote); por fila descarga R2 por `objectKey`, calcula hash y hace `UPDATE` solo de esa fila; objeto faltante → warning + entrada en `missingInR2[]`, sin borrar la fila y sin fallar; audios legacy (`DictionaryWord.audioUrl` vía `audioRefToKey` sin `MediaAsset`): si el objeto existe crea la fila (`filename` derivado, MIME por firma con `detectAudioMime`, `size` del objeto, hash), si no existe anota en `legacyMissing[]`; salida stdout + JSON `{ updated, skipped, missingInR2[], legacyCreated[], legacyMissing[] }`. La purga física queda fuera de alcance (`r2-prune` sigue siendo el único recolector; E5).
- **Archivos a tocar:**
  - `scripts/backfill-media-sha256.ts` (nuevo)
  - `tests/fase-a/fase-a.hash-backfill.test.ts` (nuevo, con R2 fake/stub: fila sin hash, objeto faltante, audio legacy con/sin objeto)
- **Test que la cierra (RED→GREEN):**
  - RED: primera corrida completa `sha256` faltantes y crea filas legacy existentes en R2; segunda corrida = `{ updated: 0, legacyCreated: 0 }` (0 writes); faltantes aparecen en el reporte sin fallar el script.
  - GREEN: script + reporte; `npx vitest run tests/fase-a/fase-a.hash-backfill.test.ts` y corrida manual en staging con artefacto JSON adjunto.
- **Dependencia:** T08 (formato de hash y creación de filas); T01 (columna `sha256`).

### T10 — Sync aditivo: `contentVersion` en `sync` y `seed`

- **Criterios que cierra:** SYNC-01, BUMP-04 (secuencia mixta `1 + N`).
- **Descripción:** `GET /api/sync` y `GET /api/sync/seed` agregan `contentVersion: number` vía `getContentVersion()` leído fresca por request. Ningún campo existente se renombra, cambia de tipo o se elimina. Auth sin cambios (`requireAuth` se mantiene; apertura pública = Fase B). `sinceVersion` no se implementa en Fase A (recorte §5.2: `pendingChanges` aproximado invitaría a lógica de APK sobre promesa falsa y colisionaría con el `since` ISO existente).
- **Archivos a tocar:**
  - `src/app/api/sync/route.ts`
  - `src/app/api/sync/seed/route.ts`
  - `tests/fase-a/fase-a.sync.test.ts` (nuevo: contrato aditivo + secuencia mixta)
- **Test que la cierra (RED→GREEN):**
  - RED: ambas respuestas incluyen `contentVersion` coincidente con `getContentVersion()`; snapshot de claves preexistentes intactas (`words`, `removedIds`/`total`, `page`, `pageSize`, `totalPages`, `serverTime`, `nextCursor`); secuencia N≥5 mutaciones efectivas mixtas (words + media + courses) desde `v0` deja `v0 + N` exacto.
  - GREEN: campo agregado; `npx vitest run tests/fase-a/fase-a.sync.test.ts`; test de volumen 5k+ filas verifica que el sync no trunca (deuda `take 5000` documentada para keyset en Fase B; E4).
- **Dependencia:** T02 (helper), T03–T06 (bumps que alimentan la secuencia), T07 (normalización que afecta `removedIds`).

---

## Fase 4 — Red de seguridad y cierre

### T11 — Test anti-olvido: toda ruta mutante nueva debe declarar su bump

- **Criterios que cierra:** red de seguridad de BUMP-05 hacia adelante.
- **Descripción:** Agregar test estático que inventaría `src/app/api/**/route.ts`, detecta handlers con mutaciones Prisma (`create`, `update`, `updateMany`, `delete`, `upsert`, `putObject`, `deleteMediaAssetById`) sobre entidades publicables y exige que el archivo importe o invoque `bumpContentVersion`, o que figure en una allowlist explícita con motivo (`import` staging, `import/preview`, lecturas, progreso de usuario, favoritos, historial, `games/*`, auth). El test falla al agregar una ruta mutante sin bump ni entrada en allowlist.
- **Archivos a tocar:**
  - `tests/fase-a/fase-a.bump-coverage.test.ts` (nuevo)
  - Ningún handler de producción (solo allowlist dentro del test si aplica).
- **Test que la cierra (RED→GREEN):**
  - RED: el test pasa con el inventario §2.3 actual; al simular una ruta mutante nueva sin bump (fixture temporal), el test falla señalándola.
  - GREEN: `npx vitest run tests/fase-a/fase-a.bump-coverage.test.ts`.
- **Dependencia:** T03–T06 (inventario completo de bumps ya aplicado).

### T12 — Verificación final y gates de calidad

- **Criterios que cierra:** GATES.
- **Descripción:** Corrida integral sin cambios de producción: typecheck, linter, suite TDD de Fase A en verde, regresión del sync existente (incluido R-ARCHIVED), y verificación de alcance (`git status` confirma cero diffs en app móvil, Admin UI y PWA). Actualizar `proposal.md` §estado si corresponde y dejar registrado el primer ítem de Fase B (exponer árbol + `sinceVersion` con delta-query real).
- **Archivos a tocar:** ninguno de producción (solo verificación + `openspec/changes/apk-offline-seed-fase-a/` si hay notas de cierre).
- **Test/comandos que la cierran:**
  1. `npx tsc --noEmit` → 0 errores.
  2. Linter del proyecto en limpio.
  3. `npx vitest run tests/fase-a/` → todo verde.
  4. Suite de regresión sync existente en verde.
  5. `git status --porcelain` → sin diffs fuera de `Diccionario-etapa1` web (móvil/Admin UI/PWA intactos).
- **Dependencia:** T01–T11 (todas).

---

## Orden de ejecución y dependencias

```text
T01 (migración)
 └─► T02 (helper)
       ├─► T03 (words) ──────────────┐
       ├─► T04 (import/revert) ──────┤
       ├─► T05 (courses/modules/ ─────┼─► T07 (borrado lógico + case) ──┐
       │     lessons/reorder) ───────┘                                   │
       └─► T06 (medios) ───────────────┬─► T08 (sha256 uploads) ─► T09 ─┤
                                       │      (backfill + huérfanos)    │
                                       └──────────────────────────────► T10 (sync aditivo)
                                                                          └─► T11 (anti-olvido) ─► T12 (gates)
```

`sinceVersion` no aparece en el grafo: recortado de Fase A por decisión §5.2.

---

## Review Workload Forecast

- **Chained PRs recommended:** Yes. Se sugieren 3 PRs encadenados: (1) T01+T02 (migración + helper, base revisable aislada); (2) T03–T07 (bumps + borrado lógico, el bloque mayor); (3) T08–T11 (medios + sync aditivo + anti-olvido). T12 es verificación sin código. Cada PR mantiene un foco de revisión único y evita mezclar DDL con semántica de borrado.
- **400-line budget risk:** High. El bloque (2) supera con amplitud el presupuesto de 400 líneas por la cantidad de handlers (19 puntos, §2.3) aunque cada bump sea de 1–3 líneas: la suma de diffs + tests T03–T07 excede el límite. Mitigación: dividir el bloque (2) en sub-PRs por grupo (words / import-revert / courses / media) si el revisor lo exige; ningún sub-PR mezcla grupos.
- **Changed lines estimadas:** ~1100–1500 líneas totales (producción ~350–500: migración SQL + 3 columnas + helper ~80 + ~19 bumps de 1–3 líneas + reemplazos laterales DELETE→ARCHIVED/`deletedAt` + normalización + `contentVersion` en 2 respuestas + `sha256` en 3 uploads + script backfill ~150; tests ~700–1000: 9 archivos `fase-a.*.test.ts` + fixtures). Sin cambios en móvil, Admin UI ni PWA (0 líneas fuera del repo web).
- **Decision needed before apply:** No. D2 (versión global atómica), D3 (borrado por entidad) y el recorte de `sinceVersion` ya se encuentran cerrados en `spec.md` §§2–5. `apply` puede proceder en el orden T01→T12 sin decisiones pendientes; el único punto de confirmación operativa es el dry-run de la migración en staging antes de producción (E7), que no bloquea el inicio de T01–T02.
