# Proposal: apk-offline-fase-d-auto — Automatización Fase D (botón admin + dispatch + notice app + resume real)

- **Change ID:** `apk-offline-fase-d-auto`
- **Branch web:** `feat/fase-d-auto` (este repo; aquí vive el change: `openspec/changes/apk-offline-fase-d-auto/`)
- **Rama app:** `feat/mobile-fase-d` en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app` (trabajo móvil referenciado por paths absolutos; este proposal lo especifica, no lo implementa)
- **Repo scope:** web + especificación del trabajo móvil. Sin cambios en el generador de bundle (Fase C W1) salvo erratas. Sin cambios en R2 salvo documentación.
- **Estado:** propuesta (sin spec/tasks todavía — siguiente paso recomendado: `spec`)
- **artifact_store.mode:** hybrid (file-based en `openspec/`; engram pendiente)
- **delivery_strategy:** auto-chain (W0 → W1 → W2 → W3 → W4; cada work unit con gate TDD antes de avanzar)
- **chain_strategy:** stacked-to-main
- **Research vinculante:** `openspec/changes/apk-offline-fase-d-auto/research.md` (PAT fino recomendado; `expo-web-to-native`/`expo-dom` descartados; resume real SOLO vía `pauseAsync→savable→resumeAsync` con guarda `status===206`, NUNCA `Range` manual en `downloadAsync`; R2 sin cambios)

## 1. Problema

La Fase C dejó un pipeline funcional pero manual y con defectos latentes:

1. **Disparo manual del seed.** El workflow `.github/workflows/seed-content.yml` (en `/home/mario/Escritorio/Proyectos/Diccionario-endpoints/.github/workflows/seed-content.yml`) solo se ejecuta por `workflow_dispatch` en la UI de GitHub o por `schedule` semanal. No existe botón en el panel admin, ni registro de quién disparó qué, ni estado visible del run. El precedente de UI existe (`src/components/admin/ImportCorpusModal.tsx:98/125` con patrón de dos pasos preview→confirm y `src/components/admin/confirm-dialog.tsx` como confirmación), pero no se reutiliza para contenido offline.
2. **La app no anuncia contenido nuevo.** El gate de versión en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db-context.tsx:222-252` compara `getLocalVersion` contra `getRemoteVersion` y ejecuta el seed en silencio o no lo ejecuta. No existe aviso de "nuevo contenido disponible" con decisión del usuario; el único patrón visual reutilizable es `src/components/seed-progress.tsx` (presentacional sobre `SeedState` de `src/db/seed-machine.ts`).
3. **Resume declarado pero no real.** `src/db/seed-expo.ts:124-141` crea `createDownloadResumable(url, partUri, {}, cb)` y llama `downloadAsync()` sin `resumeData`; el parámetro `_opts.offset` se ignora. Toda re-descarga es completa aunque el HEAD `accept-ranges` indique soporte. El research (P3) demuestra que el resume real exige `pauseAsync() → savable() → resumeAsync()` con guarda de status `206`, y que `Range` manual en `downloadAsync()` corrompe (sobrescribe en lugar de continuar).
4. **Erratas conocidas sin corregir.** E1: `GET /api/sync/version` (`src/app/api/sync/version/route.ts`) emite solo `{ contentVersion }` mientras `VersionResponseSchema` en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db/version-gate.ts:59` exige `{ contentVersion, serverTime }`; el seed nunca se dispara contra el backend real (fallo silencioso por `ZodError`). E2: definición contradictoria de `bytesTotal` entre el generador (`src/lib/seed/bundle-builder.ts:537`: `dbBytes + Σ files.size`) y su uso en `seed-content.yml:256-261` (`bytes_total` leído de `manifest.json` para `latest.json` con forma `{contentVersion, manifestUrl, zipUrl, bytesTotal, files, updatedAt}`); la spec debe fijar una definición canónica única. E3: pasos con guardas duplicadas en `seed-content.yml` (condiciones `if: ${{ !inputs.dry_run ... }}` repetidas en pasos 8–11); la spec debe deduplicar sin cambiar semántica.
5. **Deuda operativa sin documentar.** `keystore` y `versionCode` están ausentes del repositorio (correcto: credenciales EAS, nunca en repo), pero no existe runbook que explique dónde viven, cómo rotan ni qué hace la primera corrida real del workflow. La app carece de `eslint` (`piiyaak-app/package.json` sin script ni config), por lo que el trabajo móvil de Fase D entra sin red de estilo.

Sin este change, cada publicación de contenido exige ir a GitHub a mano, la app no informa al usuario y las descargas grandes en redes inestables reinician desde cero.

## 2. Objetivo medible

Al cerrar el change:

- **Un admin dispara el seed sin salir del panel.** Desde la UI admin, con `requireAdmin()` como guarda, el operador elige `content_version` (vacío = actual) y `dry_run`, confirma (patrón `ConfirmDialog`), y el sistema registra el dispatch en el audit existente. El dispatch llega a GitHub (`POST .../dispatches` → `204`) y la UI muestra estado del run por polling (`GET .../actions/runs`) con historial consultable.
- **La app anuncia contenido nuevo antes de descargarlo.** Con red disponible, la app detecta `remote > local` vía `latest.json`/versión remota y presenta un aviso no bloqueante (patrón `SeedProgress`) con acciones explícitas (descargar ahora / más tarde). El diccionario de texto permanece utilizable en todo momento.
- **Las descargas interrumpidas se reanudan por bytes, no desde cero.** Ante interrupción con `resumeData` persistido y servidor que honra rangos (guarda `status === 206`), el reintento continúa desde el offset; en cualquier otro caso, reinicio limpio con truncado (nunca append ciego). Sin regresión en el camino feliz actual.
- **Erratas E1/E2/E3 cerradas y deuda mínima saldada.** `GET /api/sync/version` emite `serverTime`; `bytesTotal` posee definición canónica única con test de contrato; `seed-content.yml` sin duplicaciones; app con `eslint` mínimo operativo.

## 3. Alcance / No-alcance

### En alcance

- **W0 — E1 `serverTime` + test de contrato (web + borde app).** Emitir `serverTime` en `GET /api/sync/version` y cubrir con test de contrato que impida regresión silenciosa.
- **W1 — Dispatch admin (web).** Endpoint server-only que ejecuta `POST /repos/{owner}/{repo}/actions/workflows/seed-content.yml/dispatches` con `ref` validado e `inputs` en allowlist (`content_version`, `dry_run`); botón admin con patrón `ImportCorpusModal` + `ConfirmDialog`; estado e historial por `GET .../actions/runs`; autenticación vía `requireAdmin()`; secreto PAT fino en env server-only; auditoría de cada dispatch.
- **W2 — Notice de contenido nuevo (app, `feat/mobile-fase-d`).** Enganche en `db-context.tsx:222-252`: ante `remote > local`, aviso no bloqueante con patrón `SeedProgress`; acciones descargar/posponer; sin cambios en el gate de comparación (ya existe `compareVersions`).
- **W3 — Resume real (app, `feat/mobile-fase-d`).** `pauseAsync() → savable()` persistido en kv (`piiyaak:seedDownload:<N>` extendida o clave hermana), restauración con `createDownloadResumable(..., resumeData) + resumeAsync()`, guarda obligatoria `status === 206` (si no, borrar `.part` y reiniciar fresco), reintentos acotados con backoff. Prohibido `Range` manual en `downloadAsync`.
- **W4 — Runbook + E2/E3 + eslint mínimo (web + app).** Runbook `keystore`/`versionCode` (dónde viven en EAS, rotación, qué NUNCA va al repo) + procedimiento de primera corrida real; corrección E2 (definición canónica de `bytesTotal`) y E3 (deduplicación de pasos); `eslint` mínimo operativo en la app.

### Fuera de alcance (explícito)

- **Primera corrida real del workflow y builds EAS reales.** Quedan como pasos operativos documentados en el runbook, no ejecutados en este change (sin credenciales R2/GitHub ni dispositivo en este entorno; ver §9).
- **Sin cambios en R2.** `GetObjectCommand` con `Range` y URLs públicas CDN quedan intactos (research P3: no se requiere nada nuevo del lado servidor).
- **Sin `expo-web-to-native` ni `expo-dom`.** Descartados por el research (P2): la Fase D app es nativa pura; el banner reutiliza el componente RN `SeedProgress`, no código web.
- **Sin GitHub App.** Descartada por el research (P1) para este caso: PAT fino es el mínimo privilegio sin código extra. Migración futura queda documentada como compatible, no implementada.
- **Sin cambios en el generador de bundle, paginación de `/api/sync/full`, Admin UI fuera del botón seed, PWA, limpieza de R2 huérfano ni migración de esquema.** Sin `eas-update` como transporte.

## 4. Decisiones cerradas (no reabrir)

Resueltas por el research vinculante. Se documentan con tradeoffs para trazabilidad; la spec no debe replantearlas.

### D1 — PAT fino (no GitHub App, no PAT clásico)

**Decisión:** PAT fine-grained con permiso Actions Lectura+Escritura, restringido al único repo, expiración corta (≈90 días) con recordatorio de rotación, custodiado en env server-only de la route Next.js.

| Alternativa | Por qué se descarta |
|---|---|
| GitHub App | Horas de implementación (clave privada + intercambio JWT→token por llamada) sin beneficio para un solo repo y baja frecuencia; solo se justifica con multi-repo o política de org que bloquee PATs |
| PAT clásico (`repo`) | Blast radius total sobre el repo (lectura/escritura de código incluida); deuda de seguridad sin ventaja operativa |

### D2 — Formato `latest.json` y transporte existentes (no cambiar)

**Decisión:** `latest.json` mantiene `{contentVersion, manifestUrl, zipUrl, bytesTotal, files, updatedAt}` (producido en `seed-content.yml:256-261`); la app construye URLs desde `<remote>` + base pública, y `latest.json` es conveniencia/observabilidad, no fuente de verdad para SKIP (la fuente es `/api/sync/version`).

### D3 — Resume SOLO vía `savable` + guarda 206 (nunca `Range` manual)

**Decisión:** `pauseAsync()` + persistencia de `savable()` (opaco: offset en Android, blob en iOS; nunca construido a mano) + `resumeAsync()`; tras el resume, si `status !== 206`, borrar `.part` y reiniciar fresco. `downloadAsync()` sobrescribe por especificación (`FileSystem.d.ts` en `expo-file-system@18.1.11`); inyectar `Range` por esa vía concatena parcial+completo (corrupción verificada en `FileSystemModule.kt:922-950`, que hace append sin verificar status).

## 5. Forks nuevos

**Ninguno.** El research no deja preguntas abiertas que exijan bifurcación:

- PAT vs GitHub App: resuelto (D1).
- Formato de artefacto y transporte: resuelto (D2, sin cambios R2).
- Mecanismo de resume: resuelto (D3, con guarda explícita).
- `expo-web-to-native`/`expo-dom`: descartados con evidencia (research P2).

Los supuestos restantes del research (§ Supuestos 1–5: `Accept-Ranges` real del CDN, comportamiento iOS ante `Range` ignorado, política de org sobre PATs, expiración de tokens de instalación, ausencia de prueba de red) no son forks de diseño: son verificaciones operativas que la spec registra como pasos con credenciales/dispositivo, no como alternativas a decidir.

## 6. Diseño por work units

### W0 — E1 `serverTime` + test de contrato (web, prerrequisito)

- **Problema:** `src/app/api/sync/version/route.ts` responde `{ contentVersion }`; `VersionResponseSchema` (`/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db/version-gate.ts`) exige `serverTime: z.string().datetime()`. `getRemoteVersion` lanza `ZodError` contra el backend real y el seed nunca se dispara (fallo silencioso: el `catch` en `db-context.tsx` lo interpreta como offline).
- **Cambio:** emitir `serverTime` (marca temporal de publicación, fuente: `ContentVersion.updatedAt` o equivalente existente; la spec fija la fuente exacta sin agregar migraciones) junto a `contentVersion` (string canónico, herencia Fase C F0). Mantener `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` y forma de error existente.
- **Patrones (`api-design-patterns`):** cambio aditivo compatible (agregar campo, nunca renombrar); contrato con test que fija la forma; códigos existentes intactos.
- **TDD:** test RED que reproduce E1 (respuesta real parseada por `VersionResponseSchema` falla) → GREEN (emite `serverTime` válido) → test de contrato que congela `{ contentVersion: string, serverTime: datetime }`. Regresión: suite `src/app/api/sync/version/route.test.ts` en verde.

### W1 — Endpoint dispatch + botón admin + status/historial (web)

- **Endpoint:** route server-only (p. ej. `src/app/api/admin/seed/dispatch/route.ts`; la spec fija la ruta) con `requireAdmin()`. Lee PAT fino desde env server-only (nunca `NEXT_PUBLIC_*`). Valida body con Zod: `content_version?: string` (vacío = omitir), `dry_run?: boolean`. Construye `POST /repos/{owner}/{repo}/actions/workflows/seed-content.yml/dispatches` con `{ ref, inputs }`: `ref` validado contra rama permitida (allowlist, p. ej. `main`), `inputs` en allowlist estricta (`content_version`, `dry_run`; máx. 25 props por API). Cabeceras `Accept: application/vnd.github+json` + `X-GitHub-Api-Version: 2022-11-28`. Respuesta: `202`/`204` de GitHub → `202` propio con identificador de correlación; errores de GitHub mapeados a 502 con mensaje genérico (sin filtrar cuerpo).
- **Status/historial:** `GET` server-only (misma familia de rutas) que consulta `GET .../actions/workflows/seed-content.yml/runs?per_page=N` y devuelve lista mínima (id, estado, conclusión, timestamps, inputs cuando disponibles). Polling desde la UI con intervalo moderado (la spec fija segundos y `per_page`); sin webhooks en esta fase.
- **Botón admin:** en la página admin existente (misma zona que `ImportCorpusModal` en `src/app/admin/palabras/page.tsx:72`), modal en dos pasos según `ImportCorpusModal.tsx:98/125` (configurar → confirmar con `confirm-dialog.tsx`): campos `content_version` (opcional) y `dry_run` (checkbox, por defecto según spec), confirmación explícita, y vista de estado/historial con reintento de polling. Estados: idle → confirmando → despachado → observando run → éxito/fallo; error con mensaje accionable + "continuar con el flujo manual en GitHub" como escape.
- **Audit:** cada dispatch registra quién/cuándo/`{ref, inputs}` en el audit existente del admin (misma tabla/flujo que `audit-logs`).
- **Patrones (`api-design-patterns`):** secreto solo servidor; allowlist de inputs; idempotencia operativa por `content_version` (re-publicar exige versión distinta, guarda ya existente del workflow); error mínimo (401/403 genéricos heredados de `requireAdmin`, 502 sin filtrar upstream); `request_id` de correlación.
- **TDD:** tests de validación (inputs fuera de allowlist → 400; `ref` no permitido → 400; sin sesión admin → 401/403 sin llamar a GitHub — mock de `fetch`, nunca red real); test de mapeo 204→202 y de error upstream→502; test de UI de estados del modal con respuestas mockeadas.

### W2 — Notice de contenido nuevo (app, `feat/mobile-fase-d`)

- **Enganche:** extender el efecto en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db-context.tsx:222-252`. Tras `compareVersions` clasificar `remote > local` (camino `seed`), en lugar de lanzar la descarga de inmediato: exponer estado `updateAvailable { remote, bytesTotal?, files? }` (metadatos desde `latest.json`/versión remota; la spec fija la fuente exacta) y presentar aviso no bloqueante.
- **UI:** componente de aviso que reutiliza el lenguaje visual de `src/components/seed-progress.tsx` (tarjeta, botones ≥ 44pt, roles de accesibilidad `alert`/`progressbar` donde apliquen): título, detalle (versión, tamaño si disponible), acciones "Descargar ahora" y "Más tarde". La app sigue operable con texto local en todo momento; "Más tarde" pospone sin marcar versión como vista de forma destructiva (la spec fija persistencia del descarte).
- **Patrones (`react-native-patterns`):** seam existente antes que invención (gate + `SeedProgress`); estados explícitos (comprobando/disponible/descargando/error); I/O fuera del hilo JS; validación Zod en el borde de `latest.json`; sin secretos en el bundle (solo URLs públicas).
- **TDD:** tests en `vitest` sobre la máquina de estados del aviso (skip → sin aviso; `>` → aviso con metadatos; descarte → no re-aviso en la misma versión; aceptación → delega al flujo seed existente). Lo visual se verifica por snapshot/roles, no por píxeles.

### W3 — Resume real `savable` + guarda 206 + reintentos (app, `feat/mobile-fase-d`)

- **Cambio en `src/db/seed-expo.ts` (`downloadFile`, zona `:124-141`):** mantener viva la instancia `DownloadResumable`; ante interrupción/error recuperable, llamar `pauseAsync()` y persistir `savable()` (`{url, fileUri, options, resumeData}`) en kv (`piiyaak:seedDownload:<N>` extendida o clave hermana — la spec fija el nombre y el esquema). Al reintentar con registro vigente + `supportsResume(zipUrl)` verdadero: `createDownloadResumable(url, partUri, mismasOptions, cb, resumeData)` + `resumeAsync()`.
- **Guarda 206 (obligatoria):** leer `result.status`/`headers` del resume; si no es `206` (servidor ignoró el rango), borrar el `.part` y reiniciar fresco sin `resumeData`. Misma guarda en iOS por paridad aunque `NSURLSession` valide nativamente.
- **Casos que quedan como re-descarga (correcto, documentar):** sin `resumeData` persistido, `resumeData` inválido/expirado, `supportsResume` falso, cambio de `contentVersion` (el `.part` ajeno se borra por diseño).
- **Reintentos:** acotados con backoff (la spec fija N y delays consistentes con `fetchWithRetry` existente en `src/db/sync.ts`), solo ante errores recuperables de red; errores de verificación/integridad no reintentan resume (reinicio fresco o fallo explícito).
- **Prohibición explícita:** NUNCA `Range` manual en `downloadAsync` (corrupción por sobrescritura, research P3.1).
- **Patrones (`react-native-patterns` + TDD):** envolver el SDK en una función pura testeable en Node (la decisión resume-vs-fresco dado `{resumeData, status, supportsResume}` vive en lógica pura; el adaptador `expo-file-system` queda como borde fino). Tests RED→GREEN: resume continúa con 206; 200 tras resume → truncado + reinicio; sin `resumeData` → descarga fresca; `contentVersion` distinto → `.part` ajeno eliminado.
- **TDD:** tests de la decisión pura + tests de persistencia del registro (serialización de `savable()` opaco sin interpretarlo). Lo nativo (descarga real, `pauseAsync` en dispositivo) se declara no cubierto por unitarios (§9).

### W4 — Runbook + E2/E3 + eslint mínimo (web + app)

- **Runbook (web, `DEPLOY.md` del change o extensión del existente):** dónde viven `keystore` y `versionCode` (EAS credentials, nunca repo), cómo rotan, qué NUNCA se commitea; procedimiento de primera corrida real (`workflow_dispatch` con `dry_run=true` → revisión de logs → `dry_run=false`), verificación (`curl` de `manifest.json` + `latest.json` con `jq` de `bytesTotal`/`files`; `GET /api/sync/version` vs `latest.json`); recordatorio de rotación del PAT (≈90 días) y qué hacer si la org bloquea PATs finos (migrar a GitHub App, D1).
- **E2 (web):** fijar definición canónica única de `bytesTotal` (recomendación: `dbBytes + Σ files.size` del `manifest.json`, coherente con `bundle-builder.ts:537`; `latest.json` la replica sin recalcular) y cubrir con test que falla ante divergencia entre `manifest.json` y `latest.json`.
- **E3 (web):** deduplicar pasos/guardas repetidas en `seed-content.yml` (pasos 8–11) sin cambiar semántica; verificación por diff revisado + dry-run en CI.
- **eslint mínimo (app):** agregar configuración mínima (`eslint` + `eslint-config-expo` o equivalente fijado por spec) y script `lint`; alcance: archivos tocados por W2/W3; cero reformateo masivo del repo.

## 7. Riesgos

| # | Riesgo | Impacto | Mitigación en este change |
|---|---|---|---|
| R1 | PAT filtrado (env expuesto, log accidental, commit erróneo) | Atacante dispara `seed-content.yml` (gasta minutos de Actions; con `dry_run=false` puede publicar `latest.json`/`seed/<N>`) | Env server-only (nunca `NEXT_PUBLIC_*`); sin eco del token en logs ni errores; allowlist de inputs; audit de cada dispatch; expiración corta + rotación documentada; el workflow conserva guarda anti-sobrescritura y SKIP por `latest.json` |
| R2 | Append ciego en resume (servidor responde 200 al `Range` y el nativo Android concatena) | Zip corrupto adoptado como semilla | Guarda `status === 206` obligatoria antes de continuar; si no, truncado + reinicio fresco; verificación `dbSha256`/conteos previa al swap (herencia Fase C) impide adoptar corrupto |
| R3 | CDN/R2 no honra `Range` (`Accept-Ranges` ausente o 200 persistente) | Resume imposible; re-descargas completas siempre | Degradación diseñada: reinicio limpio correcto; `supportsResume` (HEAD `accept-ranges: bytes`) decide la vía; verificado en dispositivo contra CDN real (§9, fuera de CI) |
| R4 | E1 silencioso (o su recurrencia): `ZodError` tragado por el `catch` "offline" | Seed/notice nunca se disparan sin señal visible | W0 como prerrequisito no opcional + test de contrato que congela la forma; log estructurado ante fallo de parseo (distinguir "sin red" de "contrato roto") |
| R5 | Dispatch accidental o doble (doble clic, reintento de UI) | Runs duplicados, gasto de minutos, posible publicación redundante | Confirmación explícita (`ConfirmDialog`); botón deshabilitado durante dispatch; idempotencia operativa por `content_version`; `concurrency.group: seed-content` ya existente en el workflow |
| R6 | Polling agresivo de runs (rate limit GitHub) | 403/429, historial caído | Intervalo moderado + `per_page` acotado fijados en spec; backoff ante 429; estado en caché breve del lado servidor si la spec lo exige |
| R7 | Aviso intrusivo o confuso en la app | Usuario bloqueado o que ignora actualizaciones reales | Aviso no bloqueante, descartable por versión, accesible (`alert`), texto en el idioma del proyecto; el diccionario sigue utilizable sin descargar |

## 8. Plan por fases (W0 → W4, ~18-22h, TDD obligatorio)

> Cada work unit sigue RED → GREEN → refactor. Sin test failing previo no hay código de producción. Orden secuencial: W0 desbloquea el contrato; W1 crea el disparo; W2 lo anuncia; W3 lo descarga con resume; W4 lo opera y salda erratas. W2/W3 viven en `feat/mobile-fase-d`; W0/W1/W4(web) en `feat/fase-d-auto`.

1. **W0 — E1 `serverTime` (~2h).** Tests RED (contrato roto contra schema app) → emitir `serverTime` en `GET /api/sync/version` → refactor. Gate: `getRemoteVersion` contra backend real deja de lanzar `ZodError`; suite de versión en verde.
2. **W1 — Dispatch admin (~7h, bloque web mayor).** Suborden: (i) endpoint dispatch + tests de validación/audit; (ii) status/historial + tests de mapeo; (iii) botón admin (patrón `ImportCorpusModal` + `ConfirmDialog`) + tests de estados. Gate: dispatch mockeado → 202 + audit; polling mockeado → historial; sin sesión admin → 401/403 sin llamada a GitHub.
3. **W2 — Notice app (~4h).** Estado `updateAvailable` + aviso no bloqueante (patrón `SeedProgress`) + tests de máquina de estados. Gate: `remote > local` muestra aviso sin bloquear texto; descarte no re-avisa en la misma versión.
4. **W3 — Resume real (~5h, bloque móvil mayor).** Decisión pura resume-vs-fresco + guarda 206 + persistencia `savable()` + reintentos; tests en Node sin nativo. Gate: matriz de decisión en verde (206→continúa; 200→reinicio limpio; sin registro→fresco; versión distinta→limpia `.part` ajeno).
5. **W4 — Runbook + E2/E3 + eslint (~2-3h).** Definición canónica `bytesTotal` + test; deduplicación `seed-content.yml` + dry-run; runbook `keystore`/`versionCode`/primera corrida; eslint mínimo app. Gate: `tsc --noEmit` en ambos repos → 0 errores; `lint` en archivos tocados → limpio; diff del workflow sin cambio semántico.

**Esfuerzo total estimado: ~18-22h** (W0 ~2h + W1 ~7h + W2 ~4h + W3 ~5h + W4 ~2-3h). Presupuesto de líneas: web ~300-500 + tests; app ~200-400 + tests. Supone PAT y R2 accesibles solo en el paso operativo documentado; sin cambios de SDK ni migraciones.

## 9. Criterios de aceptación (verificables)

Verificable sin credenciales ni dispositivo (CI / máquina de desarrollo):

- [ ] W0: `GET /api/sync/version` emite `{ contentVersion: string, serverTime: datetime }`; el cuerpo real es aceptado por `VersionResponseSchema` de la app; suite `route.test.ts` extendida en verde.
- [ ] W1: sin sesión admin → 401/403 sin llamada a GitHub (verificado con mock de `fetch`); inputs fuera de allowlist o `ref` no permitido → 400; dispatch mockeado 204 → 202 propio + registro en audit; polling mockeado → lista de runs con estados; modal admin cubre idle/confirmando/despachado/error.
- [ ] W2: tests `vitest` — `remote == local` sin aviso; `remote > local` con aviso y metadatos; descarte sin re-aviso en la misma versión; aceptación delega al flujo seed sin regresión del gate.
- [ ] W3: tests de decisión pura — con `resumeData` + 206 continúa; con 200 trunca y reinicia; sin `resumeData` descarga fresca; `contentVersion` distinto elimina `.part` ajeno; `savable()` se persiste y restaura sin interpretar el opaco. Ningún código envía `Range` manual por `downloadAsync` (verificable por grep + test).
- [ ] W4: test E2 — `latest.json.bytesTotal` igual a la definición canónica del `manifest.json`; diff E3 sin cambio semántico (mismos `if` efectivos); `eslint` ejecuta en la app sobre archivos tocados sin errores nuevos.
- [ ] `tsc --noEmit` (ambos repos) → 0 errores; `lint` en archivos tocados → sin pelea de estilo.

Requiere credenciales/dispositivo físico (se declara explícito, NO simulable en CI; queda como pasos operativos del runbook, no ejecutados en este change):

- [ ] Dispatch real contra GitHub (`workflow_dispatch` con PAT fino) → 204 y run visible en Actions; polling real devuelve el run; `dry_run=true` no publica.
- [ ] URL pública del seed vía CDN responde `Accept-Ranges: bytes` y `206` ante `Range` (verificar en dispositivo físico; si es `false`, el contrato degrada a re-descarga limpia por diseño).
- [ ] Interrupción real de descarga (modo avión a mitad) → reanudación por bytes con progreso correcto; servidor que ignora `Range` → reinicio limpio sin corrupción.
- [ ] Aviso de contenido nuevo en dispositivo con red real + primera corrida del workflow publicando `seed/<N>/` + `latest.json` coherente con `/api/sync/version`.
- [ ] Comportamiento iOS cuando el servidor ignora el `Range` en un resume (error nativo esperado → reinicio fresco; confirmar en dispositivo).

## 10. Trazabilidad de skills

- `api-design-patterns` (inyectada, `/home/mario/.agents/skills/api-design-patterns/SKILL.md`): cambio aditivo en W0, secreto server-only + allowlist de `inputs` + `ref` validado en W1, mapeo 204→202 y 502 sin filtrar upstream, polling acotado, audit de cada dispatch. Aplicada en §6 (W0/W1) y R1/R5/R6.
- `react-native-patterns` (inyectada, `/home/mario/.pi/agent/skills/react-native-patterns/SKILL.md`): reutilizar seams (`db-context.tsx` gate, `SeedProgress`, `compareVersions`, Zod en el borde), estados explícitos del aviso, I/O nativo fuera del hilo JS, sin secretos en el bundle, persistencia de `savable()` opaco. Aplicada en §6 (W2/W3) y R2/R3/R7.
- `test-driven-development-tdd` (inyectada, `/home/mario/.pi/agent/skills/test-driven-development-tdd/SKILL.md`): ciclo RED → GREEN → refactor por cada contrato, endpoint, estado de aviso y rama de decisión de resume; verificación RED antes de implementar; criterio "sin test failing previo no hay código". Aplicada en §8 y §9.
- Evidencia base: research vinculante del change (P1–P3, supuestos 1–5) + lectura directa en esta sesión de `.github/workflows/seed-content.yml` (inputs, pasos 8–11, `latest.json:256-261`), `src/components/admin/ImportCorpusModal.tsx:98/125`, `src/components/admin/confirm-dialog.tsx`, `src/app/api/sync/version/route.ts` + `route.test.ts`, `src/lib/seed/bundle-builder.ts:537`, y en la app (`/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/...`): `src/db-context.tsx:222-252`, `src/db/seed-expo.ts:124-141`, `src/db/version-gate.ts:59`, `src/db/sync.ts`, `src/components/seed-progress.tsx`, `package.json` (sin eslint).

## 11. Pendientes para `spec.md` (next_recommended)

1. Generar `openspec/changes/apk-offline-fase-d-auto/spec.md`: firma exacta del endpoint dispatch (ruta, schemas Zod, allowlist de `ref`, `per_page`/intervalo de polling), del modal admin (pasos, textos, estados), del aviso app (fuente de metadatos, persistencia del descarte, textos), del resume (nombre de clave kv, N de reintentos y delays, lectura de `status`/`headers`), y definición canónica de `bytesTotal`.
2. Fijar en spec: fuente de `serverTime` en W0 (sin migraciones), `content_version` vacío = omitir vs enviar vacío, `dry_run` por defecto, y alcance exacto del `eslint` mínimo (reglas y archivos).
3. Definir `tasks.md` con los tests TDD por work unit en el orden del plan §8; registrar D1/D2/D3 en engram cuando el runtime lo exponga.
