# Proposal: apk-offline-fase-b-endpoints — Etapa 2: sync público + endpoint CI

- **Change ID:** `apk-offline-fase-b-endpoints`
- **Branch:** `feat/fase-b-endpoints`
- **Repo scope:** solo web (`Diccionario-endpoints`). App móvil intacta. Workflows de GitHub Actions intactos (Fase C los consume). Admin UI sin cambios visuales.
- **Estado:** propuesta (sin spec/tasks todavía — siguiente paso recomendado: `spec`)
- **artifact_store.mode:** hybrid (file-based en `openspec/`; engram pendiente)
- **delivery_strategy:** auto-chain (W1 → W2 → W3 → W4; cada work unit con gate TDD antes de avanzar)

## 1. Problema

La APK offline requiere sincronizar contenido sin obligar al usuario a autenticarse, y el pipeline de CI requiere descargar una semilla completa con una credencial de máquina. El estado actual no permite ninguno de los dos casos:

1. **Sync tras autenticación.** `GET /api/sync` y `GET /api/sync/seed` exigen `requireAuth()` (sync:45-46, seed:11-12). La aplicación móvil realiza un login headless con csrf + credentials (api.ts:43-90) únicamente para habilitar estas lecturas. Los cursos PUBLISHED ya son públicos sin autenticación (courses:20-25, detalle, manifest:85-87, lección on-demand); el sync de palabras es la única pieza de contenido de aprendizaje que permanece tras autenticación. Esta asimetría carece de justificación: el contenido de aprendizaje no es sensible.
2. **Sin señal ligera de versión.** No existe `GET /api/sync/version`. La aplicación no puede responder "¿estoy atrasada?" sin descargar datos, y el workflow de Fase C no puede implementar SKIP-BUILD ("¿hubo cambios desde la última APK?"). `getContentVersion()` existe como lectura fresca sin caché, pero no se encuentra expuesto por HTTP.
3. **Sin endpoint de semilla completa para CI.** No existe `GET /api/sync/full`. No existe patrón de API-key en `src` (cero ocurrencias de `timingSafeEqual`, `X-`, `CI_SYNC`). No existe endpoint de manifiesto de medios, aunque `MediaAsset` ya dispone de `sha256` + `updatedAt` (Fase A) y el backfill (`lib/media/backfill-sha256.ts`) ya cubre el histórico.
4. **Filtro de estado inconsistente.** El sync no filtra `status` en la consulta: aplica post-filtro JS ARCHIVED → `removedIds` (sync:122-130). El seed sí filtra PUBLISHED en base de datos (seed:23). Al abrir el sync al público, el filtro debe ubicarse en la consulta (W2), no en memoria.
5. **Serialización del árbol de cursos dispersa.** El detalle `[id]` incluye el árbol completo (incluye `content`; la rama `stats` es solo editor+ y el bundle debe excluirla); el manifest recorta `content`; la lección on-demand incluye words PUBLISHED-only. El bundle CI debe reutilizar esta serialización pública sin arrastrar campos de editor.

Sin esta Etapa 2, la Fase B-app no puede eliminar el login obligatorio y la Fase C no puede construir APK con semilla verificable.

## 2. Objetivo medible

Al cerrar el change, el backend permite (a) sincronización de lectura sin sesión y (b) descarga de semilla completa por CI con clave secreta, verificable con tests:

- `GET /api/sync/version` sin sesión responde 200 `{ contentVersion: N }` con encabezado `Cache-Control`.
- `GET /api/sync?since=...` y `GET /api/sync/seed` sin sesión responden 200, con `contentVersion` presente, cero filas DRAFT/ARCHIVED en `upserts`, y ARCHIVED + tombstones preservados en `removedIds`.
- `GET /api/sync/full` sin encabezado responde 401; con secreto inválido responde 401; con secreto válido responde 200 con bundle `{ contentVersion, words[], courses[], media[] }` donde cada word/course es PUBLISHED, cada `media[].sha256` es no nulo, y cada `objectKey` se encuentra referenciado por el bundle (cero huérfanos).
- Ningún campo preexistente de sync/seed/courses cambia de forma (compatibilidad aditiva).
- Criterio numérico: el bundle CI contiene el 100 % de words PUBLISHED y el 100 % de courses PUBLISHED con sus módulos y lecciones no eliminadas; el manifiesto cubre el 100 % de las referencias de medios del bundle con `sha256` presente.

## 3. Alcance / No-alcance

### En alcance (solo web)

- Nueva ruta `GET /api/sync/version` (W1): pública, diminuta, con caché.
- Apertura pública de `GET /api/sync` y `GET /api/sync/seed` (W2): eliminación de `requireAuth`, filtro PUBLISHED-only en consulta, `Cache-Control`.
- Nueva ruta `GET /api/sync/full` protegida con clave CI (W3): autenticación `X-CI-Secret` en tiempo constante, serializador de course tree reutilizando el detalle público (sin rama `stats`), constructor de manifiesto por referencias.
- Biblioteca `lib/ci-auth.ts` y documentador de alcance del parser de referencias de medios (W3).
- Documentación y entorno (W4): `CI_SYNC_SECRET` en `.env.example`, `DEPLOY.md` del change (el despliegue reside allí; `docs/Guia_Arranque_Despliegue.md` no existe), historial en `openspec/changes/apk-offline-fase-b-endpoints/`.
- Tests TDD por cada work unit + regresión de Fase A.

### Fuera de alcance (explícito)

- App móvil: intacta. Ningún cambio en `api.ts`, lógica de sync/descarga, ni reconciliación por `sha256` (pertenece a Fase B-app). Las escrituras (favoritas, historial, progreso) continúan con autenticación; `apiFetch` ya acepta sesión nula para lecturas, por lo que el cambio es compatible.
- Workflows de GitHub Actions: intactos. El bundle full es solo para CI (R5); la aplicación no lo consume. Fase C lo consumirá con SKIP-BUILD.
- Admin UI, PWA, paginación del bundle, limpieza física de R2 huérfano, purga de ARCHIVED antiguos: no incluidos.
- Centralización del helper local `isEditor()` (triplicado en 3 archivos de courses): oportunidad registrada, se evalúa en W3 solo si no altera comportamiento; en caso contrario queda como deuda documentada.

## 4. Decisiones cerradas (F1/F2 — no reabrir)

Resueltas por el usuario el 2026-11-07. Se documentan con tradeoffs para trazabilidad; la spec no debe replantearlas.

### F1 — DRAFT en sync público: PUBLISHED-only para todos

**Decisión:** al abrir `sync` y `seed` al público, ambos exponen exclusivamente PUBLISHED. El sync se alinea con el seed (que ya era PUBLISHED-only). Los borradores nunca llegan a ninguna aplicación.

**Tradeoffs considerados:**

| Alternativa | Por qué se descarta |
|---|---|
| Exponer DRAFT en sync público con marca | Filtra contenido no publicado a clientes anónimos; contradice el precedente de courses (DRAFT/ARCHIVED solo editor+); duplica comportamientos y tests. |
| Mantener DRAFT solo con sesión y PUBLISHED sin sesión (doble modo) | Dos contratos en una ruta; la aplicación actual recibe DRAFT hoy y PUBLISHED mañana sin cambio de código (comportamiento fantasma); complejidad de caché por estado de sesión. |
| PUBLISHED-only (elegida) | Un solo comportamiento, menos tests, coherente con courses y seed. Costo: cambio de conducta para la aplicación actual (DRAFT deja de llegar), documentado como R5 y mitigado porque el seed ya era PUBLISHED-only. |

**Consecuencia de diseño:** el filtro `status: "PUBLISHED"` debe ubicarse en la consulta de base de datos (índice existente), no en post-filtro JS. El post-filtro ARCHIVED → `removedIds` se conserva para borrados.

### F2 — Forma de `/api/sync/full`: bundle único JSON sin paginación

**Decisión:** un solo objeto JSON `{ contentVersion, words[], courses[], media[] }` sin paginación.

**Tradeoffs considerados:**

| Alternativa | Por qué se descarta |
|---|---|
| Paginado por cursor/keyset | Correcto para N consumidores o datasets grandes; aquí existe un solo consumidor (GitHub Actions) y el volumen (~371 words + cursos + medios) es pequeño. La paginación complica el workflow de Fase C sin beneficio medible. |
| Múltiples endpoints CI (words-full, courses-full, media-manifest) | Tres autenticaciones y tres versiones que pueden divergir entre llamadas; el bundle único garantiza foto atómica por `contentVersion`. |
| Bundle único (elegido) | Workflow simple, coherencia atómica, payload manejable. Costo: si el catálogo crece un orden de magnitud, se requerirá paginación futura; la spec debe dejar el formato extensible (`contentVersion` de foto). |

## 5. Diseño a alto nivel

### W1 — `GET /api/sync/version` (D2 del plan)

- Ruta nueva, sin autenticación, sin parámetros, sin paginación.
- Respuesta: `{ contentVersion: N }` mediante `getContentVersion()` (lectura fresca; no se agrega caché en memoria en esta fase).
- Encabezado: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Precedente nuevo: ninguna ruta emite `Cache-Control` hoy; W1/W2 sientan el precedente con este valor (mitiga carga en Hostinger según plan maestro).
- Patrones aplicados (`api-design-patterns`): recurso de lectura con caché HTTP nativa (REST); códigos estándar (200 + 500 mínimo, sin filtrar detalles); sin versionado URI (endpoint aditivo, no ruptura).
- TDD: test de 200 sin sesión + forma exacta + encabezado presente; test de avance de versión (bump → N+1 visible).

### W2 — Sync público con caché (D1 + F1)

- Quitar `requireAuth()` de `/api/sync` y `/api/sync/seed`. Las escrituras no se tocan.
- Filtro `status: "PUBLISHED"` en la consulta (Prisma `where`), en ambas rutas. Elimina el post-filtro JS de estado para upserts; conserva la derivación ARCHIVED + tombstones → `removedIds` (regresión cubierta por test).
- Encabezado `Cache-Control` idéntico a W1 en ambas rutas.
- Centralizar o no `isEditor()`: el flag `showAll` de editor se mantiene; si la centralización en un helper compartido no cambia comportamiento, se realiza en W2/W3; en caso contrario se documenta y se omite.
- Patrones aplicados: seguridad por defecto invertida con justificación (contenido de aprendizaje público, precedente courses); consistencia de errores (401 desaparece de estas rutas; 400/500 conservan formato existente); caché como control de carga (mitigación R2).
- TDD: acceso sin sesión 200; cero filas DRAFT en upserts (fixture con PUBLISHED + DRAFT + ARCHIVED); ARCHIVED en `removedIds`; `contentVersion` presente; encabezado de caché; suite Fase A en verde (sin regresión en tombstones keyset post-C2 ni bumps T10/T11).

### W3 — `GET /api/sync/full` + manifiesto por referencias (D3 + D4 del plan)

**Autenticación CI (`lib/ci-auth.ts` nueva):**

- Encabezado `X-CI-Secret: <CI_SYNC_SECRET>` (variable nueva, documentada en `.env.example`; generación con `openssl rand -base64 32`; configuración en Hostinger y como secret de Actions en Fase C).
- Comparación en tiempo constante con `crypto.timingSafeEqual` (con resguardo de longitud para evitar excepción por longitudes distintas). Sin secreto o incorrecto → `401` genérico, sin indicar cuál condición falló. Nunca en query string (no aparece en access logs de URL).
- Rate-limit defensivo: reutilizar el patrón `lib/rate-limit.ts` (`checkRateLimit`/`getClientIp`, ya usado en search-history/suggest/register/recover) solo si aplica a GET sin degradar al consumidor único; en caso contrario, documentar la omisión con justificación (CIs con IP compartida + caché ausente en ruta autenticada).
- Sin `Cache-Control` público (respuesta autenticada; `private, no-store` o ausencia explícita).

**Serializador del árbol de cursos:**

- Reutilizar la serialización del detalle público `[id]` con include completo (módulos + lecciones + bloques con `content`), con dos recortes obligatorios: excluir rama `stats` (solo editor+) y excluir `deletedAt != null` / ARCHIVED en cada nivel.
- Exclusión de `content` no aplica: el bundle CI incluye contenido de bloques (decisión D3); el manifest público que recorta `content` no se reutiliza para el cuerpo, solo como referencia de campos.
- Lección on-demand como referencia de filtrado de words: solo words PUBLISHED-only dentro del árbol.

**Constructor de manifiesto por referencias (D4):**

- Fuente de referencias (solo contenido PUBLISHED del bundle):
  - `words.audioUrl`, `words.illustrationUrl`.
  - `course.coverImage` (respetar `isAllowedCoverImageUrl`; solo URLs R2 entran al manifiesto).
  - Bloques de lección: `image.url` + `audio/listening.media.url` según `blocks.ts:69-107`.
  - Video es `youtubeId` (no R2): excluido por diseño.
  - `text.html` con `<img>` embebida: alcance del parser a fijar en spec (opción base: extraer `src` absolutos R2 mediante el sanitizador existente `text-sanitizer.ts`; si el parser resulta frágil, la spec debe recortarlo y documentar la laguna en lugar de implementar extracción por expresión regular improvisada).
- Sin equivalente a `audioRefToKey` para imágenes: derivar clave por eliminación de `R2_PUBLIC_BASE_URL`. La spec debe definir la función de derivación en un solo módulo compartido (no duplicar lógica de strip en cada extractor).
- Consulta: `MediaAsset` donde `objectKey` ∈ conjunto de referencias (no tabla completa: evita embarcar huérfanos subidos y no usados).
- Elemento: `{ objectKey, url, sha256, size, mimeType }` con `url` pública R2.
- Patrones aplicados: derivación por referencias (anti-huérfanos R4); error mínimo (401 genérico); clave con prefijo de entorno y rotación documentada (rotar = cambiar env + secret de Actions, sin downtime de lecturas públicas).
- TDD: 401 sin secreto; 401 con secreto inválido (tiempo constante, sin oracle); 200 con secreto válido y forma `{ contentVersion, words[], courses[], media[] }`; coherencia (todo PUBLISHED, `sha256` no nulo, cero huérfanos); prueba de alcance del parser HTML con fixture (img R2 incluida, youtube excluido, externa no-R2 excluida según `isAllowedCoverImageUrl`).

### W4 — Documentación y entorno (D5 del plan)

- `.env.example`: agregar `CI_SYNC_SECRET` con comentario de generación y nota "requerido solo para `/api/sync/full` y Fase C; las rutas públicas no lo necesitan".
- `DEPLOY.md` del change (en `openspec/changes/apk-offline-fase-b-endpoints/`): agregar secreto en Hostinger, rotación, verificación manual (`curl` sin secreto → 401; con secreto → 200 + `jq` de conteos), y nota de `Cache-Control` (verificación de encabezado tras despliegue).
- Historial SDD en `openspec/changes/apk-offline-fase-b-endpoints/` (proposal/spec/tasks según flujo, misma convención que Fase A).
- Sin `docs/Guia_Arranque_Despliegue.md` (no existe; solo 5 md en docs): no crear ni modificar guía inexistente.

### Fork nuevo R3 — `MediaAsset.sha256` nullable + comentario "NOT NULL en Fase B"

**Contexto:** la columna se creó nullable en Fase A con comentario de intención NOT NULL en Fase B. El criterio de aceptación del plan exige `media[].sha256` no nulo en el bundle. Dos caminos:

- **(a) Migrar a NOT NULL ahora.** Limpio a largo plazo: el esquema garantiza la invariante y el bundle no necesita filtro defensivo. Costo: exige backfill completo verificado en producción antes de la migración; cualquier fila sin hash (objeto faltante en R2, audio legacy fuera de inventario, subida concurrente entre backfill y migración) bloquea la migración o fuerza valores ficticios. En hosting compartido sin ventana de mantenimiento garantizada, el riesgo de bloqueo de despliegue es real.
- **(b) Filtrar `WHERE sha256 IS NOT NULL` en el bundle + test de coherencia.** Sin riesgo de migración: el bundle mantiene la invariante por consulta, y un test de coherencia (cero referencias PUBLISHED sin fila con hash) convierte la exclusión silenciosa en señal visible en CI. Costo: medios sin hash quedan fuera del manifiesto; si el test de coherencia no se ejecuta o se ignora, la laguna persiste sin bloquear.

**Recomendación: opción (b).** Justificación: el backfill existe pero su cobertura total en producción no se encuentra verificada en este change; convertir una deuda de datos en restricción de esquema durante el mismo despliegue que abre rutas públicas y agrega autenticación CI concentra tres riesgos en una migración. La opción (b) preserva la invariante observable del contrato (el test falla si alguna referencia PUBLISHED carece de hash, por lo que nada queda "silencioso" en la práctica de CI) sin convertir filas legacy en error de despliegue. El NOT NULL se pospone a Fase C con condición explícita: backfill verificado en producción + conteo de excluidos en cero durante un período de observación, documentado en el DEPLOY del change.

## 6. Riesgos (R1–R6)

| # | Riesgo | Impacto | Mitigación en este change |
|---|---|---|---|
| R1 | **Exposición de DRAFT por error en ruta pública.** El sync hoy devuelve PUBLISHED + DRAFT con post-filtro; al quitar auth un filtro olvidado filtra contenido no publicado. | Filtración de borradores a clientes anónimos. | Filtro `status: "PUBLISHED"` en consulta (no post-filtro); test explícito de no-exposición con fixture mixta; revisión de diff sync/seed en spec. |
| R2 | **Carga en Hostinger por GET públicos sin límite.** Los GET públicos no tienen rate-limit; el proxy solo limita POST de login. | Abuso o picos degradan el hosting compartido. | `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` desde W1/W2 (sienta precedente; hoy ninguna ruta lo emite); monitoreo; rate-limit defensivo evaluado en W3. |
| R3 | **Secreto CI filtrado en logs.** `CI_SYNC_SECRET` en workflow, shell history o error responses. | Compromiso de la semilla completa. | Secreto solo por encabezado (nunca query string); 401 genérico; documentación de generación (`openssl rand -base64 32`), almacenamiento (env Hostinger + secret Actions) y rotación; ningún log del valor. |
| R4 | **Manifiesto con huérfanos o con faltantes por alcance de parser.** Tabla completa embarca no usados; parser `text.html` frágil omite embebidos; derivación de clave de imagen inconsistente. | Bundle inflado o manifiesto incompleto (medios rotos en APK). | Derivación por referencias (D4), no por tabla completa; alcance del parser fijado en spec con fixture; derivación de clave en módulo único vía strip de `R2_PUBLIC_BASE_URL`; video `youtubeId` excluido por diseño. |
| R5 | **Cambio de conducta para la aplicación actual.** Con F1, DRAFT deja de llegar al sync; la aplicación aún necesita login headless para escrituras. | Regresión percibida ("faltan palabras") o login eliminado por error. | Documentar el cambio en el change; lecturas sin sesión + escrituras con sesión coexisten (`apiFetch` acepta nulo); ninguna modificación en la aplicación en este change. |
| R6 | **Filas `MediaAsset` con `sha256` NULL.** Objetos legacy sin backfill, objetos faltantes en R2, o condiciones de carrera. | Bundle con hash nulo (reconciliación imposible) o migración NOT NULL bloqueada. | Opción R3(b): filtro `WHERE sha256 IS NOT NULL` + test de coherencia que falla si alguna referencia PUBLISHED carece de hash; reporte de excluidos; NOT NULL pospuesto con condición explícita. |

## 7. Plan por fases (W1 → W4, ~8h, TDD obligatorio)

> Cada work unit sigue RED → GREEN → refactor. Sin test failing previo no hay código de producción. Orden secuencial: W1 desbloquea el patrón de caché; W2 depende de F1; W3 depende de F2 (solo forma) y reutiliza W1/W2; W4 cierra.

1. **W1 — `GET /api/sync/version` (~1h).** Test RED (200 sin sesión, forma `{ contentVersion }`, encabezado caché) → ruta mínima con `getContentVersion()` → refactor. Gate: `curl` sin sesión + suite Fase A verde.
2. **W2 — Sync público (~2h).** Tests RED (sin sesión 200; DRAFT ausente; `removedIds`/`contentVersion` intactos; encabezado caché) → quitar `requireAuth`, mover filtro a consulta, agregar encabezados → refactor (evaluar centralización `isEditor()`). Gate: matriz PUBLISHED/DRAFT/ARCHIVED + regresión tombstones keyset.
3. **W3 — `GET /api/sync/full` + manifiesto (~4h, bloque mayor).** Suborden: (i) `lib/ci-auth.ts` + tests 401/200; (ii) serializador course tree + tests de recorte (`stats` excluido, `deletedAt` excluido, PUBLISHED-only); (iii) extractor de referencias + builder de manifiesto + tests de coherencia y alcance de parser. Gate: bundle atómico con `contentVersion` de foto + cero huérfanos.
4. **W4 — Documentación y entorno (~1h).** `.env.example` + `DEPLOY.md` del change + historial openspec. Gate: revisión de docs (secreto documentado, rotación descrita, verificación manual reproducible).

**Esfuerzo total estimado: ~8h** (W1 ~1h + W2 ~2h + W3 ~4h + W4 ~1h). Presupuesto de líneas: ~350-550 (W1 ~40; W2 ~120 + tests; W3 ~250 + tests; W4 docs). Supone vitest y R2 accesibles; sin cambios en móvil ni workflows.

## 8. Criterios de aceptación (verificables)

- [ ] `GET /api/sync/version` sin sesión → 200 `{ contentVersion }` con `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
- [ ] `GET /api/sync?since=...` y `GET /api/sync/seed` sin sesión → 200; con fixture mixta: cero filas DRAFT o ARCHIVED en upserts; ARCHIVED + tombstones preservados en `removedIds`; `contentVersion` presente; encabezado de caché presente.
- [ ] `GET /api/sync/full` sin encabezado → 401; con secreto inválido → 401 (mensaje genérico); con secreto válido → 200 con `{ contentVersion, words[], courses[], media[] }` donde cada word/course es PUBLISHED, cada `media[].sha256` es no nulo, y cada `objectKey` está referenciado por el bundle (test de cero huérfanos).
- [ ] Coherencia R3(b): test que falla si alguna referencia PUBLISHED carece de fila `MediaAsset` con `sha256`; lista de excluidos reportada (cero en verde).
- [ ] `npx tsc --noEmit` → 0 errores; `npx vitest run tests/` (grupo nuevo + Fase A sin regresión) → verde; eslint en rutas tocadas → 0.
- [ ] `.env.example` documenta `CI_SYNC_SECRET`; `DEPLOY.md` del change actualizado (configuración, rotación, verificación manual).
- [ ] App móvil y workflows sin diffs (`git status` limpio fuera de `src/app/api/sync/**`, `src/lib/ci-auth.*`, manifiesto, env ejemplo, docs del change y openspec).

## 9. Trazabilidad de skills

- `api-design-patterns` (inyectada, `/home/mario/.agents/skills/api-design-patterns/SKILL.md`): caché HTTP nativa para lecturas públicas, clave de servicio por encabezado con comparación en tiempo constante y error genérico, contrato aditivo sin ruptura, derivación de manifiesto por referencias. Aplicada en §5 (W1/W2/W3) y R2/R3/R4.
- `test-driven-development-tdd` (inyectada, `/home/mario/.pi/agent/skills/test-driven-development-tdd/SKILL.md`): ciclo RED → GREEN → refactor por cada ruta, filtro, autenticador, serializador y extractor; verificación RED antes de implementar; criterio "sin test failing previo no hay código". Aplicada en §7 y §8.
- Evidencia base: explore previo (auth en sync/seed, post-filtro vs. filtro DB, cursos públicos con `isEditor()` triplicado, ausencia de `/api/sync/version`, `/api/sync/full` y patrón API-key, login headless móvil, `MediaAsset` con `sha256` + backfill, serialización course tree, referencias de medios y `blocks.ts:69-107`, precedente `lib/rate-limit.ts`, ausencia de `Cache-Control`, `getContentVersion()` sin caché) + plan maestro `/home/mario/.opencode/plan/etapa2-endpoints.md` (D1–D5, F1/F2 cerradas, W1–W4, §6) + verificación puntual de `openspec/changes/apk-offline-seed-fase-a/proposal.md` como convención de formato en esta sesión; no se re-mapeó el repositorio de cero.

## 10. Pendientes para `spec.md` (next_recommended)

1. Generar `openspec/changes/apk-offline-fase-b-endpoints/spec.md`: firma ruta por ruta (método, path, archivo handler), ubicación exacta de la eliminación de `requireAuth`, del filtro en consulta y del encabezado de caché.
2. Especificar `lib/ci-auth.ts` (comparación, resguardo de longitud, formato de 401) y decisión de rate-limit en W3 (aplicar patrón `lib/rate-limit.ts` u omitir con justificación).
3. Fijar el alcance del parser `text.html` (usar `text-sanitizer.ts` vs. recorte documentado) y la función única de derivación de clave de imagen por strip de `R2_PUBLIC_BASE_URL`.
4. Definir `tasks.md` con los tests TDD por work unit en el orden del plan §7 y registrar R3(b) + F1/F2 en engram cuando el runtime lo exponga.
