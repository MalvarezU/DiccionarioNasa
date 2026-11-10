# Tasks: apk-offline-fase-d-auto — Automatización Fase D

- **Change ID:** `apk-offline-fase-d-auto`
- **Ramas:** web `feat/fase-d-auto` (este repo) · app `feat/mobile-fase-d` (`/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app`)
- **Orden:** secuencial W0 → W1 → W2 → W3 → W4. Cada tarea sigue RED → GREEN → refactor. Sin test failing observado no existe código de producción.
- **Fuentes normativas:** `spec.md` (firmas, textos, matrices), `proposal.md` (decisiones D1/D2/D3), `research.md` (PAT fino, descarte `expo-dom`, resume vía `savable` + guarda 206).
- **Comandos de verificación:** web `npx vitest run <archivo>` + `npx tsc --noEmit`; app `npx vitest run <archivo>` + `npx tsc --noEmit` + `npm run lint` (desde W4.4).

---

## W0 — E1 `serverTime` + test de contrato (web, prerrequisito)

### T-W0.1 Test de contrato W0 (RED, hoy falla)

- **Repo + rama:** web · `feat/fase-d-auto`
- **Criterios que cierra:** spec §W0.2 caso 1 (contrato roto contra respuesta real); criterio de aceptación W0 (cuerpo aceptado por `VersionResponseSchema`); borde 1 (parcial, caso fila presente).
- **Archivos exactos:**
  - Modificar: `src/app/api/sync/version/route.test.ts` (agregar bloque `describe("contrato Fase D W0")` con `Contract = z.object({ contentVersion: z.string().regex(/^\d+$/), serverTime: z.string().datetime() })`).
- **Test RED → GREEN que la cierra:**
  - RED: agregar test `contrato: la respuesta real es aceptada por el contrato de la app` que ejecuta `GET` con `db.contentVersion.findUnique` mockeado a `{ version: 41, updatedAt: new Date("2026-11-09T03:00:12.345Z") }` y aplica `Contract.parse(body)`. Ejecutar `npx vitest run src/app/api/sync/version/route.test.ts` y observar el fallo (`serverTime` ausente). Registrar la salida del fallo.
  - GREEN: se completa en T-W0.2 (sin este RED previo no se toca `route.ts`).
- **Dependencia:** ninguna (primera tarea del change).
- **Gate:** el nuevo test falla con mensaje esperado (ausencia de `serverTime`, no error de tipos ni de mock); los 3 tests existentes permanecen intactos.

### T-W0.2 Emitir `serverTime` en `GET /api/sync/version` (GREEN)

- **Repo + rama:** web · `feat/fase-d-auto`
- **Criterios que cierra:** spec §W0.1 reglas 1–5; spec §W0.2 casos 2–4; criterio de aceptación W0; borde 1 completo.
- **Archivos exactos:**
  - Modificar: `src/app/api/sync/version/route.ts` (leer `updatedAt` en la misma consulta `findUnique({ where: { id: 1 } })`; serializar con `.toISOString()`; fila ausente → `{ contentVersion: "1", serverTime: <ahora> }` sin crear la fila; mantener `Cache-Control` y forma de error).
  - Modificar: `src/app/api/sync/version/route.test.ts` (casos: `serverTime` es datetime ISO-8601 con `Z`; fila ausente → `{"1", <ahora>}` válido contra el contrato; test de `500` existente sin cambios).
- **Test RED → GREEN que la cierra:**
  - RED: el de T-W0.1 (ya observado).
  - GREEN: `npx vitest run src/app/api/sync/version/route.test.ts` en verde (4–5 tests) + `npx tsc --noEmit` sin errores. Verificar que ningún test existente cambió de semántica (el test de forma exacta `toEqual({ contentVersion: "41" })` se actualiza a la nueva forma con `serverTime`, documentado como cambio aditivo intencional).
- **Dependencia:** T-W0.1 (RED observado).
- **Gate:** suite en verde; `tsc --noEmit` → 0 errores; respuesta real parseable por el contrato replicado de `VersionResponseSchema`.

---

## W1 — Dispatch admin (web, bloque mayor)

### T-W1.1 `POST /api/admin/seed/dispatch` — validación + auth (RED → GREEN)

- **Repo + rama:** web · `feat/fase-d-auto`
- **Criterios que cierra:** spec §W1.2 (filas 400 y 401/403), §W1.5 (allowlist, `""` = omitir), §W1.7 casos 1–2; bordes 2 y 3 (parcial, lado servidor).
- **Archivos exactos:**
  - Crear: `src/app/api/admin/seed/dispatch/route.ts` (`requireAdmin()` primera instrucción; `DispatchBodySchema` con `content_version` canónico opcional y `dry_run` con defecto `true`; rechazo de claves extra con `400`; `ref: "main"` constante del lado servidor; `SEED_DISPATCH_TOKEN` / `SEED_GITHUB_OWNER` / `SEED_GITHUB_REPO` desde env server-only).
  - Crear: `src/app/api/admin/seed/dispatch/route.test.ts` (mock global de `fetch`, nunca red real; mock de `requireAdmin` y de `db.auditLog.create`).
- **Test RED → GREEN que la cierra:**
  - RED (escribir primero, observar fallo): sin sesión admin → `401/403` y `fetch` no llamado; body `{ foo: 1 }` → `400`; `content_version: "abc"` → `400`; `dry_run: "sí"` → `400`; `content_version: ""` → dispatch sin clave `content_version`. Ejecutar `npx vitest run src/app/api/admin/seed/dispatch/route.test.ts` y observar fallos por ruta inexistente.
  - GREEN: implementar la ruta hasta verde + `npx tsc --noEmit` sin errores.
- **Dependencia:** T-W0.2 (contrato base estable).
- **Gate:** 5 tests en verde; `fetch` a GitHub jamás invocado en casos 401/403/400 (afirmar con `expect(fetch).not.toHaveBeenCalled()`); sin token en respuestas ni logs.

### T-W1.2 Dispatch — mapeo 204→202, error upstream→502, audit (RED → GREEN)

- **Repo + rama:** web · `feat/fase-d-auto`
- **Criterios que cierra:** spec §W1.2 (filas 202, 502, 500), §W1.7 casos 3–4; criterio de aceptación W1 (dispatch mockeado).
- **Archivos exactos:**
  - Modificar: `src/app/api/admin/seed/dispatch/route.ts` (llamada `POST .../dispatches` con cabeceras `Accept: application/vnd.github+json` + `X-GitHub-Api-Version: 2022-11-28`; `204` → propio `202` con `{ run: null, status: "dispatched", correlationId: crypto.randomUUID(), ref: "main", inputs }`; error upstream o fallo de red → `502` con mensaje genérico; sin token → `500`; `db.auditLog.create` con `action: "SEED_DISPATCH"` solo en éxito, precedente `src/app/api/admin/words/[id]/route.ts:144-157`).
  - Ampliar: `src/app/api/admin/seed/dispatch/route.test.ts` (casos: mock `204` → `202` + audit escrito; mock `422` → `502` con cuerpo exacto `{ message: "No se pudo disparar la generación de contenido" }` y ausencia del cuerpo upstream; fallo de red → `502`; audit no escrito en 502).
- **Test RED → GREEN que la cierra:**
  - RED: agregar los 4 tests y observar fallo (mapeo/audit ausentes).
  - GREEN: implementar hasta verde + `tsc --noEmit` sin errores.
- **Dependencia:** T-W1.1.
- **Gate:** 9 tests acumulados en verde; el cuerpo de GitHub nunca aparece en respuestas propias (afirmar ausencia de marcador inyectado por el mock).

### T-W1.3 `GET runs` + `GET runs/[id]` — status/historial (RED → GREEN)

- **Repo + rama:** web · `feat/fase-d-auto`
- **Criterios que cierra:** spec §W1.3 (forma mínima, validación `per_page`/`page`/`id`, 404 propio), §W1.7 caso 5; criterio de aceptación W1 (polling mockeado); bordes 4 y 5 (parcial, lado servidor).
- **Archivos exactos:**
  - Crear: `src/app/api/admin/seed/runs/route.ts` (`requireAdmin()` primero; `per_page` 1–30 defecto 10, `page` ≥ 1 defecto 1; mapeo a la forma mínima `{ runs: [{ id, status, conclusion, createdAt, updatedAt, inputs, htmlUrl }], totalCount, page, per_page }`; upstream error/red → `502` genérico).
  - Crear: `src/app/api/admin/seed/runs/[id]/route.ts` (`id` con `/^\d+$/`, si no → `400`; upstream 404 → propio `404` con `{ message: "Ejecución no encontrada" }`).
  - Crear: `src/app/api/admin/seed/runs/route.test.ts` (+ casos del detalle `[id]` en el mismo archivo o en `src/app/api/admin/seed/runs/[id]/route.test.ts`).
- **Test RED → GREEN que la cierra:**
  - RED: tests con `fetch` mockeado (lista con 2 runs → forma mínima exacta; `per_page=99` → `400`; `id: "abc"` → `400`; upstream 404 → propio `404`; sin sesión → 401/403 sin llamada). Observar fallo por rutas inexistentes.
  - GREEN: implementar hasta verde + `tsc --noEmit` sin errores.
- **Dependencia:** T-W1.2.
- **Gate:** 6 tests nuevos en verde; ningún campo interno de GitHub fuera de la lista §W1.3 aparece en respuestas (afirmar con `toEqual` estricto sobre un run).

### T-W1.4 Botón admin + modal + polling UI (RED → GREEN)

- **Repo + rama:** web · `feat/fase-d-auto`
- **Criterios que cierra:** spec §W1.4 (intervalo 15 s, `per_page=10`, backoff 15/30/60 s, parada tras 3 fallos), §W1.6 (ubicación, textos exactos, máquina de estados, historial), §W1.7 caso 6; criterio de aceptación W1 (modal); bordes 3, 4 y 5 (lado UI).
- **Archivos exactos:**
  - Crear: `src/components/admin/SeedDispatchModal.tsx` (paso 1 con título, descripción, campo `content_version`, checkbox `dry_run` activado por defecto, botones `Revisar`/`Cancelar`; paso 2 con `ConfirmDialog` y textos exactos §W1.6; máquina `idle → confirmando → despachando → observando → exito/fallo`; `processing` deshabilita botones; escape `Continuar con el flujo manual en GitHub`; historial de últimos 10 runs).
  - Modificar: `src/app/admin/palabras/page.tsx` (botón secundario `Generar contenido offline` junto al botón de `ImportCorpusModal`, línea 72).
  - Crear: `src/components/admin/SeedDispatchModal.test.tsx` (respuestas mockeadas de `fetch`; timers falsos para polling).
- **Test RED → GREEN que la cierra:**
  - RED: tests de estados (`idle → confirmando → despachando → observando → exito/fallo`); doble clic en `Generar` emite un solo `POST`; polling se detiene en `completed`; backoff 15/30/60 s y parada tras 3 fallos con mensaje `No se pudo obtener el estado. Revisar manualmente en GitHub Actions.` Observar fallo por componente inexistente.
  - GREEN: implementar hasta verde + `tsc --noEmit` sin errores.
- **Dependencia:** T-W1.3 (endpoints que la UI consume).
- **Gate:** 6+ tests UI en verde; textos exactos §W1.6 verificados por roles/strings; `tsc --noEmit` → 0 errores.

---

## W2 — Notice de contenido nuevo (app)

### T-W2.1 Máquina de estados `update-notice` pura (RED → GREEN)

- **Repo + rama:** app · `feat/mobile-fase-d`
- **Criterios que cierra:** spec §W2.3 (estados y transiciones), §W2.6 casos 1–4; criterio de aceptación W2 (parcial, lógica); borde 8 (parcial, transiciones en memoria).
- **Archivos exactos:**
  - Crear: `piiyaak-app/src/db/update-notice.ts` (tipo `UpdateNoticeState` con los 5 estados; funciones puras de transición sin imports `expo-*`; documento de decisión: `checking → none/available`, `available → dismissed/downloading`, `dismissed → available` solo si `remote` cambia, `downloading → none`).
  - Crear: `piiyaak-app/src/db/update-notice.test.ts` (vitest, Node, sin nativo).
- **Test RED → GREEN que la cierra:**
  - RED: `remote == local` → `none`; `remote > local` → `available` con metadatos; `dismissUpdate()` → `dismissed` y mismo `remote` no re-avisa; `remote` nuevo sí avisa. Observar fallo por módulo inexistente (`npx vitest run src/db/update-notice.test.ts`).
  - GREEN: implementar la máquina hasta verde + `npx tsc --noEmit` sin errores.
- **Dependencia:** W0 cerrado en web (el gate `compareVersions` ya recibe `serverTime` válido).
- **Gate:** 4+ tests en verde; el módulo no importa `expo-*` (afirmar por inspección de imports + ejecución en Node sin mocks nativos).

### T-W2.2 Enganche en `db-context` + `latest.json` + descarte kv (RED → GREEN)

- **Repo + rama:** app · `feat/mobile-fase-d`
- **Criterios que cierra:** spec §W2.1 (enganche, `LatestJsonSchema`, reglas 1–3), §W2.4 (clave `piiyaak:dismissedUpdate`, limpieza al aceptar/instalar), §W2.6 caso 5; bordes 6, 7 y 8 completos.
- **Archivos exactos:**
  - Modificar: `piiyaak-app/src/db-context.tsx` (efecto `222-252` extendido: ante `remote > local` exponer `updateAvailable { remote, serverTime, bytesTotal, files }` y esperar decisión; `dismissUpdate`, `acceptUpdate` que delega a `runSeedInternal` vigente con `(baseUrl, remote, serverTime)`; camino `skip`/`noop`/`catch` sin cambios).
  - Ampliar: `piiyaak-app/src/db/update-notice.test.ts` o crear `piiyaak-app/src/db-context.update-notice.test.ts` (fetch de `latest.json` mockeado: válido → metadatos; inválido/ausente/divergente → nulls; sin red → sin aviso; descarte persiste por versión y se limpia al aceptar).
- **Test RED → GREEN que la cierra:**
  - RED: agregar los casos (`latest.json` válido/inválido/divergente/ausente; `dismissed === remote` → nace `dismissed`; aceptar limpia la clave y llama `runSeedInternal` con los 3 argumentos). Observar fallo.
  - GREEN: implementar hasta verde + `tsc --noEmit` sin errores.
- **Dependencia:** T-W2.1.
- **Gate:** 5+ tests en verde; `runSeedInternal` no se invoca automáticamente ante `remote > local` (afirmar con mock); el flujo seed posterior no se re-testea aquí.

### T-W2.3 Componente `UpdateNotice` (RED → GREEN)

- **Repo + rama:** app · `feat/mobile-fase-d`
- **Criterios que cierra:** spec §W2.5 (textos exactos, roles, botones ≥ 44pt, no bloqueante), §W2.6 caso 6; criterio de aceptación W2 (render).
- **Archivos exactos:**
  - Crear: `piiyaak-app/src/components/update-notice.tsx` (lenguaje visual de `seed-progress.tsx`: tarjeta, `theme.card`; contenedor `accessibilityRole="alert"`; título `Hay contenido nuevo disponible`; detalle `Versión <remote> · <X,Y MB> · <N archivos>` o `Versión <remote>` sin metadatos; botones `Descargar ahora` / `Más tarde`).
  - Crear: `piiyaak-app/src/components/__tests__/update-notice.test.tsx` (roles y acciones, snapshot/roles, no píxeles).
- **Test RED → GREEN que la cierra:**
  - RED: render con metadatos muestra `alert` + ambas acciones; sin metadatos muestra solo `Versión <remote>`; pulsar `Descargar ahora` invoca `acceptUpdate`; pulsar `Más tarde` invoca `dismissUpdate`. Observar fallo por componente inexistente.
  - GREEN: implementar hasta verde + `tsc --noEmit` sin errores.
- **Dependencia:** T-W2.2.
- **Gate:** 4 tests en verde; la pantalla permanece operable con el aviso visible (el test monta el aviso junto a contenido de fondo y afirma que ambos existen).

---

## W3 — Resume real (app, bloque móvil mayor)

### T-W3.1 Decisión pura `seed-resume` — matriz de 6 filas (RED → GREEN)

- **Repo + rama:** app · `feat/mobile-fase-d`
- **Criterios que cierra:** spec §W3.2 (tipos `ResumeInput`/`ResumeDecision` y matriz normativa), §W3.7 caso 1; criterio de aceptación W3 (matriz); bordes 9, 10 y 12 (lógica de decisión).
- **Archivos exactos:**
  - Crear: `piiyaak-app/src/db/seed-resume.ts` (función pura sin imports `expo-*`; guarda `status === 206` obligatoria).
  - Crear: `piiyaak-app/src/db/seed-resume.test.ts` (las 6 filas de la matriz como casos individuales).
- **Test RED → GREEN que la cierra:**
  - RED (una fila por test, nombres que citan la fila): (1) `record.resumeData` nulo → `fresh`; (2) `existingBytes` nulo/0/≥ total → `fresh`; (3) `supportsResume false` → `fresh`; (4) `true + null` → `resume`; (5) `true + 206` → `resume`; (6) `true + 200` (u otro) → `truncate-and-fresh`. Observar fallo por módulo inexistente (`npx vitest run src/db/seed-resume.test.ts`).
  - GREEN: implementar la función hasta 6/6 en verde + `tsc --noEmit` sin errores.
- **Dependencia:** T-W2.3 (W2 cerrado; el resume se apoya en el flujo seed que W2 delega).
- **Gate:** matriz completa en verde; el módulo no importa `expo-*`.

### T-W3.2 Registro kv con `resumeData` opaco + compatibilidad (RED → GREEN)

- **Repo + rama:** app · `feat/mobile-fase-d`
- **Criterios que cierra:** spec §W3.1 (esquema `SeedDownloadRecord`, reglas 1–3), §W3.7 casos 2–4; bordes 9 y 11.
- **Archivos exactos:**
  - Modificar: `piiyaak-app/src/db/seed-download.ts` (extender el registro `piiyaak:seedDownload:<N>` con `resumeData: string | null`; lectura de registro antiguo sin la clave → `resumeData: null`; `.part` ajeno ante `contentVersion` distinto se borra por diseño, comportamiento vigente `136-138`).
  - Ampliar: tests del registro (round-trip `writeRecord → readRecord` byte a byte sin parseo; registro antiguo → `null` → `fresh` vía `decideResume`; versión distinta elimina `.part` ajeno).
- **Test RED → GREEN que la cierra:**
  - RED: round-trip con `resumeData` opaco largo (blob base64 simulado) preservado byte a byte; registro heredado `{ partName, totalBytes, updatedAt }` leído como `resumeData: null`; cambio de versión elimina el `.part` ajeno. Observar fallo.
  - GREEN: implementar hasta verde + `tsc --noEmit` sin errores.
- **Dependencia:** T-W3.1.
- **Gate:** 3 tests en verde; el opaco nunca se interpreta (grep `resumeData.` con acceso a subcampos en producción → cero resultados fuera de tests).

### T-W3.3 Cableado `pauseAsync/savable/resumeAsync` + reintentos + prohibición `Range` (RED → GREEN)

- **Repo + rama:** app · `feat/mobile-fase-d`
- **Criterios que cierra:** spec §W3.3 (instancia viva, `pauseAsync → savable`, `createDownloadResumable + resumeAsync`), §W3.4 (3 intentos, backoff `[2000, 8000]`, solo recuperables), §W3.5 (prohibición), §W3.6 (degradación), §W3.7 casos 5–6; criterio de aceptación W3 (grep); borde 13.
- **Archivos exactos:**
  - Modificar: `piiyaak-app/src/db/seed-expo.ts` (zona `:124-141`: mantener viva la instancia `DownloadResumable`; ante interrupción/error recuperable `pauseAsync()` + persistir `savable()`; reintento con decisión `resume`; lectura de `result.status` con guarda 206; `import expo-file-system` sigue prohibido en tests Node, cabecera `:1-17`).
  - Ampliar: `piiyaak-app/src/db/seed-resume.test.ts` o nuevo `piiyaak-app/src/db/__tests__/seed-retry.test.ts` con adaptador inyectable (sin nativo): 3 intentos con delays `[2000, 8000]` ante error recuperable; error de integridad (`dbSha256`, conteos, manifiesto, `stale`) no reintenta resume; `supportsResume false` → `fresh` silencioso.
- **Test RED → GREEN que la cierra:**
  - RED: reintentos con temporizadores falsos (2 reintentos tras el inicial, delays exactos); integridad no reintenta; ningún código pasa `headers: { Range }` a `downloadAsync` (test de inspección del adaptador + `grep -rn "Range" src/db/seed-expo.ts` con cero resultados fuera de comentarios de prohibición). Observar fallo.
  - GREEN: implementar hasta verde + `tsc --noEmit` sin errores.
- **Dependencia:** T-W3.2.
- **Gate:** 4+ tests en verde; `grep` de prohibición limpio; lo nativo real (descarga en dispositivo, `pauseAsync` físico) declarado no cubierto, según spec §9/§14.

---

## W4 — Runbook + E2/E3 + eslint (docs e higiene)

### T-W4.1 E2: definición canónica `bytesTotal` + test (RED → GREEN)

- **Repo + rama:** web · `feat/fase-d-auto`
- **Criterios que cierra:** spec §W4.2 (definición, test, comentario en paso 9); criterio de aceptación W4 (test E2).
- **Archivos exactos:**
  - Crear o ampliar: test de contrato E2 (nuevo `src/lib/seed/bytes-total-contract.test.ts` o extensión de `src/lib/seed/bundle-builder.test.ts`): `latest.json.bytesTotal === manifest.json.bytesTotal` para el mismo build fixture, y `manifest.bytesTotal === dbBytes + Σ files.size`.
  - Modificar: `.github/workflows/seed-content.yml` paso 9 (agregar comentario que cite la definición canónica `emitManifest`, `bundle-builder.ts:537`; sin cambiar la expresión `jq -r '.bytesTotal'`).
- **Test RED → GREEN que la cierra:**
  - RED: test con fixture donde `latest.json.bytesTotal` diverge del manifiesto → fallo observado.
  - GREEN: fijar el comentario + test en verde (`npx vitest run <archivo>`) + `tsc --noEmit` sin errores.
- **Dependencia:** T-W1.4 (W1 cerrado; el workflow solo se toca de forma documental).
- **Gate:** test E2 en verde; diff del paso 9 limitado al comentario (cero cambio semántico).

### T-W4.2 E3: deduplicación `seed-content.yml` (higiene con verificación)

- **Repo + rama:** web · `feat/fase-d-auto`
- **Criterios que cierra:** spec §W4.3 (renumeración, guarda común o comentario canónico, verificación); criterio de aceptación W4 (diff E3).
- **Archivos exactos:**
  - Modificar: `.github/workflows/seed-content.yml` (renumerar pasos secuencialmente —hoy dos "Paso 8" y salto a "Paso 11"—; extraer la condición común a output/paso `decide` o, si la sintaxis lo impide sin reestructurar jobs, comentario único con la guarda canónica + 4 guardas literales idénticas).
- **Test RED → GREEN que la cierra:**
  - No aplica TDD unitario (YAML de CI). Verificación: tabla `dry_run × skip` (4 combinaciones) con los `if` efectivos antes/después idénticos, registrada en la descripción del PR; dry-run en CI verde.
- **Dependencia:** T-W4.1.
- **Gate:** diff revisado paso a paso; los `if` efectivos son lógicamente idénticos; CI del workflow en verde.

### T-W4.3 Runbook `DEPLOY.md` del change (docs)

- **Repo + rama:** web · `feat/fase-d-auto`
- **Criterios que cierra:** spec §W4.1 (5 secciones obligatorias); pasos operativos del criterio de aceptación que requiere credenciales/dispositivo.
- **Archivos exactos:**
  - Crear: `openspec/changes/apk-offline-fase-d-auto/DEPLOY.md` (1. keystore/`versionCode` en EAS, nunca en repo; 2. rotación PAT ≈90 días + keystore solo ante compromiso; 3. primera corrida `dry_run=true → logs → dry_run=false` con los 3 `curl` y comparación `/api/sync/version` vs `latest.json`; 4. escape a GitHub App si la org bloquea PATs; 5. `noop` repetidos → intervención manual, nunca auto-downgrade).
- **Test RED → GREEN que la cierra:**
  - No aplica TDD. Verificación: checklist de las 5 secciones presentes con comandos copiables (`curl ... | jq ...`, `curl -I ...` con `accept-ranges: bytes` esperado).
- **Dependencia:** T-W4.2.
- **Gate:** las 5 secciones existen; ningún secreto ni valor real aparece en el documento (solo nombres de variables y placeholders).

### T-W4.4 eslint mínimo app (higiene con gate)

- **Repo + rama:** app · `feat/mobile-fase-d`
- **Criterios que cierra:** spec §W4.4 (dependencias, `eslint.config.mjs`, script `lint`, alcance); criterio de aceptación W4 (`lint` limpio en alcance).
- **Archivos exactos:**
  - Modificar: `piiyaak-app/package.json` (`eslint` + `eslint-config-expo` fijados según SDK 52; script `"lint": "eslint src/db/update-notice.ts src/db/seed-resume.ts src/components/update-notice.tsx src/db/seed-expo.ts src/db/seed-download.ts src/db-context.tsx"`).
  - Crear: `piiyaak-app/eslint.config.mjs` (extends del preset Expo, sin reglas custom salvo las necesarias para que el preset pase).
- **Test RED → GREEN que la cierra:**
  - RED: `npm run lint` falla por configuración ausente (registrar salida).
  - GREEN: `npm run lint` limpio en los 6 archivos de alcance + `npx tsc --noEmit` → 0 errores. Cero reformateo fuera del alcance.
- **Dependencia:** T-W3.3 (archivos W2/W3 existen) para el alcance app; corre en paralelo con T-W4.1–T-W4.3 del lado web tras instalar dependencias.
- **Gate:** `lint` limpio en alcance; resto del repo fuera del gate por diseño.

---

## Review Workload Forecast

- **Chained PRs recommended:** Yes.
- **Cantidad de PRs (auto-chain, stacked-to-main):** 5, uno por work unit (PR-1 W0, PR-2 W1, PR-3 W2, PR-4 W3, PR-5 W4). Cada PR incluye sus tests y docs; el siguiente apila sobre el anterior hacia `main`.
  - Por repo: web 3 PRs (W0, W1, W4-web que incluye E2/E3/runbook) + app 2 PRs (W2, W3 + eslint en W4-app como commit dentro del PR-4 o PR-5 según fricción de dependencias; por defecto: eslint viaja en PR-5).
- **400-line budget risk:** High en PR-2 (W1: 2 rutas + 2 tests + modal + test UI + página admin ≈ 500–700 líneas) y Medium en PR-4 (W3: decisión + registro + cableado + tests ≈ 350–500 líneas). PR-1, PR-3 y PR-5 quedan bajo 400 líneas con alta probabilidad. Si PR-2 supera el presupuesto tras un pase honesto de slicing (rutas vs UI), se divide en PR-2a (dispatch + runs) y PR-2b (modal + polling), y se declara `size:exception` solo si el split cohesivo no alcanza.
- **Changed lines estimadas:** web ≈ 300–500 + tests (proposal §8); app ≈ 200–400 + tests. Total ≈ 500–900 más fixtures de test. Sin cambios en el generador de bundle (salvo comentario E2), sin cambios R2, sin migraciones.
- **Decision needed before apply:** No. El spec fija firmas, textos, matrices, N de reintentos, delays, intervalo de polling, nombres de env y claves kv. No existen forks abiertos (proposal §5: ninguno). La única verificación externa pendiente (PAT/R2/dispositivo) es operativa y vive en el runbook, no bloquea `apply`.
