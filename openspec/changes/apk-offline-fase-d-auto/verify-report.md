# Verify report — `apk-offline-fase-d-auto`

- Fecha: 2026-11-09. Validador fresco (no autor del código). Sin cambios de código realizados.
- Ramas verificadas: web `feat/fase-d-auto` (`/home/mario/Escritorio/Proyectos/Diccionario-endpoints`),
  app `feat/mobile-fase-d` (`/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app`).
- Alcance: W0–W4 contra `proposal.md`, `research.md` (vinculante, D1/D2/D3), `spec.md` y `tasks.md` del change.

## 1. Cobertura por work unit

### W0 — E1 `serverTime` + contrato (web)

- `src/app/api/sync/version/route.ts`: emite `{ contentVersion, serverTime }`.
  `serverTime` proviene de `updatedAt` de `ContentVersion(id = 1)` vía `.toISOString()`;
  fila ausente → `{ "1", <ahora> }` sin crear la fila; `Cache-Control` y forma de error intactos.
  Conforme a spec §W0.1 reglas 1–5.
- `route.test.ts`: 6 tests (3 heredados + bloque `contrato Fase D W0` con `Contract`
  que replica `VersionResponseSchema` de la app: `contentVersion` string canónico +
  `serverTime` datetime). El test de forma exacta se actualizó a la forma aditiva con
  comentario que lo declara intencional.
- Cierre del contrato: `VersionResponseSchema` (`piiyaak-app/src/db/version-gate.ts:14-23`)
  exige `{ contentVersion, serverTime }`; la respuesta web ahora lo satisface
  (la app además tolera `number` legacy vía transform; el string canónico pasa en ambos).

### W1 — Dispatch + runs + modal (web)

- `POST /api/admin/seed/dispatch` (`src/app/api/admin/seed/dispatch/route.ts`):
  `requireAdmin()` primero; `z.strictObject` con `content_version` canónico opcional
  (`""` → omitido vía preprocess) y `dry_run` con defecto `true`; `ref: "main"`
  constante del lado servidor; env server-only `SEED_DISPATCH_TOKEN` /
  `SEED_GITHUB_OWNER` / `SEED_GITHUB_REPO`; cabeceras `Accept` + `X-GitHub-Api-Version`;
  `204` → propio `202` con `{ run: null, status: "dispatched", correlationId, ref, inputs }`;
  error upstream/red → `502` genérico sin filtrar cuerpo; sin token → `500`;
  audit `SEED_DISPATCH` solo en éxito. Conforme a spec §W1.1–W1.2, §W1.5.
- `GET /api/admin/seed/runs` y `GET /api/admin/seed/runs/[id]` (+ `github.ts`):
  `per_page` 1–30 (defecto 10), `page` ≥ 1 (defecto 1), fuera de rango → `400`;
  forma mínima `{ runs: [{ id, status, conclusion, createdAt, updatedAt, inputs, htmlUrl }], totalCount, page, per_page }`;
  upstream 404 en detalle → propio `404` con `{ message: "Ejecución no encontrada" }`;
  error upstream/red → `502` genérico. Conforme a spec §W1.3.
- `SeedDispatchModal.tsx` + cableado en `src/app/admin/palabras/page.tsx`
  (botón secundario `Generar contenido offline` junto a `ImportCorpusModal`):
  paso 1 con título, descripción, campo `content_version` (`Vacío = versión actual`),
  checkbox `dry_run` activado por defecto, botones `Revisar`/`Cancelar`;
  paso 2 con `ConfirmDialog` y textos exactos del spec
  (`¿Generar el paquete de contenido?`, `Versión: … · Modo: …`, aviso de publicación,
  `accionLabel: Generar`, `processing` anti-doble-clic);
  máquina `idle → confirmando → despachando → observando → exito/fallo`;
  polling 15 s con `per_page=10`, backoff 15/30/60 s y parada tras 3 fallos;
  mensajes de error exactos; escape `Continuar con el flujo manual en GitHub`;
  historial de últimos 10 runs. Conforme a spec §W1.4, §W1.6.
- Tests: dispatch (auth sin llamada a GitHub, allowlist, `""` omitido, 204→202 + audit,
  422→502, fallo de red→502, sin token→500), runs (forma mínima, `per_page=99`→400,
  `id` no numérico→400, upstream 404→404, sin sesión sin llamada), modal (7 tests:
  estados, doble clic = un solo POST, backoff y parada, 400 con reintento, historial).

### W2 — Notice de contenido nuevo (app)

- `src/db/update-notice.ts` (pura, sin imports `expo-*`): 5 estados
  (`checking/none/available/dismissed/downloading`), `decideNotice` sobre
  `compareVersions` (gate sin cambios), `dismissNotice/acceptNotice/settleNotice`,
  `LatestJsonSchema`, `metadataOrNull` (ilegible/inválido/divergente → nulls),
  `fetchLatestJson` (`!ok` → null; fallo de red → lanza para el `catch` vigente),
  kv `piiyaak:dismissedUpdate` con lápida vacía. Conforme a spec §W2.3–W2.4.
- Enganche en `src/db-context.tsx` (efecto post-gate): ante `remote > local` guarda el
  request y expone `updateAvailable { remote, serverTime, bytesTotal, files }` sin
  descargar; `dismissUpdate` persiste el descarte; `acceptUpdate` limpia la lápida y
  delega a `runSeedInternal` vigente con `(baseUrl, remote, serverTime)`; `skip`/`noop`
  retornan antes; `catch` resuelve a `none`. Instalación con éxito y `continueTextOnly`
  retiran el aviso. Conforme a spec §W2.1–W2.2 (la fuente de metadatos es `latest.json`
  solo-display; las URLs de descarga siguen siendo las well-known de `seedFileUrls`).
- `src/components/update-notice.tsx` (render en `src/app/index.tsx`, inline y no
  bloqueante: el diccionario y la navegación siguen operables): contenedor
  `accessibilityRole="alert"`, título `Hay contenido nuevo disponible`, detalle
  `Versión <remote> · <X,Y MB> · <N archivos>` (formato un decimal, divisor 1_000_000,
  igual que `formatSeedProgress`) o `Versión <remote>` sin metadatos, botones
  `Descargar ahora` / `Más tarde` con `minHeight: 44`, tarjeta `theme.card`.
  Conforme a spec §W2.5.
- Tests: `update-notice.test.ts` (8: checking inicial, `==`→none, noop→none,
  `>`→available, dismiss mismo-remote, remote nuevo re-avisa, accept/settle,
  no-op fuera de estado), `update-notice-hookup.test.ts` (13: borde `latest.json`,
  tolerancia de red, round-trip kv, contrato estático del enganche),
  `components/__tests__/update-notice.test.ts` (6: roles, textos, callbacks).

### W3 — Resume real (app)

- `src/db/seed-resume.ts` (`decideResume`, pura, sin `expo-*`): matriz §W3.2 completa
  (sin registro/`resumeData`→`fresh`; sin parcial→`fresh`; sin `supportsResume`→`fresh`;
  `null`/`206`→`resume`; otro status→`truncate-and-fresh`). Guarda 206 obligatoria.
- `src/db/seed-download.ts`: registro extendido con `resumeData?: string | null`
  (opaco, nunca interpretado); `normalizeSeedRecord` (antiguo sin clave→`null`;
  forma rota→`null`); sweep de `.part` ajenos por `listPartUris`; `SEED_DOWNLOAD_MAX_ATTEMPTS = 3`,
  `SEED_DOWNLOAD_RETRY_DELAYS = [2000, 8000]` (mismos valores que `fetchWithRetry`,
  con comentario de procedencia, sin refactorizar `sync.ts`); solo errores de red
  reintentan (`manifiesto`/`stale` se lanzan antes del loop; `espacio` no reintenta);
  guarda 206 tras `resumeDownload` (otro status → borrar `.part` + descarga fresca
  en el mismo intento); `pauseAndSavable` best-effort entre reintentos;
  `supportsResume` falso → `fresh` silencioso. Conforme a spec §W3.1–W3.4, §W3.6.
- `src/db/seed-expo.ts` (solo dispositivo): instancia `DownloadResumable` viva;
  `downloadFile` con `{}` (prohibición `Range` documentada en comentarios, sin
  `headers` en código); `pauseAsync() → savable().resumeData`; `resumeDownload`
  vía `createDownloadResumable(..., resumeData) + resumeAsync()` con
  `status ?? 0` ante cancelación. `grep -rn "Range" src/db/seed-expo.ts` solo
  devuelve comentarios de prohibición; el test de `seed-retry.test.ts:349` fija
  que ningún código pasa `headers Range` a `downloadAsync`. Conforme a spec §W3.3, §W3.5.
- Tests: `seed-resume.test.ts` (6 filas de la matriz), `seed-retry.test.ts`
  (round-trip opaco byte a byte, registro antiguo→`fresh`, `.part` ajeno eliminado,
  3 intentos con delays exactos, agotamiento propaga, integridad/espacio no reintentan,
  resume 206 continúa, resume 200 trunca+reinicia, savable re-persistido tras fallo,
  `fresh` sin `Accept-Ranges`, prohibición `Range`).

### W4 — Runbook + E2/E3 + eslint (web + app)

- `DEPLOY.md` del change: las 5 secciones del spec (keystore/`versionCode` en EAS,
  nunca en repo; rotación PAT ≈90 días + redeploy + recordatorio semanal; keystore
  solo ante compromiso; primera corrida `dry_run=true → logs → dry_run=false` con
  los 3 `curl` y comparación `/api/sync/version` vs `latest.json`; escape a GitHub App;
  `noop` repetidos → intervención manual, nunca auto-downgrade). Sin secretos reales,
  solo nombres de variables y placeholders.
- E2: `emitManifest` (`bundle-builder.ts:537`) es la definición canónica
  (`dbBytes + Σ files.size`); paso 9 del workflow replica con `jq -r '.bytesTotal'`
  y cita la definición en comentarios; test `latest.json — definición canónica`
  en `bundle-builder.test.ts` (réplica + cita en YAML). Conforme a spec §W4.2.
- E3: pasos renumerados secuencialmente (desapareció el doble "Paso 8");
  guarda canónica declarada una vez en comentario + 4 guardas literales idénticas
  (`!inputs.dry_run && steps.skip.outputs.skip != 'true'`) en pasos 6, 7, 8 y 10;
  paso 5 conserva `if: ${{ !inputs.dry_run }}` (SKIP no aplica en dry-run);
  verificación YAML válida (14 steps). Deduplicación documental aceptada por spec §W4.3.
- eslint app: `eslint.config.mjs` (preset `expo` vía `FlatCompat`, sin reglas custom) +
  script `lint` acotado a los 6 archivos de Fase D (`update-notice.ts`, `seed-resume.ts`,
  `update-notice.tsx`, `seed-expo.ts`, `seed-download.ts`, `db-context.tsx`).
  `npm run lint` → 0 errores, 7 warnings (ver §4). Cero reformateo fuera del alcance.

## 2. Matriz de criterios de aceptación (proposal §9)

Verificable sin credenciales/dispositivo:

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| W0 | `GET /api/sync/version` emite `{ contentVersion: string, serverTime: datetime }` aceptado por `VersionResponseSchema` | PASS | `route.test.ts` bloque contrato (3 tests) en verde |
| W1 | Sin sesión → 401/403 sin llamada a GitHub; allowlist/`ref` → 400; 204→202 + audit; polling mockeado; modal con estados | PASS | dispatch + runs + modal tests en verde; `expect(fetch).not.toHaveBeenCalled()` afirmado |
| W2 | `==` sin aviso; `>` con aviso + metadatos; descarte sin re-aviso; aceptación delega al seed | PASS | 8 + 13 + 6 tests vitest en verde |
| W3 | Matriz 6 filas; `savable()` round-trip; 200→truncado; sin registro→fresco; versión distinta limpia `.part`; sin `Range` manual | PASS | 6 + 14 tests en verde; grep de prohibición limpio salvo comentarios |
| W4 | Test E2; diff E3 sin cambio semántico; `eslint` en alcance sin errores nuevos | PASS | `bundle-builder.test.ts` E2 en verde; YAML válido; lint exit 0 |
| — | `tsc --noEmit` ambos repos → 0 errores | PASS | web exit 0; app exit 0 |
| — | Regresión fase-a web con BD local | PASS | `tests/fase-a/`: 11 archivos, 100 tests en verde, BD en 127.0.0.1:3307 activa |
| — | Regresión suite app completa | PASS | 31 archivos, 235 tests en verde |

## 3. Comandos corridos (resultado literal)

Web (`/home/mario/Escritorio/Proyectos/Diccionario-endpoints`, rama `feat/fase-d-auto`):

- `npx vitest run src/app/api/sync/version src/app/api/admin/seed` → `Test Files 3 passed (3), Tests 21 passed (21)`.
- `npx vitest run src/components/admin/SeedDispatchModal.test.tsx` → `Test Files 1 passed (1), Tests 7 passed (7)`.
- `npx vitest run src/lib/seed/` → `Test Files 2 passed (2), Tests 24 passed (24)`.
- `npx vitest run tests/fase-a/` → `Test Files 11 passed (11), Tests 100 passed (100)` (BD local 127.0.0.1:3307 en escucha, verificada).
- `npx tsc --noEmit` → exit 0, sin salida.
- `npx eslint` en archivos tocados (routes, tests, `github.ts`, modal, `page.tsx`) → exit 0, sin salida.
- `python3 -c yaml.safe_load` del workflow → `YAML_OK`, 14 steps.

App (`/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app`, rama `feat/mobile-fase-d`):

- `npx vitest run` → `Test Files 31 passed (31), Tests 235 passed (235)`.
- `npx tsc --noEmit` → exit 0, sin salida.
- `npm run lint` → exit 0, `0 errors and 7 warnings` (detalle en §4, WARNING W-2).

No se pusheó nada en ningún repo (`git status` solo muestra los untracked/modificados descritos en §4).

## 4. Hallazgos

### CRITICAL

Ninguno. No se encontró violación del spec, de D1/D2/D3 ni de las matrices normativas.

### WARNING

- **W-1. `zod` en `devDependencies` con imports en runtime (web).**
  `src/app/api/admin/seed/*/route.ts` y `src/app/api/sync/version/route.test.ts` importan
  `zod`, pero `package.json` lo fija en `devDependencies` (`^4.3.5`). Funciona en Vercel
  (no hay prune de devDeps en el build de Next.js), pero es higiénicamente incorrecto:
  una dependencia usada por route handlers debería vivir en `dependencies`.
  Sugerencia: mover `zod` a `dependencies` (el commit `f476a82` lo fijó en devDeps).
- **W-2. `npm run lint` (app): 0 errores pero 7 warnings.**
  `src/db-context.tsx`: `OutboxRow` y `AuthError` importados sin uso (preexistentes),
  directiva `eslint-disable-next-line react-hooks/exhaustive-deps` sin efecto en la
  línea 340 (introducida por W2: el efecto no reporta problemas), y 3 avisos
  `react-hooks/exhaustive-deps` en efectos (líneas 363, 388, 536). El gate del spec
  (`lint` limpio en alcance, 0 errores) se cumple; los warnings no lo rompen.
  Sugerencia: eliminar la directiva sin efecto de la línea 340 y, en follow-up,
  limpiar los imports sin uso.
- **W-3. Documentos del change sin staged (web).**
  `proposal.md`, `research.md`, `spec.md`, `tasks.md` existen en disco pero figuran
  como untracked (`??`); además hay modificaciones ajenas al change en
  `.atl/.skill-registry.cache.json` y `.atl/skill-registry.md`. Antes del archive/PR,
  hacer `git add` solo de `openspec/changes/apk-offline-fase-d-auto/` (no de `.atl/`).
- **W-4. El sync manual sigue con auto-descarga (app, conforme al spec pero inconsistente en UX).**
  El spec §W2.1 solo extiende el efecto en segundo plano de `db-context.tsx:222-252`;
  la ruta de sync manual (`sync()` → `syncNow` con callback `runSeed`) descarga de
  inmediato sin pasar por el aviso. Es conforme al spec, pero el usuario que sincroniza
  a mano no ve el aviso `Descargar ahora / Más tarde`. Sugerencia follow-up: enrutar
  esa vía por el mismo `notice` o documentar la diferencia en el runbook.
- **W-5. Tests de enganche `db-context` estáticos (app).**
  `update-notice-hookup.test.ts` §`db-context` afirma con `toContain`/`not.toContain`
  sobre el fuente en lugar de comportamiento (imposible importar `expo-sqlite` en Node).
  Aceptable por la restricción nativa, pero es el eslabón más débil de la red TDD;
  cualquier refactor del efecto que mantenga los strings pasaría el test sin ejercer
  la lógica. Sugerencia: extraer el cableado a una función pura testeable en follow-up.

### SUGGESTION

- **S-1.** Verificar en el deploy que `SEED_DISPATCH_TOKEN`, `SEED_GITHUB_OWNER` y
  `SEED_GITHUB_REPO` existen en Vercel (`production`); sin ellas el dispatch responde
  `500` por diseño (cubierto por test).
- **S-2.** Agendar el recordatorio de rotación del PAT (≈90 días) junto con la cadencia
  semanal del workflow, como indica el runbook.
- **S-3.** En el PR de W1, registrar la tabla `dry_run × skip` (4 combinaciones) con los
  `if` efectivos antes/después, como exige T-W4.2 para E3.

## 5. NO ejecutable en este entorno (requiere credenciales/dispositivo físico)

| Ítem | Motivo |
|---|---|
| Dispatch real contra GitHub (`workflow_dispatch` con PAT fino → 204 + run visible) | Sin `SEED_DISPATCH_TOKEN` ni `SEED_GITHUB_OWNER/REPO` en este entorno; la red real está prohibida por el contrato de validación (tests con `fetch` mockeado) |
| `206` real del CDN ante `Range` (`Accept-Ranges: bytes` en `R2_PUBLIC_BASE_URL/seed/<N>/piiyaak-seed.zip`) | Sin URL pública del seed publicada ni dispositivo; el HEAD de `supportsResume` solo se resuelve en runtime contra el CDN real |
| Interrupción física de descarga (modo avión a mitad) y reanudación por bytes | Requiere dispositivo con `expo-file-system` nativo (`pauseAsync/savable/resumeAsync` no existen en Node); declarado no cubierto por unitarios en spec §W3.3/§W3.7 |
| Comportamiento iOS cuando el servidor ignora el `Range` en un resume | Requiere iPhone/simulador con `NSURLSession`; la guarda 206 existe por paridad pero su rama iOS solo se ejerce en dispositivo |
| Aviso de contenido nuevo en dispositivo con red real | Requiere build en dispositivo apuntando al backend + CDN reales |
| Primera corrida del workflow y publicación de `seed/<N>/` + `latest.json` | Requiere secretos R2/GitHub (`CI_SYNC_SECRET`, `R2_*`) y decisión operativa `dry_run=false`; pasos documentados en `DEPLOY.md` §3, no ejecutados |
| Build EAS / publicación en stores | Requiere credenciales EAS y `versionCode`/`buildNumber`; documentado en `DEPLOY.md` §1–§2, fuera del alcance del change |

## 6. Veredicto

**PASS.** W0–W4 implementados conforme a spec y tasks, con red TDD completa
(contratos, matrices y bordes cubiertos por tests que nombran la fila/caso del spec),
regresiones en verde en ambos repos (`tests/fase-a/` 100/100 con BD local activa;
suite app 235/235), `tsc` 0 errores en ambos, `eslint` 0 errores en los archivos
tocados, y runbook + E2/E3 + eslint mínimo cerrados. Los 5 WARNINGS son higiene o
follow-ups y no bloquean. Siguiente paso recomendado: `archive` (previo `git add`
de `openspec/changes/apk-offline-fase-d-auto/`, sin `.atl/`), quedando los 7 ítems
de §5 como pasos operativos del runbook.
