# Proposal: apk-offline-seed-fase-a — Etapa 1: versionado global + borrado lógico + registro de medios

- **Change ID:** `apk-offline-seed-fase-a`
- **Branch:** `feat/etapa1-content-version`
- **Repo scope:** solo `Diccionario-etapa1` (web). App móvil intacta. Admin UI sin cambios. PWA intacta.
- **Estado:** propuesta (sin spec/tasks todavía — siguiente paso recomendado: `spec`)
- **artifact_store.mode:** hybrid (engram no disponible en este runtime → file-based en `openspec/`; pendiente: replicar decisiones D2/D3 y este proposal en engram cuando el runtime lo exponga)
- **delivery_strategy:** ask-on-risk (preguntar antes de ejecutar migraciones destructivas o cambios de contrato público)

## 1. Problema

La APK offline necesita un seed confiable del contenido web (diccionario + cursos + medios), pero hoy el repo web no tiene cómo responder "¿qué cambió desde la versión X?":

1. **Sin marcador de publicación.** No existe `ContentVersion`. Los endpoints `sync` (`/api/sync/seed`, `/api/sync/*`) exigen auth, no aceptan `sinceVersion` ni devuelven `contentVersion`, y solo cubren `DictionaryWord`. La APK no puede saber si está atrasada ni cuántos cambios le faltan sin descargar todo.
2. **Borrados físicos / invisibles.** `DictionaryWord` y `Course` tienen `ARCHIVED` pero el archivado no siempre se propaga al sync; `Module`/`Lesson` no tienen `updatedAt`, `deletedAt` ni `status` (verificado en `prisma/schema.prisma`); `MediaAsset` no tiene `hash` ni `updatedAt`. Un borrado o reemplazo de medio puede dejar a la APK con contenido fantasma o huérfano sin forma de reconciliar.
3. **Medios fuera de inventario.** Existen dos caminos de audio: `update-audio` legacy (escribe `audioUrl` directo sin fila `MediaAsset`) y `upload-audio` (sube a R2 sin crear fila `MediaAsset`), mientras que `upload-image` sí crea fila. `delete-audio` borra solo el objeto R2 sin tocar metadatos. El manifiesto del seed no puede listar todos los medios reales porque parte del inventario nunca se registra.
4. **Superficie mutante amplia sin red de seguridad.** Explore previo inventarió 20+ rutas mutantes que cambian contenido publicable: `admin/words` POST/PUT/PATCH/DELETE, `bulk-status`, `import` + `confirm`, `revert`, `update-audio` legacy, `upload-audio`, `upload-image`, `delete-audio`, `media` DELETE, CRUD + `reorder` de courses/modules/lessons. Ninguna hoy hace bump de versión.

Sin esta Etapa 1, cualquier seed offline nace obsoleto: no versionado, no difable, no reconciliable.

## 2. Objetivo medible

Al cerrar la Fase A, el repo web expone una base versionada y reconciliable para el seed offline, verificable con tests:

- `GET /api/sync/seed` (y variantes `sync/*`) responden `contentVersion: <number>` aditivo, sin romper el contrato actual (ningún campo existente cambia de forma o se elimina).
- Toda mutación de contenido publicable incrementa la versión global exactamente +1 por operación lógica (bump atómico), verificable con test RED→GREEN por punto de bump.
- Todo borrado de entidad publicable es lógico y visible para el sync (ARCHIVED o `deletedAt`), nunca físico silencioso.
- Todo medio servido por el seed tiene fila `MediaAsset` con `sha256` (backfill idempotente para el histórico), de modo que el manifiesto puede hacer diff por hash.
- Criterio numérico: `contentVersion` arranca en `1` post-migración y cualquier secuencia de N mutaciones consecutivas deja `version = 1 + N` (sin saltos ni dobles bumps).

## 3. Alcance / No-alcance

### En alcance (Fase A, solo repo web)

- Migración Prisma: crear `ContentVersion`, agregar columnas nuevas (`Module`/`Lesson` `updatedAt` + `deletedAt`; `MediaAsset` `sha256` + `updatedAt`).
- Helper de bump atómico (`UPDATE ContentVersion SET version = version + 1 WHERE id = 1`) + invocación en los ~18 puntos mutantes inventariados.
- Borrado lógico: `DictionaryWord`/`Course` vía `ARCHIVED`; `Module`/`Lesson` vía `deletedAt` nuevo; `MediaAsset` por diff de manifiesto (sin `deletedAt`).
- `sha256` en uploads (`upload-audio`, `upload-image`, `update-audio`) + script de backfill idempotente para medios históricos.
- `sync` aditivo: `contentVersion` en respuesta (+ `sinceVersion` opcional si no rompe compat; si hay riesgo, solo exponer versión actual en esta fase y dejar delta-query para Fase B).
- Tests TDD por cada grupo: migración, bump, borrado lógico, hash/backfill, sync aditivo.

### Fuera de alcance (explícito)

- App móvil: intacta. Ningún cambio en código nativo, ni en su lógica de sync/descarga.
- Admin UI: sin cambios visuales ni flujos nuevos.
- PWA: intacta (service worker, caché y rutas actuales sin tocar).
- Delta-sync por `updatedAt` + keyset, endpoint de manifiesto completo, descarga binaria masiva, y estrategia de tombstones paginados: pertenecen a Fase B (solo se dejan preparados los campos que los hacen posibles).
- Limpieza física de R2 huérfano y purga de `ARCHIVED` antiguos: no en esta fase.

## 4. Decisiones

### D2 (decidida): número de versión como marcador de publicación, no estampado por fila

**Decisión:** una sola fila `ContentVersion(id = 1, version: Int)`. Cada mutación publicable ejecuta 1 `UPDATE` atómico `version = version + 1`. El delta-sync real sigue por `updatedAt` + keyset; la versión solo responde "¿mi APK está atrasada?", "¿hubo cambios desde mi última APK?", "hay N cambios pendientes" (N = versión remota − versión local, aproximado a nivel conteo de operaciones).

**Tradeoffs considerados:**

| Alternativa | Por qué se descarta en Fase A |
|---|---|
| Estampar `contentVersion` por fila en cada tabla | N escrituras por operación (bulk/import/reorder tocan decenas de filas); riesgo de versiones mixtas a mitad de transacción; migración más pesada. Se evalúa en Fase B solo si el conteo aproximado resulta insuficiente. |
| Timestamp global (`lastPublishedAt`) | Colisiones bajo concurrencia (dos admins guardando en el mismo ms), reloj skewed entre instancias, imposible responder "cuántos cambios" sin escanear. |
| Sin versión, solo `updatedAt` | Obliga a la APK a escanear todas las tablas para saber si algo cambió; costoso en offline/intermitente y no da número comparable. |

**Consecuencia de diseño:** el bump debe ir en la misma transacción lógica que la mutación (o inmediatamente después con reintento), y debe ser exactamente +1 por operación lógica aunque la operación toque muchas filas (bulk/import/reorder = 1 bump, no N).

### D3 (decidida): borrado lógico por entidad, con mecanismo distinto según tabla

**Decisión:**

- `DictionaryWord` y `Course`: reutilizar `ARCHIVED` ya existente y ya sincronizado. No se agrega `deletedAt` (evita doble semántica).
- `Module` / `Lesson`: agregar `deletedAt DateTime?` nuevo (no tienen `status`; agregarlo rompería el contrato de cursos y la UI de admin que no se toca en esta fase). Borrado = set `deletedAt = now()` + bump. Lecturas públicas y sync excluyen `deletedAt != null`.
- `MediaAsset`: sin `deletedAt`. Se reconcilia por **diff en manifiesto**: el seed lista `(objectKey, sha256)` vigentes; lo que falta en el manifiesto respecto al caché local se considera borrado. Evita columna que nadie consulta y cubre el caso "borrado directo en R2".

**Tradeoffs considerados:**

| Alternativa | Por qué se descarta |
|---|---|
| Borrado físico + tombstones universales | Requiere tabla `Tombstone` nueva, paginación (`take 5000` actual es riesgo conocido) y GC; sobredimensionado para Fase A. Se retoma en Fase B si el diff de manifiesto no escala. |
| `status` también en Module/Lesson | Cambia el contrato del árbol de cursos y la admin UI (fuera de alcance). `deletedAt` es aditivo y no rompe nada. |
| `deletedAt` también en MediaAsset | Los medios se borran/reemplazan a nivel objeto R2 con frecuencia; el diff por `(objectKey, sha256)` ya da reconciliación exacta sin columna extra que mantener. |

## 5. Diseño a alto nivel

### 5.1 Tabla `ContentVersion`

```prisma
model ContentVersion {
  id      Int @id @default(1) // una sola fila, id = 1
  version Int @default(1)
}
```

- Migración: `CREATE TABLE ContentVersion` + `INSERT (id, version) VALUES (1, 1)` idempotente (upsert / `INSERT IGNORE` según motor).
- Helper único (ej. `src/lib/content-version.ts`): `bumpContentVersion(tx)` → `UPDATE ContentVersion SET version = version + 1 WHERE id = 1` dentro de la transacción de la mutación. Sin caché en memoria (siempre lectura fresca para la APK).
- Lectura: `getContentVersion()` para los endpoints `sync`.

### 5.2 Columnas nuevas por tabla

| Tabla | Columnas a agregar | Notas |
|---|---|---|
| `Module` | `updatedAt DateTime @updatedAt`, `deletedAt DateTime?` | `updatedAt` habilita delta-sync futuro; `deletedAt` = borrado lógico D3. Índice `@@index([updatedAt])` para keyset. |
| `Lesson` | `updatedAt DateTime @updatedAt`, `deletedAt DateTime?` | Igual que Module + ya existen índices por `order`/`lessonNumber`; agregar `@@index([updatedAt])`. |
| `MediaAsset` | `sha256 String?`, `updatedAt DateTime @updatedAt` | `sha256` nullable en migración (backfill lo completa); a futuro `NOT NULL` cuando el backfill esté verificado. Índice `@@index([updatedAt])`. |
| `DictionaryWord`, `Course` | Sin columnas nuevas | Reutilizan `status`/`ARCHIVED` + `updatedAt` existentes. |
| `ContentVersion` | Tabla nueva (ver 5.1) | — |

Todas las columnas son **aditivas**: ningún campo existente cambia de tipo ni se elimina (contrato sync intacto).

### 5.3 Hash sha256 en upload + backfill idempotente

- **Uploads** (`upload-audio`, `upload-image`, `update-audio` legacy al migrarse a fila `MediaAsset`): calcular `sha256` del buffer antes de subir a R2, persistirlo en la fila `MediaAsset` junto a `objectKey/filename/mimeType/size`. El hash se calcula sobre bytes originales, no sobre URL.
- **Backfill** (`scripts/backfill-media-sha256.ts`, idempotente): recorre `MediaAsset` con `sha256 IS NULL`, descarga objeto R2 por `objectKey`, calcula hash, `UPDATE` fila. Re-ejecutable sin efectos (salta filas ya con hash; reporta objetos faltantes en R2 como warnings, no como fallo duro). Audios legacy sin fila (`audioUrl` directo): el backfill crea la fila `MediaAsset` correspondiente si el objeto existe en R2; si no existe, lo reporta en el log de "audios fuera de inventario" (riesgo conocido, no bloquea).
- **Verificación:** test con fixture binaria pequeña: upload → assert `sha256` = hash esperado; backfill sobre fila sin hash → assert hash completo; segunda corrida → assert sin cambios (idempotencia).

### 5.4 Bump en ~18 puntos + reemplazos laterales

Puntos a instrumentar (lista del explore previo, a confirmar contra código en fase spec sin re-mapeo completo):

1-4. `admin/words` POST / PUT / PATCH / DELETE · 5. `bulk-status` · 6. `import` · 7. `import/confirm` (import en dos pasos = 1 bump solo en confirm, no en staging) · 8. `revert` · 9. `update-audio` legacy · 10. `upload-audio` · 11. `upload-image` · 12. `delete-audio` · 13. `media` DELETE · 14-16. courses CRUD (POST/PUT/DELETE) · 17. modules CRUD + 18. lessons CRUD + `reorder` (cada `reorder` = 1 bump aunque reordene N lecciones).

**Reemplazos laterales** (cambios de comportamiento que acompañan al bump sin romper contrato):

- DELETEs físicos de `DictionaryWord`/`Course` → set `status = ARCHIVED` (el endpoint sigue devolviendo 200/204 igual que antes).
- DELETEs físicos de `Module`/`Lesson` → set `deletedAt = now()`.
- `delete-audio` y `media` DELETE: además de borrar R2, resuelven la fila `MediaAsset` (marcar o eliminar según decida spec; el sync lo refleja vía diff de manifiesto) + bump.
- `upload-audio` sin fila → crea fila `MediaAsset` (reemplazo lateral que cierra la brecha de inventario).

Regla: si la mutación falla, no hay bump (bump dentro de la transacción o post-commit solo en éxito).

### 5.5 Sync aditivo con `contentVersion`

- `GET /api/sync/seed` (y `sync/*` afectados) agregan `contentVersion: number` al JSON de respuesta. Ningún campo existente se renombra ni cambia de tipo.
- `?sinceVersion=` opcional: si se incluye en Fase A, es solo informativo (el server puede devolver `pendingChanges: contentVersion - sinceVersion` aproximado); el filtrado real por `updatedAt` + keyset queda para Fase B. Si el spec detecta riesgo de contrato, `sinceVersion` se recorta de Fase A sin afectar el resto.
- Auth se mantiene como hoy (sin cambios); la apertura pública del seed, si se necesita para la APK, es decisión de Fase B.

## 6. Riesgos

| # | Riesgo | Impacto | Mitigación en Fase A |
|---|---|---|---|
| R1 | **Tombstones / paginación `take 5000`.** El sync actual pagina con límite alto; con borrados lógicos el result-set crece (ARCHIVED + `deletedAt` excluidos por filtro, pero el conteo y los índices cambian). | Sync lento o truncado en datasets grandes. | Filtros `status != ARCHIVED` / `deletedAt IS NULL` con índices en `updatedAt`; test de volumen con 5k+ filas; `take 5000` documentado como deuda a paginar por keyset en Fase B. |
| R2 | **Cursos invisibles hoy.** El árbol courses/modules/lessons puede no estar expuesto en el seed actual (solo `DictionaryWord` sincronizado). Agregar bumps sin exponer el árbol da versión que sube sin contenido visible. | Confusión "versión sube pero nada cambia" en la APK. | Spec debe inventariar qué expone `sync/seed` hoy; si cursos no están expuestos, Fase A igual deja versionado + borrado lógico listos y documenta la exposición del árbol como primer ítem de Fase B. No se expone el árbol en Fase A (fuera de alcance). |
| R3 | **Audios fuera de `MediaAsset`.** `update-audio` legacy y `upload-audio` histórico dejaron objetos R2 sin fila; el manifiesto los omite hasta el backfill. | Seed incompleto / ilustraciones-audio huérfanos. | Backfill crea filas faltantes cuando el objeto existe; reporte de huérfanos (objeto sin fila y fila sin objeto) como artefacto de verificación; `upload-audio` nuevo siempre crea fila. |
| R4 | **Doble bump / bump perdido bajo concurrencia.** Dos admins mutando a la vez; retry de cliente re-ejecutando POST. | Versión salta +2 o se queda corta; "N cambios pendientes" inexacto. | `UPDATE` atómico (no read-modify-write); idempotency-key o guarda de reintento donde ya exista; test de concurrencia (2 bumps paralelos → +2 exacto). |
| R5 | **Bump fuera de transacción.** Mutación OK + bump fallido (o viceversa). | Versión miente. | Bump dentro de la misma transacción Prisma donde el motor lo permita; donde no, orden mutación→bump con log + alerta; test de fallo inyectado. |
| R6 | **Migración en MySQL/MariaDB productiva.** `ALTER TABLE` en tablas grandes + `INSERT` inicial de `ContentVersion`. | Lock / downtime. | Migración aditiva nullable primero; backfill después; `INSERT IGNORE` idempotente; ventana de mantenimiento solo si el dry-run en staging lo pide. |

## 7. Plan por fases (con TDD)

> TDD es obligatorio en cada fase de código: test failing primero (RED),Jones implementación mínima (GREEN), refactor. Ningún bump, columna o endpoint sin su test previo.

1. **Fase 1 — Migración (estimado 2-3h).** Escribir tests de schema (ContentVersion existe, fila id=1, columnas nuevas presentes). Migración Prisma aditiva + `INSERT (1,1)` idempotente. `prisma migrate diff` revisado + dry-run en staging. Criterio: `migrate deploy` en limpio dos veces seguidas sin error (idempotencia).
2. **Fase 2 — Bumps + tests (estimado 5-6h, el bloque mayor).** Helper `bumpContentVersion` + test unitario (atómico, +1 exacto, concurrente). Luego por grupo de rutas (words → bulk/import/revert → media/audio → courses/modules/lessons/reorder): test RED (mutación sube versión) → GREEN (agregar bump) → refactor. Regla de import en dos pasos y reorder = 1 bump testeada explícitamente.
3. **Fase 3 — Backfill sha256 (estimado 2-3h).** `sha256` en path de upload (tests con fixture) + script `backfill-media-sha256.ts` idempotente + reporte de huérfanos. Criterio: segunda corrida = 0 updates.
4. **Fase 4 — Verificación sync + cierre (estimado 1-2h).** `contentVersion` en respuesta sync (test de contrato: campos viejos intactos + campo nuevo presente), secuencia N mutaciones → `1 + N`, auditoría de borrados lógicos (ARCHIVED/`deletedAt`/diff manifiesto). Actualizar este proposal con lo ejecutado y abrir `spec.md`.

**Esfuerzo total estimado: ~10-14h** (1: 2-3h + 2: 5-6h + 3: 2-3h + 4: 1-2h). Supone motores de test ya configurados (vitest) y R2 accesible en staging para el backfill.

## 8. Criterios de aceptación (verificables)

- [ ] `prisma migrate deploy` corre dos veces seguidas sin errores; `ContentVersion` tiene exactamente una fila `(1, v>=1)`.
- [ ] `Module`/`Lesson` tienen `updatedAt` + `deletedAt`; `MediaAsset` tiene `sha256` + `updatedAt` (assert contra `prisma schema` / introspección en test).
- [ ] Cada uno de los ~18 puntos mutantes tiene un test que falla sin bump y pasa con bump (lista de tests trazable a rutas).
- [ ] Secuencia controlada de N mutaciones (N≥5, mezclando words/media/courses) deja `version = version_inicial + N` exacto.
- [ ] Dos bumps concurrentes dejan `+2` exacto (sin lost update).
- [ ] DELETE de word/course deja fila con `ARCHIVED` (no desaparece); DELETE de module/lesson deja `deletedAt` seteado; ambos excluidos del sync público pero contados por el bump.
- [ ] Upload nuevo (audio e imagen) crea/actualiza fila `MediaAsset` con `sha256` correcto (hash independently computed en el test).
- [ ] Backfill: primera corrida completa `sha256` faltantes; segunda corrida = 0 writes; huérfanos reportados en log artefacto.
- [ ] `GET /api/sync/seed` devuelve `contentVersion` y todos los campos preexistentes sin cambios de forma (test de contrato / snapshot aditivo).
- [ ] `tsc --noEmit` 0 errores; linter del proyecto en limpio; suite TDD de Fase A en verde.
- [ ] App móvil, Admin UI y PWA sin diffs (verificado con `git status` / revisión de alcance).

## 9. Trazabilidad de skills

- `api-design-patterns` (inyectada, `/home/mario/.agents/skills/api-design-patterns/SKILL.md`): versionado aditivo sin breaking changes, keyset sobre `updatedAt`, idempotencia de bumps y backfill, contrato de error mínimo. Aplicada en §5.1, §5.4, §5.5 y R4/R5.
- `test-driven-development-tdd` (inyectada, `/home/mario/.pi/agent/skills/test-driven-development-tdd/SKILL.md`): ciclo RED→GREEN→refactor por cada bump, columna, hash y campo sync; verificación RED antes de implementar; criterio "sin test failing previo no hay código". Aplicada en §7 y §8.
- Evidencia base: explore previo (20+ rutas mutantes, ausencia de `ContentVersion`, `MediaAsset` sin hash/`updatedAt`, Module/Lesson sin `updatedAt`/`deletedAt`/`status`) + verificación puntual en `prisma/schema.prisma` (Course/Module/Lesson/MediaAsset/DictionaryWord) en esta sesión; no se re-mapeó el repo de cero.

## 10. Pendientes para `spec.md` (next_recommended)

1. Generar `openspec/changes/apk-offline-seed-fase-a/spec.md`: inventario ruta-por-ruta con firma (método, path, archivo handler), dónde insertar `bumpContentVersion` y en qué transacción, y decisión `sinceVersion` (incluir informativo vs. recortar).
2. Definir `tasks.md` con los tests TDD por grupo y el orden de ejecución del plan §7.
3. Decidir en spec: destino exacto de filas `MediaAsset` en `delete-audio`/`media` DELETE (marcar vs. eliminar) y formato del manifiesto `(objectKey, sha256)`.
4. Registrar D2/D3 + este proposal en engram cuando el runtime lo exponga (hoy file-based solamente).
