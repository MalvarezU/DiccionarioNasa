# Tasks: apk-offline-fase-b-endpoints — Etapa 2: sync público + endpoint CI

- **Change ID:** `apk-offline-fase-b-endpoints`
- **Branch:** `feat/fase-b-endpoints`
- **Fuente:** `proposal.md` (F1/F2/R3(b) cerradas) + `spec.md` (§1–§4, §6) + plan `etapa2-endpoints.md` (criterios 1–5, budget 800).
- **Método:** TDD estricto por tarea (RED → verificar RED → GREEN mínimo → verificar GREEN → refactor). Sin test en rojo observado no existe código de producción.
- **Orden:** secuencial T01 → T02 → T03 → T04 → T05 → T06. Cada tarea indica su gate de salida; la siguiente no inicia con el gate anterior en rojo.

```
T01 (W1 version) → T02 (W2 sync público) → T03 (W3a ci-auth) → T04 (W3b full+tree) → T05 (W3c manifiesto) → T06 (W4 docs/env)
        gate: §1.5              gate: §2.6              gate: §3.1               gate: §3.6.3/5              gate: §3.6.4/6         gate: revisión docs
```

---

## T01 — W1: `GET /api/sync/version` (ruta + tests)

- **Criterios que cierra:** plan criterio 1; spec §1.5 (tests 1–2); proposal §8 punto 1.
- **Archivos a tocar:**
  - Crear: `src/app/api/sync/version/route.ts` (handler `GET`, spec §1.1–§1.4).
  - Crear: test nuevo (convención existente: `src/app/api/sync/sync.test.ts`; ubicar junto a la ruta o en `tests/`, según convención que fije el primer test; no modificar tests de Fase A).
- **Test RED → GREEN:**
  - RED 1: `GET /api/sync/version` sin sesión → 200, forma exacta `{ contentVersion: number }`, encabezado `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (spec §1.2–§1.3). Verificar que falla (ruta no existe → 404, no 200).
  - RED 2: tras mutación con bump (`bumpContentVersion` en transacción), segunda lectura devuelve `N+1` (spec §1.5.2). Verificar que falla antes de cablear `getContentVersion()`.
  - GREEN: handler mínimo con `getContentVersion()`, sin auth, sin params, `Cache-Control` solo en 200; 500 conserva `{ message: "Error interno del servidor" }` sin el encabezado.
- **Dependencia:** ninguna (primera del chain). Desbloquea el precedente de `Cache-Control` que reutilizan T02/T04.
- **Gate de salida:** tests §1.5 en verde + suite Fase A en verde (`tests/fase-a/`).

## T02 — W2: sync público con caché (quitar auth, filtro en consulta, `Cache-Control`)

- **Criterios que cierra:** plan criterio 2; spec §2.6 (tests 1–6); proposal §8 punto 2. Sin regresión en tombstones keyset post-C2 ni bumps T10/T11.
- **Archivos a tocar:**
  - Modificar: `src/app/api/sync/route.ts` (eliminar import `requireAuth` línea 3 y guard líneas 45–46; `where` pasa a `AND: [{ status: "PUBLISHED" }, updatedFilter]` líneas 75–79; reemplazo del post-filtro líneas 122–130 conservando derivación `removedIds`; `Cache-Control` en cada `return` de éxito — spec §2.1–§2.4).
  - Modificar: `src/app/api/sync/seed/route.ts` (eliminar import línea 3 y guard líneas 11–12; agregar `Cache-Control`; `where` línea 23 verificado sin cambios — spec §2.1–§2.4).
  - Crear/extender: tests W2 con fixture mixta (≥1 PUBLISHED + 1 DRAFT + 1 ARCHIVED + 1 tombstone por `AuditLog` DELETE).
  - No tocar: `src/app/api/courses/**` (`isEditor()` triplicado queda intacto, spec §2.5); ninguna ruta de escritura.
- **Test RED → GREEN:**
  - RED 1/2: `GET /api/sync` y `GET /api/sync/seed` sin sesión → 200 + `Cache-Control` exacto (antes 401). Verificar el 401 actual antes del cambio.
  - RED 3: cero filas DRAFT o ARCHIVED en `upserts` de ambas rutas con fixture mixta (regresión F1/R1).
  - RED 4: ARCHIVED + tombstones preservados en `removedIds` de `sync`.
  - RED 5/6: `contentVersion` presente en ambas respuestas; suite Fase A en verde.
  - GREEN: quitar guards, filtro en consulta, encabezados; dedentado mecánico sin cambios de lógica de ventana/paginación keyset (`since`/`cursor`, `limit`, `encodeCursor`/`decodeCursor` intactos).
- **Dependencia:** T01 (reutiliza el valor exacto de `Cache-Control` y el patrón de ruta pública). Gate T01 en verde.
- **Gate de salida:** tests §2.6 (6) en verde + Fase A sin regresión.

## T03 — W3a: `src/lib/ci-auth.ts` + tests 401

- **Criterios que cierra:** base del plan criterio 3 (autenticación CI); spec §3.1 completo (semántica + tests); mitiga R3 (secreto solo por encabezado, 401 genérico, sin logs).
- **Archivos a tocar:**
  - Crear: `src/lib/ci-auth.ts` (`expectedCiSecret()`, `isValidCiSecret()`, `ciUnauthorized()` — spec §3.1).
  - Crear: test unitario puro de la lib (sin HTTP): sin encabezado → 401 genérico; secreto inválido → 401 idéntico (mismo estado y cuerpo, sin oráculo); secreto válido → pasa; longitudes distintas no lanzan; `CI_SYNC_SECRET` ausente → todo 401 (falla cerrado).
- **Test RED → GREEN:**
  - RED: cada caso del párrafo anterior falla antes de existir la lib (import inexistente). Verificar mensaje de fallo esperado por caso, en especial que longitudes distintas hoy lanzarían con `timingSafeEqual` directo.
  - GREEN: implementación mínima con `timingSafeEqual` + resguardo de longitud, fuente `process.env.CI_SYNC_SECRET`, 401 `{ message: "No autorizado" }` con `Cache-Control: private, no-store`. Sin `checkRateLimit`/`getClientIp` (omisión justificada en spec §3.1). Sin log de valores.
- **Dependencia:** T02 (las rutas públicas ya están abiertas; esta lib es el prerrequisito de autenticación de T04). Gates T01–T02 en verde.
- **Gate de salida:** los 5 casos §3.1 en verde.

## T04 — W3b: `GET /api/sync/full` + serializador del árbol de cursos (excluye `stats`)

- **Criterios que cierra:** plan criterio 3 (forma del bundle + 401/200); spec §3.2, §3.3 y tests §3.6.1–3.6.3, §3.6.5 (recorte).
- **Archivos a tocar:**
  - Crear: `src/app/api/sync/full/route.ts` (contrato exacto §3.2: request solo con `X-CI-Secret`, response 200 `{ contentVersion, words[], courses[], media[] }`, errores 401/500, todo-o-nada ante R2 caído).
  - Serializador: include generalizado de `courses/[id]/route.ts:26-41` a `findMany` (§3.3) con `where: { status: "PUBLISHED" }`, `orderBy: { id: "asc" }`, `modules where deletedAt null order asc`, `lessons where deletedAt null order lessonNumber asc, id asc`; `content` de bloques incluido (D3); words embebidas PUBLISHED-only; documento corrupto → cero palabras, lección incluida.
  - `words[]`: forma pública §2.3, `status` siempre `"PUBLISHED"`, orden `id asc`, sin paginación.
  - Crear/extender: tests de ruta (§3.6.1–3.6.3) + test de recorte (§3.6.5: sin clave `stats` en ningún nivel, sin `deletedAt`, fixture con curso ARCHIVED y módulo con `deletedAt` ausentes).
- **Test RED → GREEN:**
  - RED 1: sin encabezado → 401 cuerpo exacto (falla: ruta no existe).
  - RED 2: secreto inválido → 401 idéntico al anterior.
  - RED 3: secreto válido → 200 con forma `{ contentVersion, words[], courses[], media[] }` (puede apoyarse en `media[]` mínimo hasta T05; el test de coherencia total cierra en T05).
  - RED 5 (recorte): `stats` presente / `deletedAt` filtrado incorrectamente antes del serializador.
  - GREEN: ruta mínima que usa `isValidCiSecret()` (T03) + queries §3.2–§3.3; `contentVersion` por foto del mismo request; `Cache-Control: private, no-store` en 200 y 401; R2 caído → 500 completo, nunca parcial.
- **Dependencia:** T03 (autenticación). Reutiliza forma pública §2.3 de T02. Gates T01–T03 en verde.
- **Gate de salida:** tests §3.6.1–3.6.3 y §3.6.5 en verde.

## T05 — W3c: manifiesto por referencias + test de coherencia `sha256`

- **Criterios que cierra:** plan criterio 3 (coherencia: `sha256` no nulo, cero huérfanos) + coherencia R3(b); spec §3.4, §3.5 y tests §3.6.4, §3.6.6; mitiga R4 y R6. Casos borde E2–E8 aplicables.
- **Archivos a tocar:**
  - Crear: `src/lib/sync/full-bundle.ts` (`collectMediaRefs()`, `publicUrlToKey()`, `refsToKeys()` — spec §3.4).
  - Modificar: `src/app/api/sync/full/route.ts` (consulta `db.mediaAsset.findMany({ where: { objectKey: { in: keys }, sha256: { not: null } } })`, elemento `{ objectKey, url: publicUrl(objectKey), sha256, size, mimeType }`).
  - Crear/extender: tests §3.6.4 (coherencia) y §3.6.6 (alcance del parser con fixture).
- **Test RED → GREEN:**
  - RED coherencia: con fixture donde una URL referenciada carece de `MediaAsset` o lo tiene con `sha256: null`, el test que compara `refsToKeys(bundle)` contra `media[].objectKey` falla y reporta excluidos (spec §3.5). En verde, cero excluidos.
  - RED alcance (§3.6.6): bloque `image` R2 incluido; `video.youtubeId` excluido; `coverImage` externa no-R2 excluida; `text.html` con `<img>` no aporta refs (exclusión documentada §3.4.4, sin extracción por expresión regular).
  - RED huérfanos: `media[].objectKey ⊆ refsToKeys(bundle)` con tabla con filas no referenciadas → el query por `in: keys` las excluye.
  - GREEN: extractor con fuentes cerradas §3.4.1–3.4.6 (strip único vía `r2PublicBase()` de `media/storage.ts`; legacy Supabase solo audio vía `audioRefToKey`; `coverImage` validada con `isAllowedCoverImageUrl`; redirect legacy `/api/media/<id>` excluido). Casos borde: bundle vacío → 200 con arreglos vacíos (E2); R2 caído → 500 (E3); curso sin módulos → `modules: []` (E4); `content` corrupto → lección incluida, palabras `[]` (E5); secreto ausente → 401 sin afectar públicas (E6); portada legacy excluida del manifiesto (E8).
- **Dependencia:** T04 (ruta y serializador). Gates T01–T04 en verde.
- **Gate de salida:** tests §3.6.4 y §3.6.6 en verde + bundle atómico con `contentVersion` de foto y cero huérfanos.

## T06 — W4: documentación y entorno (`.env.example` + `DEPLOY.md` del change)

- **Criterios que cierra:** plan criterios 4 (gates técnicos) y 5 (env + docs); spec §4.1–§4.2; proposal §8 puntos 6–7.
- **Archivos a tocar:**
  - Modificar: `.env.example` (bloque `CI_SYNC_SECRET` al final, tras `ADMIN_*`, contenido literal spec §4.1; ninguna línea existente alterada).
  - Crear: `openspec/changes/apk-offline-fase-b-endpoints/DEPLOY.md` (estructura §4.2: variables, rotación, verificación manual con `curl` + `jq`, nota `Cache-Control`, condición Fase C para NOT NULL).
  - No crear ni modificar `docs/Guia_Arranque_Despliegue.md` (no existe en el repositorio).
- **Test RED → GREEN:** no aplica código (tarea de docs). Verificación: revisión de docs — secreto con generación (`openssl rand -base64 32`), alcance ("solo `/api/sync/full` y Fase C"), rotación sin downtime, comandos de verificación reproducibles; `git status` limpio fuera de `src/app/api/sync/**`, `src/lib/ci-auth.*`, `src/lib/sync/full-bundle.*`, `.env.example`, docs del change y `openspec/`.
- **Dependencia:** T05 (documenta el comportamiento realmente implementado, incluidos alcance del parser y condición R3(b)). Gates T01–T05 en verde.
- **Gate de salida:** revisión de docs superada + gates técnicos: `npx tsc --noEmit` → 0 errores; `npx vitest run` (grupo nuevo + Fase A) → verde; eslint en rutas tocadas → 0.

---

## Review Workload Forecast

- **Chained PRs recommended:** Yes — 2.
  - PR1 (lecturas públicas): T01 + T02 — `src/app/api/sync/version/route.ts`, cambios en `sync/route.ts` + `seed/route.ts`, tests W1/W2. Estimación: ~150–220 líneas añadidas.
  - PR2 (semilla CI): T03 + T04 + T05 + T06 — `src/lib/ci-auth.ts`, `src/lib/sync/full-bundle.ts`, `src/app/api/sync/full/route.ts`, tests W3, `.env.example`, `DEPLOY.md`. Estimación: ~300–430 líneas añadidas.
  - Estrategia sugerida: Feature Branch Chain con tracker hacia `feat/fase-b-endpoints` (el feature debe integrarse antes de `main`; PR2 apunta a la rama de PR1, no directo a `main`). Mantener tests y docs junto a la unidad que verifican.
- **400-line budget risk:** High si se entrega en un solo PR (estimación total ~450–650 líneas añadidas supera el umbral de 400); contenido dentro del budget del plan (800) pero por encima del presupuesto de revisión de un PR único.
- **Changed lines estimadas:** ~450–650 añadidas totales (W1 ~40 · W2 ~120 + tests ~80 · W3 ~250 + tests ~150 · W4 docs ~40). Sin conteo de proposal/spec/tasks ya commiteados.
- **Decision needed before apply:** Yes — chain strategy.
  - Pregunta para el responsable: ¿Stacked PRs contra `main` o Feature Branch Chain con tracker sobre `feat/fase-b-endpoints` (recomendado, 2 PRs según desglose anterior)?
  - El split en 2 slices (PR1/PR2) lo decide el forecast sin consulta adicional; la estrategia de encadenado sí requiere elección explícita antes del primer PR, conforme a la skill `chained-pr`.
