# Spec: apk-offline-fase-c-seed — Robot de semilla + APK auto-actualizable

- **Change ID:** `apk-offline-fase-c-seed`
- **Estado:** spec (cierra los 3 pendientes del proposal §11; previo a `tasks.md`)
- **Ramas:** web `feat/fase-c-seed` (este repo) · app `feat/mobile-fase-c` (`/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app`)
- **Idioma del spec:** español neutral/profesional. Identificadores, claves y código: English.
- **Decisiones del research y del proposal que este spec NO reabre:** D1 (zip), D2 (descarga R2 en primer arranque), D3 (sin downgrade), P1 (`react-native-zip-archive` v9), P4 (transporte). Este spec solo fija firmas, formatos y pasos.

## 0. Convenciones

- `contentVersion` canónico: **string** de entero decimal (`/^\d+$/`). Toda comparación de orden se hace sobre `parseInt` validado; toda igualdad (SKIP) sobre el string.
- `sha256` siempre en minúsculas, hex de 64 (`/^[0-9a-f]{64}$/`).
- Tamaños en bytes, enteros no negativos. Fechas ISO-8601 UTC con `Z`.
- Códigos de salida del generador W1: `0` ok · `2` divergencia de versión (foto no atómica) · `3` incoherencia de medios (faltante en R2, hash distinto, `mimeType` desconocido) · `4` infraestructura (R2 caído, red, disco).
- Todo secreto viaja solo en encabezado o variable de entorno. Nunca en query string, nunca en logs, nunca en artefactos.

## 1. F0 — Tipo canónico de `contentVersion` (firma exacta)

### 1.1 Lado web: serializar `String(version)` en el borde

`getContentVersion(): Promise<number>` (`src/lib/content-version.ts`) NO cambia: el entero sigue siendo el tipo interno y atómico de la BD. El cambio es solo de serialización en las 4 rutas que emiten `contentVersion`:

- `GET /api/sync/version`
- `GET /api/sync/seed`
- `GET /api/sync`
- `GET /api/sync/full`

Cada ruta responde `"contentVersion": String(version)`. Es aditivo en la práctica: ningún consumidor válido operaba aritmética sobre el entero (la app lo rechazaba con `ZodError`).

Tests web (actualizar existentes, p. ej. `route.test.ts`): `expect(body.contentVersion).toBe("41")` y `typeof body.contentVersion === "string"` en las 4 rutas.

### 1.2 Lado app: coerción tolerante en el borde, escritura canónica

En `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db/version-gate.ts`:

```ts
export const VersionResponseSchema = z.object({
  contentVersion: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
    .transform((v) => String(v)),
  serverTime: z.string().datetime(),
});
```

Reglas:

1. La lectura es tolerante (acepta string canónico o number legacy); la escritura en `kv` (`piiyaak:contentVersion`, `TEXT`) es siempre el string canónico.
2. `getRemoteVersion` conserva firma y comportamiento salvo el schema.
3. `export-db.py:110` funciona sin cambios (`isinstance(..., str)` pasa con el backend nuevo).
4. `sync.ts:165` (igualdad exacta para SKIP) no cambia: compara strings canónicos.

### 1.3 Comparador solo-adelante (definido aquí, implementado en W3)

```ts
export type VersionMove =
  | { action: "skip" }                        // remote == local
  | { action: "seed"; remote: string }        // remote > local, o local ausente/inválido
  | { action: "noop"; reason: string };       // remote < local

export function compareVersions(local: string | null, remote: string): VersionMove;
```

- `remote` que no cumple `/^\d+$/` → `throw` (nunca seed con versión ilegible).
- `local` ausente o que no cumple `/^\d+$/` → `{ action: "seed" }` (dispositivo sin gate es dispositivo desactualizado).
- Comparación numérica sobre `parseInt(v, 10)`; igualdad sobre el string.
- `remote < local` → no-op (D3): se mantiene local, se registra `console.warn` estructurado con ambas versiones, sin bloquear la UI. Causas típicas: fila `ContentVersion(id=1)` recreada, restore de BD. Requiere intervención manual (runbook en `DEPLOY.md`, R12).

## 2. W1 — Generador `scripts/build-content-bundle.ts` (web)

### 2.1 Decisión de lenguaje: script TypeScript con `bun` (nuevo archivo, NO extender `export-db.py`)

Se crea `scripts/build-content-bundle.ts`, ejecutado como `bun run scripts/build-content-bundle.ts` (convención `bun run` de `package.json`). La lógica pura y testeable vive en `src/lib/seed/bundle-builder.ts`; el script es un envoltorio CLI delgado.

Justificación (cierra pendiente §11.1):

1. Reutiliza sin duplicar `getObjectBytes` (`src/lib/r2.ts`), `collectMediaRefs` / `refsToKeys` / `missingMediaKeys` (`src/lib/sync/full-bundle.ts`) y `publicUrl`. Extender `export-db.py` (Python stdlib, en el repo de la app, con auth por cookie de sesión y paginado de `/api/sync/seed`) obligaría a reimplementar en Python el manifiesto por referencias y la verificación R2, creando dos fuentes de verdad para la misma derivación bundle → claves.
2. `bun:sqlite` está integrado sin dependencias nuevas; el job CI ya instala este repo.
3. `export-db.py` queda intacto como generador legacy de solo-texto en la app; no se toca código móvil desde este change web.

### 2.2 Firma del generador

```
bun run scripts/build-content-bundle.ts --out <dir> [--api-base <url>] [--expect-version <N>]
```

- Env requerido: `CI_SYNC_SECRET`, `SEED_API_BASE` (default `https://diccionario-nasa-liart.vercel.app`), credenciales R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`).
- `--expect-version <N>`: si se indica y difiere del remoto, aborta (código 2) antes de descargar. Lo usa W2 para re-publicación dirigida.
- Salida en `<out>/`: `piiyaak.db`, `media/<sha256>.<ext>`, `manifest.json`, y el zip `piiyaak-seed.zip` (nombre fijo, §2.6).

Pasos ordenados (todo-o-nada; cualquier fallo → sin artefacto parcial, código 2/3/4):

1. `GET <api-base>/api/sync/version` (sin auth, público) → `cvPre` (string; F0). Si no cumple `/^\d+$/` → aborta (código 4).
2. `GET <api-base>/api/sync/full` con `X-CI-Secret: $CI_SYNC_SECRET` → bundle. `bundle.contentVersion` (string; F0) debe ser `=== cvPre`; si no, aborta (código 2, bump durante el inicio).
3. Derivar claves: `collectMediaRefs({words, courses, lessonBlocks})` → `refsToKeys(...)` → `keys`. Coherencia con `missingMediaKeys(keys, media)`; si no es vacío → aborta (código 3). El bundle ya filtra `sha256 NOT NULL`; este chequeo lo confirma del lado generador.
4. Construir `piiyaak.db` (bun:sqlite) según §2.3–§2.4.
5. Por cada item de `media[]`: `getObjectBytes(objectKey)`; `null` → aborta (código 3). Verificar `sha256(bytes) === item.sha256.toLowerCase()`; distinto → aborta (código 3). Escribir `media/<sha256>.<ext>` con extensión de la tabla §2.5; `mimeType` fuera de la tabla → aborta (código 3, nunca adivinanza silenciosa).
6. Re-leer `GET /api/sync/version` → `cvPost`; si `cvPost !== cvPre` → aborta (código 2, foto no atómica), borra `<out>`.
7. Calcular `dbSha256`, conteos y bytes; emitir `manifest.json` (§2.6); empaquetar zip ordenado determinista; auto-verificar: reabrir el zip, `PRAGMA integrity_check` sobre la db extraída en memoria, comparar conteos y `dbSha256`.

### 2.3 Esquema de la db extendida (fuente única + test de paridad)

El DDL generado debe ser idéntico en tablas y columnas al `SCHEMA` de `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db/sqlite-store.ts:13-89` (que ya contiene `words`, `kv`, `courses`, `modules`, `lessons`, `course_progress`, `outbox`, `history`, `media_manifest`). Reglas:

- El generador crea las tablas de **contenido** (`words`, `courses`, `modules`, `lessons`, `media_manifest`, `kv`) y las tablas de **usuario** (`course_progress`, `outbox`, `history`) **vacías** (existen para que el swap con `ATTACH` de W3 copie sin migraciones).
- `kv` inicial: `piiyaak:contentVersion = <canónico>` y `schemaVersion = "4"`. NO se escribe `piiyaak:lastSync`: `/api/sync/full` no emite `serverTime`; `lastSync` lo adopta W3 vía `setLocalVersion` con el `serverTime` de `/api/sync/version`.
- **Sin bump de `schemaVersion`** (decisión §11.2): el generador no diverge del `SCHEMA` de la app, por lo que `schemaVersion` permanece `"4"`. Test de paridad obligatorio: el test compara `PRAGMA table_info(<t>)` de la db generada contra la lista esperada derivada del `SCHEMA` de la app para las 9 tablas; cualquier divergencia (columna agregada/renombrada) falla el test y exige bump documentado antes de publicar.

### 2.4 Mapeo campo por campo bundle → sqlite

| Origen (bundle) | Destino | Notas |
|---|---|---|
| `words[]` | `words` | Mapeo 1:1 de `export-db.py:149-168` (incluye `spanish_norm`, `nasaYuwe_norm` por `normalize`). `examples`: si llega objeto, `JSON.stringify`; si string, tal cual. Solo PUBLISHED (el bundle ya filtra). |
| `courses[]` (sin `stats`, sin `deletedAt`) | `courses(id, title, description, status, coverImage, sequential→INTEGER 0/1, updatedAt)` | `createdAt` del bundle NO se persiste (no existe la columna). |
| `course.modules[]` | `modules(id, courseId, title, "order")` | Solo `deletedAt: null` (el bundle ya filtra). |
| `module.lessons[]` | `lessons(id, moduleId, title, "order", lessonNumber→TEXT, content→TEXT)` | `content` crudo serializado (`JSON.stringify` si es objeto; documento corrupto viaja igual, E5). `lessonNumber` numérico del bundle se guarda como TEXT (la columna es TEXT). |
| `media[]` | `media_manifest(word_id, kind, url, sha256, local_uri)` | `word_id`: sintético `media:<objectKey>` (el manifiesto del seed es por archivo, no por palabra; la PK `(word_id, kind)` admite sufijo de kind si un `objectKey` apareciera en ambos kinds). `url`: `item.url` (pública). `local_uri`: `media/<sha256>.<ext>` en minúsculas, idéntico al layout del zip. `kind`: derivado del prefijo de `mimeType` (`audio/*`→`audio`, `image/*`→`image`). |

### 2.5 Descarga de medios y tabla cerrada de extensiones

- Descarga con `getObjectBytes(objectKey)` (`src/lib/r2.ts:105-118`): `null` (NoSuchKey/NotFound) → código 3; otros errores se propagan → código 4.
- Nombre: `<sha256 en minúsculas>.<ext>`, extensión SOLO de esta tabla (por `mimeType` exacto, case-insensitive):

| `mimeType` | `ext` |
|---|---|
| `audio/mpeg` | `mp3` |
| `audio/mp4`, `audio/x-m4a` | `m4a` |
| `audio/aac` | `aac` |
| `audio/ogg` | `ogg` |
| `audio/opus` | `opus` |
| `audio/wav`, `audio/x-wav` | `wav` |
| `audio/webm` | `webm` |
| `image/jpeg` | `jpg` |
| `image/png` | `png` |
| `image/webp` | `webp` |
| `image/gif` | `gif` |
| `image/avif` | `avif` |

- `mimeType` fuera de la tabla → fallo explícito (código 3) con el `objectKey` en el mensaje. Nunca se deriva extensión de la URL ni se adivina.
- Nota de compatibilidad: la app histórica deriva extensión por URL (`fileNameFor`). Para no acoplar el seed a esa heurística, W3 localiza medios del seed por **stem `sha256`** ignorando extensión (§4.5, paso 7).

### 2.6 `manifest.json` (formato exacto), zip y layout R2

`manifest.json` (raíz del zip y publicado suelto en R2 para SKIP barato):

```json
{
  "format": "piiyaak-seed/1",
  "contentVersion": "41",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "dbSha256": "<hex64 minúsculas>",
  "dbBytes": 12345,
  "zipBytes": 67890,
  "files": [
    {
      "objectKey": "audios/w1.mp3",
      "sha256": "<hex64 minúsculas>",
      "size": 123,
      "mimeType": "audio/mpeg",
      "localPath": "media/<sha256>.mp3"
    }
  ],
  "counts": { "words": 1, "courses": 1, "modules": 1, "lessons": 1, "mediaFiles": 1 },
  "bytesTotal": 80235,
  "bytesAudio": 123,
  "bytesImage": 0
}
```

Tipos: `format` string fijo `"piiyaak-seed/1"` (compatibilidad futura; lector que vea otro major aborta); `contentVersion` string `/^\d+$/`; `createdAt` string datetime; `dbSha256`/`sha256` hex64 minúsculas; `size`/`dbBytes`/`zipBytes`/conteos/`bytes*` enteros ≥ 0; `bytesTotal = dbBytes + zipBytes - 0` (se define como `dbBytes + Σ files[].size`; `zipBytes` es informativo del artefacto comprimido). `files` ordenado por `objectKey` asc. Desviaciones respecto del sketch del proposal §6 (se fijan aquí): se agregan `format`, `zipBytes`, `localPath` por archivo y conteos de `modules`/`lessons`/`mediaFiles`.

- **Zip:** nombre fijo `piiyaak-seed.zip`; layout interno exacto: `/piiyaak.db`, `/manifest.json` (copia), `/media/<sha256>.<ext>`. Sin subdirectorios salvo `media/`. Entradas ordenadas para reproducibilidad (misma versión → mismo artefacto).
- **Layout R2 (mismo bucket público):** `seed/<N>/piiyaak-seed.zip` (`ContentType: application/zip`), `seed/<N>/manifest.json` (`ContentType: application/json`), inmutables (nunca se sobrescriben; §3.5). `seed/latest.json` (único mutable): `{ "contentVersion": "<N>", "manifestUrl": "<base>/seed/<N>/manifest.json", "zipUrl": "<base>/seed/<N>/piiyaak-seed.zip", "bytesTotal": 0, "files": 0, "updatedAt": "<ISO>" }`.

## 3. W2 — Workflow `.github/workflows/seed-content.yml`

### 3.1 Disparadores y concurrencia

```yaml
on:
  workflow_dispatch:
    inputs:
      content_version:
        description: "Re-publicar una versión concreta (vacío = versión actual remota)"
        required: false
        type: string
      dry_run:
        description: "Genera y verifica sin publicar en R2"
        required: false
        default: false
        type: boolean
  schedule:
    - cron: "0 3 * * 1"  # lunes 03:00 UTC, semanal (Fase D podrá cambiar cadencia)
concurrency:
  group: seed-content
  cancel-in-progress: false
permissions:
  contents: read
```

- Runners: `ubuntu-latest`, Node 24 (precedente `ci-e2e.yml`), más `oven-sh/setup-bun` (solo como ejecutor del script; dependencias via `npm ci`).
- Secrets requeridos (falla cerrado si faltan, mensaje sin valores): `CI_SYNC_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`. Variable/env `SEED_API_BASE` (default producción).

### 3.2 Pasos exactos

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` (node 24, cache npm) + `npm ci` + `npx prisma generate`.
3. `oven-sh/setup-bun@v2` (ejecutor del generador).
4. Generar: `SEED_API_BASE=... CI_SYNC_SECRET=${{ secrets.CI_SYNC_SECRET }} bun run scripts/build-content-bundle.ts --out dist/seed` (+ `--expect-version` si el input viene dado). El script imprime métricas como líneas `METRIC <clave>=<valor>` (`words`, `courses`, `modules`, `lessons`, `mediaFiles`, `bytes_total`, `bytes_audio`, `bytes_image`) y el step las publica en el job summary.
5. SKIP barato: `GET <R2_PUBLIC_BASE_URL>/seed/latest.json`; si `latest.contentVersion === <versión generada>` → log `SKIP: seed <N> ya publicado`, termina en verde sin subir nada. `latest.json` ausente o ilegible → se continúa (primera publicación).
6. Guarda anti-sobrescritura: `objectExists(seed/<N>/piiyaak-seed.zip)`; si existe → falla el job (inmutabilidad; re-publicar exige input `content_version` distinto o intervención manual).
7. Publicar: `putObject` del zip y del `manifest.json` con sus `ContentType`; verificar con `objectExists` ambos (falso → falla).
8. Verificación post-publicación (cierra la verificación que el dispositivo NO hace, §4.4): re-descargar ambos objetos publicados, comparar bytes del zip contra el local y `sha256` de la db extraída contra `manifest.dbSha256`; distinto → falla el job y se deja constancia (los objetos inmutables quedan; la corrección es nueva versión, nunca sobrescritura).
9. Actualizar `seed/latest.json` con un único `putObject` (objeto pequeño; el PUT es atómico, nunca hay `latest.json` parcial). Verificar con `objectExists`.
10. `dry_run: true` ejecuta 1–4 y 8 en local (contra `dist/seed`, o MinIO via `R2_ENDPOINT_OVERRIDE` en desarrollo) y omite 6, 7, 9.
11. Subir `dist/seed/manifest.json` como artifact del workflow (observabilidad).

### 3.3 Presupuesto: medir primero, gates después

- La primera corrida publica las cifras como log + summary (research P5). Umbrales propuestos (zip ≤ 100 MB, db ≤ 10 MB, archivo ≤ 5 MB, cobertura 100 % con hash) operan como **advertencias** hasta que haya medición real; convertirlos en gates duros pertenece a Fase D con números fundados.
- Gates duros desde el día uno (fallan el job): divergencia de versión (código 2), `missingMediaKeys` no vacío o hash distinto (código 3), `objectExists` post-subida falso, verificación post-publicación fallida.

### 3.4 Qué se loguea y qué NUNCA se loguea

Permitido: `contentVersion`, conteos, bytes por clase, `objectKey`s, URLs públicas, tiempos por paso, códigos de salida, decisión SKIP/publicar. NUNCA: valor de `CI_SYNC_SECRET`, credenciales R2, cuerpos del bundle, bytes de medios, encabezados de auth. El script recibe el secreto solo por entorno y nunca lo imprime; el workflow no usa `set -x` sobre comandos con secretos.

### 3.5 `DEPLOY.md` del change

Ubicación: `openspec/changes/apk-offline-fase-c-seed/DEPLOY.md`. Contenido mínimo: lista de secrets y dónde configurarlos, rotación de `CI_SYNC_SECRET` (paso a paso + verificación viejo-401/nuevo-200), verificación manual (`curl` del `manifest.json` público + `jq` de conteos; `GET /api/sync/version` vs `latest.json`), runbook R12 (`remote < local`: causas, cómo confirmar, bump manual o reseteo dirigido; nunca auto-downgrade).

## 4. W3 — App `feat/mobile-fase-c` (especificación para la rama móvil)

### 4.1 Dependencia y configuración

- `npx expo install react-native-zip-archive` (v9; peers cubren RN 0.76.9) + plugin en `app.json`: `"plugins": ["expo-router", "react-native-zip-archive"]`. Solo dev builds EAS; validación en `development`/`preview` (apk) antes de tocar `production`. Plan B documentado: `unzipit` (JS puro) solo si el módulo nativo bloquea un build.
- `EXPO_PUBLIC_SEED_BASE_URL` (build-time, mismo valor que `R2_PUBLIC_BASE_URL`) en `eas.json` (`preview`, `production`). URLs well-known: `<base>/seed/<remote>/manifest.json`, `<base>/seed/<remote>/piiyaak-seed.zip`. Fuente de verdad para SKIP: `GET /api/sync/version`; `latest.json` es observabilidad, la app NUNCA construye URLs desde `latest`.

### 4.2 Máquina de estados de la pantalla "Preparando contenido"

Reemplaza el texto estático de `src/app/index.tsx:83`. Estados (copy neutral, sin hype):

| Estado | UI |
|---|---|
| `checking` | "Comprobando versión del contenido…" (spinner, sin porcentaje) |
| `downloading {receivedBytes, totalBytes}` | "Descargando contenido…" + `X de Y MB (N %)` + barra. Descarga reanudable; el usuario puede salir (continúa en segundo plano dentro de la sesión). |
| `verifying` | "Verificando contenido…" (spinner) |
| `installing {phase}` | "Instalando contenido…" (spinner; `phase`: "copiando datos" / "moviendo medios") |
| `ready` | Transición a la app normal; la db de texto empaquetada ya abría instantáneo (`db-context.tsx:63-84` intacto como fallback). |
| `error {message, canRetry, textOnly}` | Mensaje específico (red, espacio insuficiente, verificación fallida) + botones "Reintentar" y "Continuar solo con texto". Nunca bloqueo sin salida: el diccionario de texto queda utilizable. |

Accesibilidad: progreso con `accessibilityRole="progressbar"` + valores; error con `accessibilityRole="alert"`; objetivos táctiles ≥ 44pt.

### 4.3 Semántica de reanudación (cierra pendiente §11.1)

- Primero `manifest.json` (liviano, sin reanudación): decide SKIP tardío y aporta hashes/tamaños.
- Zip via `FileSystem.createDownloadResumable(url, partUri, {}, onProgress)` donde `partUri = <documentDirectory>seed-<N>.zip.part`.
- Persistencia en `kv`: `piiyaak:seedDownload:<N>` = JSON `{ partName, totalBytes, updatedAt }`. Solo metadatos (nunca `resumeData` opaco más allá de la sesión).
- Reanudación en la sesión: `pauseAsync`/`resumeAsync` ante pérdida de red.
- Reanudación entre reinicios: si existe `.part` + registro kv para el mismo `<N>` y el servidor acepta rango, se reanuda; si el servidor no acepta rango o los tamaños no avanzan, descarga fresca (se borra el parcial). El test simula interrupción a mitad y exige que el segundo intento **complete el archivo sin estado corrupto**, sea por reanudación o por reinicio limpio (se testea el contrato, no el mecanismo del SO).
- Corte a mitad o almacenamiento lleno durante la descarga → el parcial queda aislado en `.part`; la db viva nunca se toca; estado `error` con reintento.

### 4.4 Verificación en el dispositivo (cierra pendiente §11.2: NO hay re-chequeo sha256 por archivo)

**Decisión: no se recalcula `sha256` por archivo en el dispositivo.** Justificación: la frontera de lectura de bytes (`media-cache.ts:125-142`) no expone lector; hashear decenas de MB en el hilo JS compite con memoria y ANR en gama media/baja. Cobertura equivalente por capas:

1. Transporte: HTTPS (integridad de red).
2. Descompresión: CRC32 del `unzip` nativo (corrupción de zip) + guarda previa de espacio (`getUncompressedSize` vs `getFreeDiskStorageAsync`; margen requerido = tamaño descomprimido + `dbBytes`; insuficiente → `error` "espacio insuficiente" con reintento).
3. Por archivo: existencia + `size === files[].size` (barato via `getInfoAsync`). `sha256` por archivo queda en el manifiesto como auditoría y para el modo on-demand futuro; su verificación real ocurre en CI (§3.2 paso 8).
4. Base de datos: `PRAGMA integrity_check = ok` + `kv.schemaVersion === "4"` + `kv.piiyaak:contentVersion === remote` + `COUNT(*)` de `words`/`courses`/`lessons` === `manifest.counts`.
5. `manifest.json` inválido (schema Zod en el borde: `format === "piiyaak-seed/1"`, tipos §2.6) o cualquier chequeo fallido → sin swap, estado `error` con reintento + fallback a texto.

### 4.5 Swap atómico con preservación (pasos exactos, en orden)

Precondición: verificación §4.4 en verde sobre el directorio temporal. La db viva NO se toca hasta el paso 5.

1. Cerrar la conexión viva (`closeAsync` de la instancia `expo-sqlite`; el provider queda en no-listo durante el swap).
2. Abrir la db nueva (temporal) y correr `PRAGMA integrity_check`; distinto de `ok` → abortar.
3. `ATTACH DATABASE '<livePath>' AS live;` sobre la conexión de la db nueva y copiar **exactamente** estas 3 tablas de usuario (nada más):
   ```sql
   INSERT OR REPLACE INTO main.course_progress SELECT * FROM live.course_progress;
   INSERT OR REPLACE INTO main.outbox          SELECT * FROM live.outbox;
   INSERT OR REPLACE INTO main.history         SELECT * FROM live.history;
   ```
4. Verificar `COUNT(*)` de las 3 tablas: `main === live` en cada una; distinto → abortar (`DETACH`, sin tocar la viva).
5. `DETACH live;` cerrar ambas conexiones; reemplazo: mover viva → `piiyaak.db.bak`, mover nueva → `SQLite/piiyaak.db` (`moveAsync`, atómico por renombre en el mismo volumen).
6. Reapertura `openDatabaseSync("piiyaak.db")` + adopción conjunta `setLocalVersion({ contentVersion: remote, serverTime })` (escritura conjunta existente en `version-gate.ts:48-53`). Si la reapertura falla → restaurar el `.bak` y estado `error`.
7. Medios: por cada `files[]`, mover `<tmp>/media/<sha256>.<ext>` a `<base><dir>/<sha256>.<ext>` donde `<dir>` = `audios/` si `mimeType` empieza con `audio/`, `illustrations/` si empieza con `image/`; localización por **stem `sha256`** (ignora extensión histórica). El cache (`fileNameFor` + `localUriFor`) los reconoce sin re-descarga.
8. Limpieza: borrar tmp, `.part`, `piiyaak:seedDownload:<N>` y `.bak` (solo tras reapertura + adopción exitosas).

### 4.6 Comparación solo-adelante en el gate

Extiende `sync.ts:149-177` con `compareVersions` (§1.3): `skip` → retorno vacío sin red adicional; `seed` → flujo §4.2–§4.5; `noop` (`remote < local`) → sin seed, warn estructurado, la app sigue con local. El sync incremental posterior sigue operando sobre la db adoptada (el seed es snapshot; los deltas continúan por `since`).

## 5. Criterios de aceptación TDD por work unit + casos borde

Cada unidad sigue RED → GREEN → refactor; sin test failing previo no hay código de producción. Ubicación de tests: web `src/lib/seed/*.test.ts` + `scripts/*.test.ts` (vitest, `test:run`); app `src/db/__tests__/seed-*.test.ts` (vitest en memoria/simulada). Lo nativo (unzip real, descarga reanudable, build EAS) se declara no cubierto por unit tests y se verifica en dispositivo (§5.3).

### F0 (web + app)

- RED web: las 4 rutas emiten string (`toBe("41")`, `typeof === "string"`); falla antes del cambio.
- RED app: `VersionResponseSchema` parsea `{ contentVersion: 41, ... }` → `"41"`; string canónico pasa idéntico; `""` y `-1` rechazan.
- GREEN: serialización `String()` + union con `transform`; `export-db.py` sin cambios produce `piiyaak:contentVersion`.

### W1 (web)

- Mapeo: fixture de bundle → db con `courses`/`modules`/`lessons`/`media_manifest` pobladas, `spanish_norm` correcto, `content` crudo preservado (incluido documento corrupto E5), `coverImage` NULL cuando el bundle la trae nula.
- Naming: `media/<sha256 minúsculas>.<ext>` por tabla §2.5; `mimeType` desconocido → código 3 con `objectKey` en el mensaje.
- `manifest.json`: conteos/bytes exactos contra fixture; `files` ordenado; `dbSha256` coincide con hash independiente del test.
- Foto atómica: `cvPost !== cvPre` (mock de `/api/sync/version` que cambia entre lecturas) → código 2 y `<out>` borrado.
- Paridad de esquema: `PRAGMA table_info` de las 9 tablas === esperado del `SCHEMA` de la app; divergencia simulada → falla.
- R2: `getObjectBytes` null → código 3; excepción de red → código 4.

### W2 (workflow)

- `dry_run` con fixture (o MinIO via `R2_ENDPOINT_OVERRIDE`): layout `seed/<N>/` + `latest.json` correctos, métricas en summary, `missingMediaKeys` no vacío → job rojo.
- SKIP: `latest.json` ya con `<N>` → verde sin `putObject` (assert por mock/contador).
- Rotación de secreto: viejo → 401 genérico, nuevo → 200 (mismo contrato que `route.test.ts` E1).
- Post-publicación: bytes re-descargados idénticos + `dbSha256` coincide; diferencia → job rojo.

### W3 (app, memoria/simulada)

- `compareVersions`: `("41","41")`→skip; `("40","41")`/`(null,"41")`→seed; `("42","41")`→noop; remote `"x"`→throw. Con string y number en `getRemoteVersion` (F0).
- `manifest.json` corrupto o `format` distinto → sin swap, estado `error`.
- Swap sobre dbs en memoria con `ATTACH`: preserva `course_progress`/`outbox`/`history` fila a fila, adopta `contentVersion` conjunta, reemplaza `words`; conteo divergente simulado → sin swap, viva intacta.
- Interrupción a mitad: segundo intento completa sin corrupción (contrato §4.3).
- `remote < local` → no-op: cero escrituras (assert de store intacto).

### 5.1 Casos borde (todos con test o verificación declarada)

| Borde | Comportamiento exigido |
|---|---|
| Bundle corrupto (manifest inválido, `dbSha256` distinto) | Sin swap; `error` + reintento + texto (test) |
| Corte a mitad de descarga / almacenamiento lleno | Parcial aislado, viva intacta, reintento (test contrato + dispositivo) |
| `contentVersion` igual | SKIP sin red adicional (test: cero fetch tras version) |
| Remoto menor que local | No-op + warn, sin seed (test; runbook R12 en `DEPLOY.md`) |
| R2 caído durante W1/W2 | Código 4 / job rojo, sin artefacto parcial (test + dry-run) |
| `CI_SYNC_SECRET` rotado | Viejo 401 genérico / nuevo 200, sin downtime (test) |
| `mimeType` desconocido | Código 3 explícito, nunca adivinanza (test) |
| `schemaVersion` distinta en db descargada | No adoptar, `error` (test) |
| Espacio insuficiente | Guarda previa, `error` específico (test + dispositivo) |
| Zip malicioso (ZipSlip) | Bloqueado por el módulo (nativo; verificación en build EAS, no unit) |

### 5.2 Gates de cierre

- `tsc --noEmit` (ambos repos) → 0 errores; `lint` en archivos tocados → sin pelea de estilo.
- Delivery Gate antislop (superficie UI de W3) → PASS.
- `DEPLOY.md` completo (secrets, rotación, verificación manual, runbook R12).

### 5.3 Verificación en dispositivo (explícita, no simulable en CI)

Unzip v9 sobre old-arch SDK 52 en `development`/`preview` con progreso real; zip de tamaño real en gama media/baja sin ANR/OOM; interrupción real (modo avión) con reanudación; instalación nueva 100 % offline post-seed (modo avión: diccionario + cursos + medios sin red).

## 6. Trazabilidad de skills

- `api-design-patterns`: contrato aditivo F0, error mínimo y todo-o-nada en W1/W2, 401 genérico heredado, idempotencia por versión, PUT atómico de `latest.json`. Aplicada en §1–§3.
- `react-native-patterns`: reutilizar seams (`Asset`/copy/open, `fileNameFor`, gate con Zod en el borde), estados explícitos de pantalla, I/O nativo fuera del hilo JS, sin secretos en el bundle. Aplicada en §4.
- `test-driven-development-tdd`: ciclo RED → GREEN → refactor por comparador, mapeo, manifiesto y swap; §5 define los tests failing previos por work unit y el criterio "sin test failing previo no hay código".
