# Verify Report: apk-offline-seed-fase-a — Etapa 1

- **Change ID:** `apk-offline-seed-fase-a`
- **Branch:** `feat/etapa1-content-version`
- **Fecha:** 2026-11-07
- **Rol:** validación contra spec y tasks. No se implementó código nuevo; solo lectura y corridas de verificación.
- **Veredicto:** **PASS** (sin hallazgos bloqueantes; 0 CRITICAL, 3 WARNING, 4 SUGGESTION)

## 1. Cobertura T01–T12

| Tarea | Criterios que cierra | Evidencia de test | Estado |
|---|---|---|---|
| T01 — Migración Prisma | MIG-01, MIG-02 | `tests/fase-a/fase-a.mig.test.ts`: fila única `(1, v>=1)`; DMMF + `INFORMATION_SCHEMA` confirman `Module`/`Lesson` con `updatedAt` + `deletedAt` nullable e índice en `updatedAt`, `MediaAsset` con `sha256` nullable + `updatedAt`. Migración `20261107055302_fase_a_content_version` aditiva e idempotente (`IF NOT EXISTS` / `INSERT IGNORE`). | PASS |
| T02 — Helper `content-version.ts` | BUMP-01 | `tests/fase-a/fase-a.bump-helper.test.ts`: bump `v→v+1` con retorno; 2 bumps concurrentes (`Promise.all`) dejan `+2` exacto; `getContentVersion()` sin fila retorna `1` sin crearla. Implementación: `INSERT IGNORE (1,1)` + `UPDATE ... SET version = version + 1` vía `$executeRaw` sobre el `tx` recibido, sin read-modify-write. | PASS |
| T03 — Bumps words + bulk-status | BUMP-05, BUMP-02, BUMP-03 | `tests/fase-a/fase-a.bump-words.test.ts`: POST/PUT/PATCH/DELETE dejan `+1`; bulk sobre N palabras deja `+1`; `status` inválido y bulk con 0 filas no hacen bump. Normalización `toUpperCase().trim()` + validación `DRAFT\|PUBLISHED\|ARCHIVED` en el handler. | PASS |
| T04 — Import (2 pasos) + revert | BUMP-05, BUMP-02, BUMP-03, E2 | `tests/fase-a/fase-a.bump-import-revert.test.ts`: staging y preview no alteran versión; `confirm` sobre N filas deja `+1`; revert aplicado deja `+1`; revert 404/409/422 deja versión intacta. | PASS |
| T05 — Bumps courses/modules/lessons/reorder | BUMP-05, BUMP-02, BUMP-03, E3 | `tests/fase-a/fase-a.bump-courses.test.ts`: cada handler con mutación efectiva deja `+1`; reorder sobre N lecciones deja `+1`; reorder no-op (listas vacías u orden idéntico) sin bump. Bump insertado en handlers, no en `courses/_lib.ts` (respeta +1 por operación lógica). | PASS con nota (ver S1) |
| T06 — Bumps medios + legacy | BUMP-05, BUMP-03, DEL-03 (bump) | `tests/fase-a/fase-a.bump-media.test.ts` (11 casos): upload-audio/upload-image/delete-audio/media DELETE/update-audio dejan `+1`; 400/404/0-filas sin bump; clave sin fila borra objeto por compatibilidad con bump. Compensación R2 vigente (fallo de insert → borra objeto, sin bump). `update-audio` marcado `@deprecated`. | PASS |
| T07 — Borrado lógico + normalización + removedIds | DEL-01, DEL-02, DEL-03 (semántica), R-ARCHIVED | `tests/fase-a/fase-a.del.test.ts`: DELETE word/course deja `ARCHIVED` y excluye de lecturas; DELETE module/lesson deja `deletedAt` y excluye del árbol; revert de `deletedAt` deja `null` + bump; palabra histórica `"archived"` en minúsculas aparece en `removedIds` y no en `words`. Sync normaliza ambos lados (`String(w.status).toUpperCase()`). Filtros `deletedAt: null` verificados en `courses`, `courses/[id]`, `manifest`, `modules/[id]/lessons`, `courses/[id]/lessons/[lessonId]`. Bitácora conserva `AuditLog(action: "DELETE")`. | PASS |
| T08 — `sha256` en uploads | HASH-01 | Cobertura real en `tests/fase-a/fase-a.hash-backfill.test.ts` (bloques T08: upload-audio, upload-image y update-audio persisten `sha256` igual al hash independiente, formato `/^[0-9a-f]{64}$/`; rutas locales sin objeto no crean fila y no bloquean). Handlers calculan `sha256Hex(buffer)` antes del `putObject`. | PASS con nota (ver S2) |
| T09 — Backfill idempotente + huérfanos | HASH-02 | Núcleo en `src/lib/media/backfill-sha256.ts` (lotes de 100 por `id` asc, `WHERE sha256 IS NULL`, faltantes → warning sin borrar, legacy con/sin objeto), invocable vía `prisma/backfill-media-sha256.ts` (`--json` para artefacto `{ updated, skipped, missingInR2[], legacyCreated[], legacyMissing[] }`). Segunda corrida = 0 writes, verificado en test. Sin bump (sanado, no publicación — correcto). | PASS con nota (ver S3) |
| T10 — Sync aditivo `contentVersion` | SYNC-01, BUMP-04 | `tests/fase-a/fase-a.sync-aditivo.test.ts`: `GET /api/sync` y `GET /api/sync/seed` devuelven `contentVersion` coincidente con `getContentVersion()` con claves preexistentes intactas; secuencia mixta N=5 deja `v0+5` exacto. Auth sin cambios. `sinceVersion` ausente = recorte §5.2 respetado. | PASS |
| T11 — Anti-olvido | Red de seguridad BUMP-05 | `tests/fase-a/fase-a.anti-olvido.test.ts`: escanea `src/app/api/**/route.ts`, exige `bumpContentVersion` o allowlist con motivo; incluye test de fixture temporal que demuestra que señala rutas nuevas. Allowlist: solo `admin/import/route.ts` (staging T04). 17 archivos `route.ts` de producción con bump; staging/preview correctamente sin bump. | PASS |
| T12 — Gates de calidad | GATES | `vitest run tests/fase-a/` → 10 archivos, 98 tests, todo verde. `eslint` en archivos tocados → limpio. `tsc --noEmit` → 1 único error pre-existente y ajeno (ver W1). `git status` → sin diffs fuera del repo web (móvil/Admin UI/PWA intactos; alcance confirmado). | PASS con WARNING (W1) |

Conteo de handlers con bump en producción: **17 archivos `route.ts`** (revert, delete-audio, import/confirm, upload-audio, upload-image, bulk-status, words, words/[id], reorder, courses, courses/[id], update-audio, lessons/[id], media/[id], modules, modules/[id], modules/[id]/lessons). El brief mencionaba "16 archivos" de forma aproximada; la diferencia es el desglose modules/lessons, sin faltantes.

## 2. Verificación D2 / D3 / sinceVersion recortado

- **D2 (versión global atómica):** verificado. `bumpContentVersion` usa `UPDATE ... SET version = version + 1` (nunca read-modify-write en JS), asegura la fila con `INSERT IGNORE (1,1)` sobre el mismo `tx`, y retorna la versión resultante por `SELECT`. `getContentVersion` lee fresco por request, sin caché, con fallback `1` pre-migración. Test de concurrencia (`+2` exacto) en verde.
- **D3 (borrado por entidad):** verificado. `DictionaryWord`/`Course` → `ARCHIVED` (sin `deletedAt`, sin doble semántica); `Module`/`Lesson` → `deletedAt` (sin `status`, contrato de cursos intacto); `MediaAsset` → eliminación de fila + diff de manifiesto `(objectKey, sha256)` (sin `deletedAt`). `delete-audio` resuelve fila por `objectKey` (`audioRefToKey` + `findFirst`) antes del borrado R2.
- **`sinceVersion` recortado:** verificado. Ninguna ruta de `sync` acepta `sinceVersion` ni devuelve `pendingChanges`; solo se expone la versión actual. Sin colisión con el `since` ISO existente. Correcto según spec §5.2.

## 3. Regresiones

- **R-ARCHIVED:** PASS. Doble cobertura: `tests/fase-a/fase-a.del.test.ts` (bloque T07 R-ARCHIVED) y `tests/fase-a/fase-a.sync-aditivo.test.ts` (caso "status histórico en minúsculas sigue en `removedIds` y fuera de `words`"). Comparación normalizada en filtro de `words` y construcción de `removedIds` de `src/app/api/sync/route.ts`.
- **Sync aditivo:** PASS. Ningún campo existente renombrado, cambiado de tipo o eliminado en `sync` ni `seed` (snapshot de claves preexistentes en test). `contentVersion` agregado al final del payload.
- **Anti-olvido:** PASS. Toda ruta mutante sobre entidades publicables declara bump o figura en allowlist con motivo documentado. Red de seguridad vigente hacia adelante.
- **Alcance:** PASS. `git status` no muestra diffs en app móvil, Admin UI ni PWA (verificado: `text-editor.tsx` y demás archivos fuera de `src/app/api`, `src/lib`, `prisma`, `tests/fase-a` no pertenecen a esta rama — el único error de `tsc` está en un archivo no tocado por Fase A).

## 4. Hallazgos

### CRITICAL (bloquean merge)

Ninguno.

### WARNING (no bloquean, requieren seguimiento)

- **W1 — `tsc --noEmit`: 1 error pre-existente y ambiental en `src/components/admin/lesson-editor/text-editor.tsx`.** Incompatibilidad de tipos por doble copia de `@tiptap/core` (`@tiptap/extensions` anida su propia versión; `Mark`/`Node` no unifican). El archivo no fue tocado por Fase A (últimos commits: placeholder del editor, paleta de colores — nada de versionado). Ningún archivo de Fase A introduce errores de tipos. Recomendación: fix fuera de esta rama (alinear versiones de `@tiptap/*` o `overrides`/`resolutions`), no como parte del merge de Fase A.
- **W2 — Idempotencia operativa de la migración (`migrate deploy` ×2 + dry-run en staging, E7) no re-ejecutada en esta validación.** La migración es idempotente por construcción (`IF NOT EXISTS` / `INSERT IGNORE`, documentado en el header del SQL) y el test MIG-01 aserta el estado final, pero la doble corrida literal y el dry-run en staging previo a producción siguen pendientes como paso operativo del deploy, no como defecto de código.
- **W3 — Test de volumen 5k+ filas (E4, `take 5000`) no evidenciado.** T10 menciona verificar que el sync no trunca con 5k+ filas; no se encontró ese caso en la suite corrida (98 tests, todos unitarios/integración con fakes). La deuda de paginación por keyset queda correctamente documentada para Fase B, pero si el gate T12 exigía la corrida de volumen, registrarla como pendiente operativa o recortarla explícitamente del gate.

### SUGGESTION (mejoras no bloqueantes)

- **S1 — Spec §2.3 punto 18 sobre-especifica `PUT|DELETE /api/courses/[id]/lessons/[lessonId]`.** El archivo solo exporta `GET` (detalle on-demand con `nav`); los PUT/DELETE reales viven en `lessons/[id]`, que sí tiene bump. Ningún gap funcional (el anti-olvido lo confirma: sin mutación no exige bump). Sugerencia: corregir el spec en una línea para que el inventario cite solo `GET` en esa ruta.
- **S2 — Cobertura T08 vive en `fase-a.hash-backfill.test.ts`, no en `fase-a.hash-upload.test.ts` como nombraba `tasks.md`.** Cobertura completa y correcta (los tres uploads + backfill en un solo archivo coherente); solo diverge la nomenclatura. Sugerencia: renombrar el archivo o anotar la equivalencia en `tasks.md` para trazabilidad.
- **S3 — Backfill reside en `prisma/backfill-media-sha256.ts` + `src/lib/media/backfill-sha256.ts`, no en `scripts/` como indicaba el spec.** La separación núcleo/invocador es sana (testeable sin I/O real) y el invocador documenta el uso con `--json`. Sugerencia: actualizar la ruta en spec §4.2 / T09.
- **S4 — Allowlist del anti-olvido con una sola entrada (`import` staging).** Correcta y suficiente hoy (preview es solo lectura; progreso/favoritos/auth no tocan modelos publicables, por lo que el escáner no los señala). Sin acción; solo constar que se revisó y no faltan entradas.

## 5. Comandos corridos (resultados observados)

- `npx vitest run tests/fase-a/` → **10 archivos, 98 tests, todo verde** (duración ~13 s).
- `npx tsc --noEmit` → **1 único error** en `src/components/admin/lesson-editor/text-editor.tsx` (TS2769, doble `@tiptap/core`; pre-existente, ajeno a Fase A). Cero errores en archivos de Fase A.
- `npx eslint src/lib/content-version.ts src/lib/media/hash.ts src/lib/media/backfill-sha256.ts src/app/api/sync/route.ts src/app/api/sync/seed/route.ts tests/fase-a/ prisma/backfill-media-sha256.ts` → **limpio, exit 0**.
- Verificaciones de solo lectura: `grep` de bump en 17 handlers prod, ausencia de `sinceVersion`, normalización `ARCHIVED` (2 sitios), filtros `deletedAt: null` en 5 lecturas del árbol, `sha256` en 3 uploads, `git diff` sin `text-editor.tsx`.

No se implementó ni modificó código de producción. Sin fixes aplicados (ningún fix mínimo resultó necesario: no hay CRITICAL).

## 6. Política de gate de la rama (C3)

El gate de `feat/etapa1-content-version` es esta lista cerrada. Lo que no está aquí no bloquea el merge.

| # | Comando | Esperado |
|---|---|---|
| G1 | `npx vitest run tests/fase-a/` | 100 % verde — 11 archivos (`bump-words`, `bump-import-revert`, `bump-courses`, `bump-media`, `bump-helper`, `del`, `hash-backfill`, `mig`, `sync-aditivo`, `tombstones`, `anti-olvido`); cubre words/import/confirm/revert/courses/lessons/upload/media/sync |
| G2 | `npx tsc --noEmit` | 0 errores (tras PR0 `fix/tiptap-align`; el TS2769 de `text-editor.tsx` era pre-existente y ajeno a Fase A) |
| G3 | `npx eslint <rutas tocadas>` | exit 0 en cada archivo tocado por la ronda |

### Estado de W1/W2/W3 tras la ronda de corrección

| Hallazgo | Resolución |
|---|---|
| W1 — `tsc` en rojo (TS2769 tiptap) | Resuelto por PR0 `fix/tiptap-align` (rama aparte desde `main`); G2 lo verifica |
| W2 — migración sin dry-run formal en staging | Resuelto por el runbook `DEPLOY.md` (C4): `migrate deploy` ×2 + diff vacío + smoke de bumps |
| W3 — volumen 5k+ sin evidenciar (E4) | Resuelto por C2: loop keyset `(createdAt, id)` + test de 5001 filas en `fase-a.tombstones.test.ts`; E4 CERRADO en spec §7 |

### Deuda conocida fuera del gate (no se fixea en esta ronda)

Suites de UI con flakes no deterministas solo en corrida completa; evidencia **85/85 en aislamiento**:

- `src/components/admin/course-manager.test.tsx`
- `src/components/explore-section.test.tsx`
- `src/components/juegos/escucha-game.test.tsx`
- Player: `src/components/cursos/player/player-shell.test.tsx`, `src/components/cursos/player/player-motion.test.tsx` (+ `src/app/cursos/[id]/curso.test.tsx`)

### Checklist de merge

- [ ] G1 + G2 + G3 en verde con resultados observados pegados en el PR
- [ ] `git status --porcelain` limpio salvo `.atl/*` (ruido pre-existente del tooling, fuera de scope)
- [ ] `bun.lock` commiteado con una sola versión de `@tiptap/core` (`grep '@tiptap/core@' bun.lock | sort -u` → 1 línea)
