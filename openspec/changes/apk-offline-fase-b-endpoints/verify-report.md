# Verify report — apk-offline-fase-b-endpoints (Etapa 2: sync público + endpoint CI)

- **Branch:** `feat/fase-b-endpoints` (commits `ab8d75d` → `4b7d5f7`).
- **Fecha:** 2026-11-08. **Idioma:** neutral/professional Spanish.
- **Alcance del reporte:** validar implementación contra `proposal.md` (F1/F2/R3(b)), `spec.md` (W1–W4) y `tasks.md` (T01–T06). Sin código nuevo; solo lectura + comandos.

## 1. Cobertura T01–T06 (criterio que cierra cada una + evidencia)

### T01 — W1 `GET /api/sync/version` ✅
- Cierra plan criterio 1, spec §1.5, proposal §8.1.
- `src/app/api/sync/version/route.ts`: handler `GET` mínimo con `getContentVersion()`, sin auth ni params, `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` solo en 200; 500 con `{ message: "Error interno del servidor" }` sin encabezado.
- Evidencia: `src/app/api/sync/version/route.test.ts` (3 tests: forma exacta `{ contentVersion: number }` + encabezado; lectura fresca N → N+1 con dos llamadas a `findUnique`; 500 exacto sin `Cache-Control`). Todos en verde.

### T02 — W2 sync público ✅ (a nivel unitario; integración con BD pendiente, ver §4)
- Cierra plan criterio 2, spec §2.6, proposal §8.2.
- `requireAuth` eliminado de `sync/route.ts` y `seed/route.ts` (verificado: `grep requireAuth src/app/api/sync/` vacío).
- Filtro `AND: [{ status: "PUBLISHED" }, updatedFilter]` en consulta de `sync`; `where = { status: "PUBLISHED" }` compartido por `count` + `findMany` en `seed` (sin cambios, verificado por test).
- Derivación `removedIds` conservada como defensa (líneas 125–131) + loop keyset de tombstones intacto (`take: 1000`, patrón `createdAt/id`, sin tope duro).
- `Cache-Control` público idéntico en cada `return` de éxito; 500 sin encabezado.
- `src/app/api/courses/**` intacto: `isEditor()` sigue local en los 3 archivos, cero diffs (spec §2.5 respetado).
- Evidencia: `src/app/api/sync/sync.test.ts` (9 tests: 200 sin sesión en ambas rutas + encabezado; `where` PUBLISHED-only aseverado en la llamada; `where` compartido en seed; tombstones en `removedIds`; defensa ARCHIVED por mock; `contentVersion` en ambas; cursor opaco + paginación).

### T03 — W3a `src/lib/ci-auth.ts` ✅
- Cierra base del plan criterio 3, spec §3.1, mitiga R3.
- `expectedCiSecret()` (vacío/ausente → `null`, falla cerrado), `isValidCiSecret()` (`timingSafeEqual` + resguardo de longitud), `ciUnauthorized()` (401 `{ message: "No autorizado" }` + `private, no-store`).
- Sin `checkRateLimit`/`getClientIp`, sin logs de valores (omisión justificada en comentario, spec §3.1).
- Evidencia: `src/lib/ci-auth.test.ts` (5 tests: null/undefined/vacío; inválido → 401 idéntico; válido; longitudes distintas no lanzan; env ausente/vacío → todo 401).

### T04 — W3b `GET /api/sync/full` + serializador ✅ (con WARNING W-2)
- Cierra plan criterio 3 (forma + 401/200), spec §3.2/§3.3, tests §3.6.1–3.6.3 y §3.6.5.
- Ruta: solo `X-CI-Secret`, params ignorados sin 400, `private, no-store` en 200 y 401, R2-base ausente → 500 completo (todo o nada), `contentVersion` por foto del mismo request.
- Serializador: `findMany` con `where: { status: "PUBLISHED" }`, `orderBy: { id: "asc" }`, módulos `deletedAt: null / order asc`, lecciones `deletedAt: null / lessonNumber asc, id asc`; `content` incluido (D3); mapeo explícito sin spread (sin `stats`, sin `deletedAt`); words forma pública §2.3, `id asc`, sin paginación.
- Words embebidas de bloques (word/vocabulary) no se resuelven: coherente con spec §3.2 (la forma exacta no tiene campo para ellas) y con la lista cerrada de medios §3.4.3; documento corrupto → lección incluida con `content` crudo (E5, precedente on-demand).
- Evidencia: `src/app/api/sync/full/route.test.ts` (9 tests: 401 × 2 idénticos, forma 200, recorte por ausencia de strings + `where` aseverado, E2, E3, E4, E5, query ignorada).
- Gap: ver WARNING W-2 (sin fixture con curso ARCHIVED / módulo con `deletedAt` a nivel ruta; enforcement solo aseverado en el objeto `where`).

### T05 — W3c manifiesto por referencias ✅ (con WARNING W-3)
- Cierra coherencia plan criterio 3 + R3(b), spec §3.4/§3.5, tests §3.6.4/§3.6.6; mitiga R4/R6.
- `src/lib/sync/full-bundle.ts`: `collectMediaRefs` (words + coverImage R2 validada con `isAllowedCoverImageUrl` y prefijo de base + bloques image/audio/listening), `publicUrlToKey` (strip único de `r2PublicBase()`, corta query, valida clave segura), `refsToKeys` (deduplica; fallback `audioRefToKey` solo para audio; imagen fuera de base → excluida), `missingMediaKeys` (coherencia R3(b)).
- Alcance `text.html` fijado como NO-extracción con justificación del sanitizador (spec §3.4.4); `video.youtubeId` excluido; redirect legacy `/api/media/<id>` y cover externa excluidos (E8).
- Ruta consulta `db.mediaAsset.findMany({ where: { objectKey: { in: keys }, sha256: { not: null } } })` — nunca tabla completa; elemento `{ objectKey, url, sha256, size, mimeType }`.
- Evidencia: `src/lib/sync/full-bundle.test.ts` (12 tests: derivación, alcance del parser con fixture, E8, legacy audio, coherencia R3(b) con reporte de excluidos y verde en cero).
- Gap: ver WARNING W-3 (la cláusula `sha256 not null` + `in: keys` de la ruta no está fijada por ningún test).

### T06 — W4 docs y entorno ✅
- Cierra plan criterios 4–5, spec §4.1–§4.2, proposal §8.6–8.7.
- `.env.example`: bloque `CI_SYNC_SECRET` al final tras `ADMIN_*`, contenido literal según spec (generación, alcance, rotación); ninguna línea existente alterada.
- `DEPLOY.md` del change: 5 secciones (variables, rotación, verificación `curl` + `jq`, nota `Cache-Control`, condición Fase C para NOT NULL). Comandos reproducibles presentes.
- `docs/Guia_Arranque_Despliegue.md` no creado ni modificado (no existe; verificado en diff).
- `git status` / diff de rama: solo `src/app/api/sync/**`, `src/lib/ci-auth.*`, `src/lib/sync/full-bundle.*`, `.env.example`, `DEPLOY.md`, `openspec/` y 2 ajustes de tests fase-a documentados en §3. Sin diffs en app móvil, workflows ni Admin UI. (Ruido `.atl/` es tooling local, fuera del change.)

## 2. Verificación F1 / F2 / R3(b)

- **F1 (PUBLISHED-only para todos):** implementada en consulta en `sync`, `seed` y `full` (words y courses). Cero DRAFT/ARCHIVED por construcción. El post-filtro JS de estado para upserts se eliminó; la derivación ARCHIVED → `removedIds` queda como defensa (vacía por construcción). Cambio de conducta R5 documentado. ✅
- **F2 (bundle único sin paginación):** `GET /api/sync/full` responde `{ contentVersion, words[], courses[], media[] }` sin params ni paginación; params extra ignorados sin 400. ✅
- **R3(b) (filtrar `WHERE sha256 IS NOT NULL` + test de coherencia, sin migración NOT NULL):** filtro presente en la ruta; `missingMediaKeys` convierte exclusión silenciosa en señal visible; NOT NULL pospuesto con condición en DEPLOY §5. ✅

## 3. Casos borde E1–E8

| # | Estado |
|---|---|
| E1 secreto rotado | Lógica inherente (viejo → 401, nuevo → 200); **sin test explícito** (SUGGESTION S-1). |
| E2 bundle vacío | Testeado a nivel ruta (200 con arreglos vacíos). ✅ |
| E3 R2 caído | Testeado a nivel ruta (base ausente → 500 completo). ✅ |
| E4 curso sin módulos | Testeado (`modules: []`). ✅ |
| E5 content corrupto | Testeado (lección incluida con `content` crudo). ✅ |
| E6 secreto ausente | Testeado en lib + ruta (falla cerrado; públicas intactas). ✅ |
| E7 `text.html` con `<img>` | Fijado como exclusión documentada con fixture. ✅ |
| E8 cover legacy | Excluida del manifiesto con fixture; curso intacto. ✅ |

## 4. Regresiones fase-a

- **Suite `tests/fase-a/`:** intentada una vez (`npx vitest run tests/fase-a/`). Resultado: 10 archivos fallan en setup con `Can't reach database server at localhost:3307`; 1 archivo pasa (6 tests), 89 tests skipeados. **WARNING ambiental W-1:** sin daemon de contenedores en este entorno; la regresión de integración (tombstones keyset post-C2, bumps T10/T11, DEL-03, backfill) queda **no ejecutable aquí**, no como fallo del change.
- **Ajustes a tests fase-a en esta rama:** `fase-a.del.test.ts` y `fase-a.sync-aditivo.test.ts` invierten la expectativa R-ARCHIVED (`removedIds` toContain → notToContain, con comentario F1). Es la consecuencia correcta y documentada de F1 (la fila ARCHIVED ya no llega a `page` por el filtro en consulta), y la defensa queda cubierta a nivel unitario en `sync.test.ts`. Se marca como WARNING W-4 solo para que el revisor lo valide explícitamente: un test de regresión preexistente cambió de expectativa dentro del change.

## 5. Lista CRITICAL / WARNING / SUGGESTION

- **CRITICAL:** ninguno.
- **WARNING W-1 (ambiental):** suite fase-a no ejecutable sin BD (`Can't reach database server at localhost:3307`, observado). Re-ejecutar con contenedores antes del merge a `main`.
- **WARNING W-2 (cobertura):** spec §3.6.5 exige fixture con curso ARCHIVED y módulo con `deletedAt` ausentes del bundle; el test de ruta solo asevera el objeto `where`/`include` y la ausencia de strings, sin pasar esa fixture por el handler. Enforcement real delegado a la BD sin prueba.
- **WARNING W-3 (cobertura):** la cláusula `where: { objectKey: { in: keys }, sha256: { not: null } }` de `sync/full/route.ts` no está fijada por ningún test (el mock de `mediaAsset.findMany` responde `[]` sin aseverar argumentos). La coherencia está probada a nivel puro (`missingMediaKeys`) pero no el cableado ruta → query.
- **WARNING W-4 (revisión):** dos tests fase-a cambiaron expectativa R-ARCHIVED por F1 (justificado y comentado, pero requiere validación explícita del revisor).
- **SUGGESTION S-1:** agregar test E1 (secreto rotado: viejo → 401, nuevo → 200) y test de cableado para W-3 (aseverar argumentos de `mediaAsset.findMany`). Costo estimado < 30 min; no bloquean el contrato.
- **SUGGESTION S-2 (api-design-patterns):** el formato de error `{ message }` se conserva por compatibilidad aditiva (correcto: consistencia con el codebase existente prevalece sobre RFC7807 aquí). Sin acción.
- **SUGGESTION S-3 (TDD):** los tests nuevos mockean la capa `db` (estándar y pragmático sin BD); la cobertura de integración real corresponde a la suite fase-a (bloqueada por W-1). Sin acción salvo re-ejecutar con BD.

## 6. Veredicto: PARTIAL

- Todo lo verificable sin BD está en verde y conforme a spec (T01–T06, F1/F2/R3(b), E2–E8, gates técnicos).
- **No es PASS total** porque el criterio 4 del plan (suite fase-a en verde, regresión de integración) no pudo ejecutarse en este entorno (W-1) y existen dos gaps menores de cobertura a nivel ruta (W-2, W-3).
- **No es BLOCKED:** ningún defecto funcional detectado; los WARNINGs son cobertura/test, no comportamiento. Recomendación: resolver S-1 (cierra W-2/W-3), re-ejecutar fase-a con BD, luego merge.

## 7. Comandos corridos (foreground, resultado observado)

- `npx vitest run src/app/api/sync/version/route.test.ts src/app/api/sync/sync.test.ts src/lib/ci-auth.test.ts src/app/api/sync/full/route.test.ts src/lib/sync/full-bundle.test.ts` → `Test Files 5 passed (5), Tests 37 passed (37)`.
- `npx tsc --noEmit` → salida vacía, exit 0 (0 errores).
- `npx eslint src/app/api/sync/version/route.ts src/app/api/sync/route.ts src/app/api/sync/seed/route.ts src/app/api/sync/full/route.ts src/lib/ci-auth.ts src/lib/sync/full-bundle.ts` → salida vacía, exit 0.
- `npx vitest run tests/fase-a/` (un intento) → 10 archivos fallan en setup: `Can't reach database server at localhost:3307`; `Test Files 10 failed | 1 passed (11)`; `Tests 5 failed | 6 passed | 89 skipped (100)` — todos los fallos por conexión, evidencia ambiental.
