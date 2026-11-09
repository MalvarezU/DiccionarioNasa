# Research — `apk-offline-fase-d-auto`

Fecha: 2026-11-09. Solo lectura: docs oficiales + código instalado. Sin cambios de código.

Versiones exactas verificadas en este entorno:

| Paquete | Versión instalada | Fuente |
|---|---|---|
| `expo-file-system` (app) | 18.1.11 | `piiyaak-app/node_modules/expo-file-system/package.json` |
| `expo` | 52.0.49 | `piiyaak-app/node_modules/expo/package.json` |
| `expo-router` | 4.0.22 | `piiyaak-app/node_modules/expo-router/package.json` |
| `react-native` | 0.76.9 | `piiyaak-app/node_modules/react-native/package.json` |
| `expo-sqlite` | 15.2.14 | `piiyaak-app/node_modules/expo-sqlite/package.json` |
| `react-native-zip-archive` | 9.5.3 | `piiyaak-app/node_modules/.../package.json` |
| `zod` | 4.6.7 | idem |
| `next` (backend) | 16.1.3 | `Diccionario-endpoints/node_modules/next/package.json` |
| `@aws-sdk/client-s3` (backend) | 3.1154.0 | `Diccionario-endpoints/node_modules/@aws-sdk/client-s3/package.json` |

Docs oficiales consultadas: GitHub REST API "Create a workflow dispatch event" y "Permissions required for GitHub Apps" (API version 2022-11-28), "Managing your personal access tokens", Expo SDK `FileSystem` (página vigente, con sección "Using legacy FileSystem API"), Cloudflare R2 "Extensions". Código nativo inspeccionado: `FileSystemModule.kt` (Android) y `FileSystemModule.swift` + `EXSessionResumableDownloadTaskDelegate.m` (iOS) dentro de `expo-file-system@18.1.11` instalado.

---

## P1 — PAT fino vs GitHub App para `workflow_dispatch` server-side

Endpoints en juego: `POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches` (body `{ref, inputs}`; `ref` requerido, `inputs` máx. 25 props) y `GET /repos/{owner}/{repo}/actions/workflows/{id}/runs` o `GET .../actions/runs/{run_id}` para estado.

### Tabla comparativa

| Dimensión | PAT fino (fine-grained) | GitHub App | PAT clásico (referencia, no recomendado) |
|---|---|---|---|
| Permiso mínimo, dispatch | Repository permission **Actions: Lectura y escritura** sobre el repo (el endpoint exige acceso `write` según tabla oficial de permisos) | Repository permission **Actions: Lectura y escritura** en la instalación (misma tabla: `dispatches` → `write`, UAT/IAT) | Scope `repo` (literal del endpoint en docs: "need the `repo` scope") |
| Permiso mínimo, polling de runs | Incluido en Actions: Lectura | Incluido en Actions: Lectura | Incluido en `repo` |
| Alcance del secreto | Un repo (o lista cerrada), solo permiso Actions si así se configura | Solo repos donde la App está instalada, solo permiso Actions | **Todos** los repos del usuario + todo lo que cubre `repo` (lectura/escritura de código incluida) |
| Dónde se custodia | Env server-only de la route Next.js (nunca `NEXT_PUBLIC_*`; en Vercel, variable de entorno del proyecto) | Clave privada de la App (server-only) + token de instalación efímero obtenido en la route vía `POST /app/installations/{id}/access_tokens` | Igual que PAT fino, pero con mayor blast radius |
| Rotación | Manual: expiración configurable (hasta 366 días o política de org), regenerar + actualizar env. Límite conocido: 50 tokens finos por usuario | Automática en la práctica: los tokens de instalación son de corta duración (confirmar valor exacto en docs de Apps al implementar) y se emiten por llamada; la clave privada rota en settings de la App | Manual, expiración recomendada; GitHub elimina los sin uso de 1 año |
| Si se filtra | El atacante solo puede operar Actions del repo permitido: disparar `seed-content.yml` (gasta minutos de Actions; el workflow tiene guarda anti-sobrescritura y SKIP por `latest.json`, pero un dispatch malicioso con `dry_run=false` puede publicar `latest.json`/`seed/<N>`). Revocación: Settings → Tokens, inmediata | Peor caso: con la clave privada, el atacante emite tokens para **todas** las instalaciones (todos los repos). Revocación: regenerar clave en la App. Con solo un token de instalación filtrado, el daño expira solo | El atacante obtiene control total del repo (código, secrets vía workflows maliciosos, etc.). No usar |
| Costo / complejidad operativa | Minutos: crear token, pegar en env, `fetch` directo con `Bearer` | Horas: crear App, instalarla, custodiar clave privada, implementar intercambio JWT→token en la route (dependencia JWT + código extra), gestionar expiración en cada llamada | Minutos, pero deuda de seguridad |

### Recomendación

**PAT fino con permiso Actions: Lectura y escritura, restringido al único repo, expiración corta (p. ej. 90 días) con recordatorio de rotación.**

Justificación para este caso (un admin dispara builds de contenido, baja frecuencia, un solo repo):

1. Es el mínimo privilegio alcanzable sin código extra: el token no puede leer ni escribir código (no se otorga `Contents`), solo operar Actions del repo permitido.
2. Complejidad casi nula en la route: un `fetch` con `Authorization: Bearer` + `Accept: application/vnd.github+json` + `X-GitHub-Api-Version`, sin intercambio de tokens ni custodia de clave privada.
3. La GitHub App solo se justifica si aparece multi-repo, necesidad de rotación automática, o una política de org que bloquee PATs. Migrar después es compatible (mismo permiso Actions, cambia solo la emisión del token).

Notas de implementación (para la propuesta): validar `ref` contra rama permitida, allowlist de `inputs` (`content_version`, `dry_run`), y registrar cada dispatch (quién/cuándo/inputs) en el audit existente del admin.

---

## P2 — ¿Sirve `expo-web-to-native` (o `expo-dom`) para algo de Fase D?

**No. La Fase D app es nativa pura; no hay reutilización web→nativo real.**

Evidencia (código instalado):

- `src/components/seed-progress.tsx` es React Native puro (`View`, `Text`, `TouchableOpacity`, `StyleSheet`; `src/db/seed-machine.ts` es lógica pura testeable en Node). Clonar el banner es copiar un componente RN a otro componente RN: no hay DOM ni webview involucrado.
- `src/db/seed-expo.ts` importa `expo-file-system`, `expo-sqlite` y `react-native-zip-archive`; su propia cabecera prohíbe importarlo desde tests Node ("SOLO dispositivo"). Son módulos nativos sin equivalente web.
- `expo-dom` (`'use dom'`) sirve para: correr código web verbatim en `WKWebView`/`WebView`, usar librerías solo-web (charts, syntax highlighters), iframes/embeds, canvas/WebGL. Nada de eso aparece en Fase D: no hay charts, no hay HTML/CSS heredado, no hay embed. Pasar la descarga por un webview obligaría a puentear `FileSystem`/`SQLite` como props async al contexto aislado del webview: más latencia, más superficie de fallo, cero beneficio.
- `expo-web-to-native` presupone **una app web React existente que migrar** (shell nativo + strangler por pantallas). `piiyaak-app` ya es nativa (`expo-router`, `app.json` sin target web, scheme `piiyaak`, plugins `expo-router` + `react-native-zip-archive`). No hay nada que migrar.
- Lo único aplicable del skill es su paso 5 como patrón ya vigente, no como trabajo: el backend (Next.js en `Diccionario-endpoints`) **se queda desplegado** y la app nativa es cliente HTTP (`GET /api/sync/version`, URLs R2 públicas). Eso ya es la arquitectura actual, no requiere `expo-dom`.

Respuesta explícita: **qué se reutiliza: nada de código web→nativo.** El banner reutiliza el patrón visual de `SeedProgress` (componente RN) y la descarga reutiliza los endpoints/URLs existentes. `expo-web-to-native` y `expo-dom` no entran en la propuesta de Fase D.

---

## P3 — ¿Soporta `expo-file-system@18.1.11` (legado) reanudación real?

**Sí, pero solo por la vía `pauseAsync() → savable() → resumeAsync()`. La implementación actual de `seed-expo.ts` no la usa: hoy toda re-descarga es completa.**

### Lo verificado en el código instalado

1. `downloadAsync(uri, fileUri, options?)` — docstring literal en `build/FileSystem.d.ts`: *"If there is a file at this URI, its contents are replaced."* **Sobrescribe, no continúa.** `DownloadOptions` acepta `headers` (verificado en `build/FileSystem.types.d.ts`), pero enviar `Range` manualmente por esta vía es incorrecto: la respuesta 206 parcial **reemplazaría** el archivo → corrupción. No es una vía de resume.
2. `createDownloadResumable(uri, fileUri, options?, callback?, resumeData?)` + `resumeAsync()` — reanudación real:
   - Android (`FileSystemModule.kt:626-703`): si `resumeData != null`, agrega `Range: bytes=<offset>-` al request y abre `FileOutputStream(file, isResume)` (append solo al reanudar; trunca en descarga fresca). Progreso con offset incluido. `downloadResumablePauseAsync` cancela y devuelve `resumeData = file.length().toString()`.
   - iOS (`FileSystemModule.swift:207-252`): `downloadTask(withResumeData:)` + `cancelByProducingResumeData()` — resume nativo de `NSURLSession`.
   - Persistencia entre reinicios: `savable()` devuelve `DownloadPauseState {url, fileUri, options, resumeData}` (serializable; docs: guardar en `AsyncStorage` — aquí correspondería la kv existente `piiyaak:seedDownload:<N>` extendida o una clave hermana).
3. Estado actual (`seed-expo.ts:124-139`): `createDownloadResumable(url, partUri, {}, cb)` + `downloadAsync()`, **sin `resumeData`**. `_opts.offset` se ignora (coincide con el WARNING W-2 de los reportes de Fase C). El HEAD `accept-ranges` de `supportsResume` solo decide conservar o borrar el `.part`; en ambos casos los bytes se re-descargan al 100 %.

### Implementación concreta que permite resume real

1. Mantener viva la instancia `DownloadResumable` durante la descarga; ante interrupción llamar `pauseAsync()` y persistir `savable()` (incluye `resumeData` opaco: en Android es el offset como string, en iOS es blob base64 de `NSURLSession` — **nunca construirlo a mano ni guardar solo el tamaño**).
2. Al reintentar, si hay registro + `resumeData` + `supportsResume(zipUrl)` sigue verdadero: `createDownloadResumable(url, partUri, mismasOptions, cb, resumeData)` + `resumeAsync()`.
3. **Gotcha crítico encontrado en el nativo Android** (`downloadResumableTask`, `FileSystemModule.kt:922-950`): el código hace append **sin verificar el status HTTP**. Si el servidor ignora el `Range` y responde `200` con el contenido completo, el archivo resultante sería parcial+completo concatenados (corrupto). Por tanto Fase D debe: leer `result.status`/`headers` del resume; si no es `206` (o el servidor no honra el rango), **borrar el `.part` y reiniciar fresco sin `resumeData`**. (En iOS `NSURLSession` valida el resume nativamente, pero la guarda debe existir igual por paridad.)
4. Lado servidor R2: **no se necesita nada nuevo.** `GetObjectCommand` acepta `Range` (`models_0.d.ts:9738`, `@aws-sdk/client-s3@3.1154.0`, API S3-compatible que R2 implementa) y la app descarga por **URL pública CDN** (Cloudflare sirve rangos HTTP estándar), no por `getObjectBytes` (esa firma es para lecturas completas en build-time/backfill: hash sha256 — queda intacta). Lo único que se mantiene es el gate `supportsResume` (HEAD `accept-ranges: bytes`); su comportamiento real a través del CDN debe confirmarse en dispositivo (ver supuestos).

### Qué queda como re-descarga

- Todo reintento sin `resumeData` persistido (primera versión de Fase D si se implementa por etapas, o `resumeData` inválido/expirado).
- Servidores/CDN que no honren `Range` (tras la guarda del punto 3: reinicio limpio, correcto pero completo).
- Cambio de `contentVersion` (registro de otro `<N>`): el `.part` ajeno se borra por diseño — correcto.

---

## Supuestos restantes explícitos (no verificables sin credenciales/dispositivo)

1. Que la URL pública del seed (`R2_PUBLIC_BASE_URL/seed/<N>/piiyaak-seed.zip` vía CDN) responde `Accept-Ranges: bytes` y `206` a `Range` — verificar en dispositivo físico contra el CDN real (el HEAD de `supportsResume` lo dirá en runtime; el contrato debe degradar a re-descarga limpia si es `false`).
2. Comportamiento iOS cuando el servidor ignora el `Range` en un resume (error nativo esperado → reinicio fresco; confirmar en dispositivo).
3. Repo `Diccionario-endpoints`: público o privado, y política de org sobre PATs (si la org bloquea PATs finos, la recomendación cae a GitHub App — confirmar antes de la propuesta).
4. Expiración exacta de tokens de instalación de GitHub Apps y cuota de Actions/minutos del plan (coste de dispatches maliciosos o accidentales).
5. Sin credenciales R2/GitHub en este entorno no se ejecutó ningún dispatch ni descarga real; toda afirmación de red es por docs/código, no por prueba.
