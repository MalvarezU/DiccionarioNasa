# Spec: apk-offline-fase-d-auto — Automatización Fase D (botón admin + dispatch + notice app + resume real)

- **Change ID:** `apk-offline-fase-d-auto`
- **Estado:** spec (previo a `tasks.md`)
- **Ramas:** web `feat/fase-d-auto` (este repo) · app `feat/mobile-fase-d` (`/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app`)
- **Idioma del spec:** español neutral/profesional. Identificadores, claves y código: English.
- **Decisiones del research y del proposal que este spec NO reabre:** D1 (PAT fino, research P1), D2 (formato `latest.json` y transporte, research P2), D3 (resume solo vía `savable` + guarda 206, research P3). Este spec solo fija firmas, formatos, textos y pasos.

## 0. Convenciones

- `contentVersion` canónico: **string** de entero decimal (`/^\d+$/`). Igualdad sobre el string; orden sobre `parseInt` validado (herencia Fase C F0).
- Fechas: ISO-8601 UTC con `Z` (`new Date().toISOString()`). `serverTime` además debe satisfacer `z.string().datetime()`.
- Tamaños en bytes, enteros no negativos. `sha256` en minúsculas, hex de 64.
- Todo secreto viaja solo en variable de entorno server-only o encabezado `Authorization`. Nunca en query string, logs, artefactos ni respuestas.
- Orden de trabajo: W0 → W1 → W2 → W3 → W4. Cada work unit sigue RED → GREEN → refactor; sin test failing previo no hay código de producción.

---

## W0 — E1 `serverTime` + test de contrato (web, prerrequisito)

### W0.1 Firma exacta

`GET /api/sync/version` (`src/app/api/sync/version/route.ts`) responde:

```json
{ "contentVersion": "41", "serverTime": "2026-11-09T03:00:12.345Z" }
```

Reglas:

1. Cambio **aditivo**: se agrega `serverTime`; `contentVersion` (string canónico, herencia Fase C) no cambia.
2. Fuente de `serverTime`: `updatedAt` de la fila `ContentVersion(id = 1)`, serializado con `.toISOString()`. Lectura vía Prisma en la misma consulta existente (`findUnique({ where: { id: 1 } })`); **sin migraciones, sin cambios de esquema** (`updatedAt` ya existe con `@updatedAt`, `prisma/schema.prisma:163-167`).
3. Fila ausente (instalación sin seed de `ContentVersion`): `contentVersion` = `"1"` (comportamiento actual de `getContentVersion`) y `serverTime` = instante de la respuesta (`new Date().toISOString()`). No se crea la fila como efecto lateral de un GET.
4. `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` intacto. Forma de error intacta: ante excepción → `500` con `{ message: "Error interno del servidor" }` y sin `Cache-Control`.
5. Ruta pública: sin autenticación, sin parámetros.

### W0.2 Test de contrato que hoy falla (RED)

En `src/app/api/sync/version/route.test.ts`:

```ts
const body = await (await GET(req)).json();
// Importar el schema real de la app es imposible desde web (repos separados):
// el test congela la forma que la app exige replicando el contrato.
const Contract = z.object({
  contentVersion: z.string().regex(/^\d+$/),
  serverTime: z.string().datetime(),
});
Contract.parse(body); // hoy lanza: falta `serverTime`
```

Casos del test:

1. Respuesta real parseada por el contrato → válido (hoy falla por `serverTime` ausente).
2. `serverTime` es datetime ISO-8601 UTC válido con `Z`.
3. Fila `ContentVersion` ausente → `{ contentVersion: "1", serverTime: <ahora> }` válido contra el contrato.
4. Excepción interna → `500` + cuerpo exacto (test existente, sin cambios).

### W0.3 Efecto en la app (sin código, solo cierra el contrato)

`VersionResponseSchema` (`piiyaak-app/src/db/version-gate.ts:14-23`) ya exige `{ contentVersion, serverTime }`; no requiere cambios. Tras W0, `getRemoteVersion` deja de lanzar `ZodError` contra el backend real y el `catch` de `db-context.tsx:243-246` vuelve a significar únicamente "sin red", no "contrato roto".

---

## W1 — Endpoint dispatch + botón admin + status/historial (web)

### W1.1 Rutas (fijas)

- `POST /api/admin/seed/dispatch` — dispara el workflow.
- `GET /api/admin/seed/runs` — lista runs del workflow (status/historial).
- `GET /api/admin/seed/runs/[id]` — detalle de un run (seguimiento del polling).

Las tres son server-only (`"use server"` no aplica; son route handlers con `requireAdmin()` como primera instrucción). Ninguna expone el PAT: el token vive solo en `process.env.SEED_DISPATCH_TOKEN` (nombre fijo) y jamás aparece en respuestas, logs ni errores.

### W1.2 `POST /api/admin/seed/dispatch` — firma exacta

Request (JSON):

```ts
const DispatchBodySchema = z.object({
  content_version: z.string().regex(/^\d+$/).max(20).optional(),
  // vacío o ausente = omitir la clave `content_version` en el dispatch
  // (el workflow usa la versión actual remota).
  dry_run: z.boolean().default(true),
});
```

Validación adicional: `ref` **no** proviene del cliente. El servidor fija `ref: "main"` (constante; allowlist de un elemento, §W1.5). Cualquier otro campo en el body → `400` (allowlist estricta de inputs).

Llamada a GitHub (server-to-server):

```
POST https://api.github.com/repos/{owner}/{repo}/actions/workflows/seed-content.yml/dispatches
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
Authorization: Bearer <SEED_DISPATCH_TOKEN>
{ "ref": "main", "inputs": { "dry_run": <bool>, ["content_version": <string>] } }
```

`{owner}/{repo}` se resuelven de env server-only (`SEED_GITHUB_OWNER`, `SEED_GITHUB_REPO`, nombres fijos); nunca del cliente.

Respuestas propias:

| Caso | Código | Cuerpo |
|---|---|---|
| Sin sesión admin (`requireAdmin` → error) | 401 no autenticado / 403 rol insuficiente (heredado, sin cambios) | El de `requireAdmin` |
| Body inválido (campo fuera de allowlist, `content_version` no canónico) | 400 | `{ message: "<detalle de validación>" }` |
| GitHub responde `204` | 202 | `{ run: null, status: "dispatched", correlationId: "<uuid>", ref: "main", inputs: { dry_run, [content_version] } }` |
| GitHub responde error (4xx/5xx) o red falla | 502 | `{ message: "No se pudo disparar la generación de contenido" }` (mensaje genérico; **sin filtrar el cuerpo de GitHub**) |
| Sin `SEED_DISPATCH_TOKEN` configurado | 500 | `{ message: "Error interno del servidor" }` |

`correlationId`: `crypto.randomUUID()` generado por request; viaja en la respuesta y en el registro de audit. `run: null` porque `dispatches` no devuelve run id; el cliente lo resuelve por polling (§W1.4).

Audit (obligatorio, misma transacción lógica que el dispatch exitoso): `db.auditLog.create({ data: { action: "SEED_DISPATCH", entity: "SeedContent", entityId: <content_version ?? "latest">, changes: JSON.stringify({ ref: "main", inputs, correlationId, responsable }), userId: session.user.id } })`. Precedente de forma: `src/app/api/admin/words/[id]/route.ts:144-157`. Si GitHub falla (502), **no** se escribe audit de dispatch (se registra solo el intento en log de servidor, sin token).

### W1.3 `GET /api/admin/seed/runs` y `GET /api/admin/seed/runs/[id]` — firma exacta

```
GET /api/admin/seed/runs?per_page=10&page=1
→ GET https://api.github.com/repos/{owner}/{repo}/actions/workflows/seed-content.yml/runs?per_page=<n>&page=<p>
```

- `per_page`: entero `1..30`, defecto `10`. `page`: entero `>= 1`, defecto `1`. Fuera de rango → `400`.
- `requireAdmin()` primero; sin sesión → 401/403 sin llamada a GitHub.
- Respuesta propia (lista mínima, sin filtrar campos internos de GitHub más allá de lo listado):

```json
{
  "runs": [
    { "id": 123, "status": "in_progress", "conclusion": null,
      "createdAt": "...", "updatedAt": "...",
      "inputs": { "dry_run": true }, "htmlUrl": "https://github.com/..." }
  ],
  "totalCount": 42, "page": 1, "per_page": 10
}
```

- `status`: enum GitHub (`queued | in_progress | completed`) tal cual; `conclusion` nullable (`success | failure | cancelled | skipped | null`).
- Error upstream o red → `502` con mensaje genérico (misma forma que dispatch).
- `GET /api/admin/seed/runs/[id]`: `id` numérico de path (`/^\d+$/`, si no → `400`); responde un único objeto run con la misma forma; upstream 404 → propio `404` con `{ message: "Ejecución no encontrada" }`.

### W1.4 Polling (UI → `runs`)

- Intervalo: **15 s** entre peticiones, solo mientras haya un run no terminal (`queued`/`in_progress`). Al alcanzar `completed`, el polling se detiene y se muestra el estado final.
- `per_page=10` fijo en el cliente; la UI toma el run más reciente cuyo `createdAt` sea posterior al `dispatchedAt` local (correlación por tiempo, ya que `dispatches` no devuelve id).
- Backoff ante `502/429`: reintentar a 15 s → 30 s → 60 s; tras 3 fallos consecutivos, detener el polling y mostrar error con escape manual (§W1.6).
- Sin websockets ni webhooks en esta fase.

### W1.5 Allowlist de `ref` e `inputs` (normativa)

- `ref`: constante `"main"`. No configurable por cliente ni por UI. Si el workflow se renombra de rama en el futuro, el cambio es código + deploy, nunca input de usuario.
- `inputs` permitidos: exactamente `content_version` (string canónico, opcional) y `dry_run` (boolean). Límite GitHub de 25 props: irrelevante con 2, pero el servidor rechaza cualquier tercera clave con `400`.
- `content_version` vacío (`""`) se trata igual que ausente: se omite del dispatch (el workflow usa la versión actual remota). Nunca se envía string vacío a GitHub.

### W1.6 Botón admin + modal (textos y estados exactos)

Ubicación: `src/app/admin/palabras/page.tsx`, junto al botón que abre `ImportCorpusModal` (línea 72). Nuevo botón secundario: **"Generar contenido offline"**. Patrón de dos pasos reutilizado de `ImportCorpusModal.tsx:98/125` (configurar → confirmar con `ConfirmDialog`, `confirm-dialog.tsx`).

Paso 1 — Configurar (cuerpo del modal):

- Título: `Generar contenido offline`.
- Descripción: `Crea el paquete de contenido para la aplicación móvil. Esta acción consume minutos de GitHub Actions.`
- Campo `content_version` (texto, opcional, placeholder `Vacío = versión actual`).
- Checkbox `dry_run` (defecto **activado** = `true`; etiqueta `Solo verificar, sin publicar`).
- Botón primario: `Revisar`; secundario: `Cancelar`.

Paso 2 — Confirmar (`ConfirmDialog`):

- `titulo`: `¿Generar el paquete de contenido?`
- `descripcion`: resumen de lo elegido (`Versión: <v o "actual"> · Modo: <"verificación" o "publicación">`) más aviso `Con modo publicación, el contenido nuevo quedará disponible para la aplicación.`
- `accionLabel`: `Generar`; `processing` deshabilita ambos botones durante el dispatch (anti-doble-clic, precedente `confirm-dialog.tsx:21-23`).

Tabla de estados del run (máquina de la UI):

| Estado UI | Condición | Acciones |
|---|---|---|
| `idle` | Modal abierto, sin dispatch | Editar campos, `Revisar` |
| `confirmando` | Paso 2 visible | `Generar` / `Cancelar` |
| `despachando` | `POST dispatch` en vuelo | Todo deshabilitado + spinner |
| `observando` | `202` recibido; polling cada 15 s | `Cerrar` (el polling continúa solo con el modal abierto); muestra último estado del run |
| `exito` | Run `completed` + `conclusion: success` | Mensaje `Contenido generado correctamente.` + `Cerrar` |
| `fallo` | Run `completed` con `conclusion != success`, o `502`/`400` | Mensaje accionable + escape `Continuar con el flujo manual en GitHub` (enlace a Actions del repo) + `Reintentar` |

Textos de error (exactos):

- Validación: el devuelto por el endpoint (`400`).
- Dispatch fallido: `No se pudo iniciar la generación. Es posible reintentar o continuar con el flujo manual en GitHub.`
- Polling agotado: `No se pudo obtener el estado. Revisar manualmente en GitHub Actions.`
- Sin permiso: el de `requireAdmin` (sin cambios).

Historial: debajo del formulario, lista de los últimos 10 runs (`GET runs?per_page=10`) con `createdAt`, `status`/`conclusion` y `dry_run`; reutiliza el lenguaje visual de `DashboardActivity` (sin duplicar su código si la composición lo permite; duplicación mínima si no).

### W1.7 Tests TDD (RED → GREEN → refactor)

1. Sin sesión admin → `401/403` y `fetch` a GitHub **no llamado** (mock de `fetch`, nunca red real).
2. Body con campo extra (`{ foo: 1 }`) → `400`; `content_version: "abc"` → `400`; `dry_run: "sí"` → `400`.
3. Dispatch mockeado `204` → propio `202` con `correlationId` + registro en `auditLog` (`action: "SEED_DISPATCH"`).
4. Upstream `422` → propio `502` con mensaje genérico (el cuerpo de GitHub no aparece en la respuesta).
5. `GET runs` mockeado → lista mínima con la forma §W1.3; `per_page=99` → `400`.
6. UI: estados `idle → confirmando → despachando → observando → exito/fallo` con respuestas mockeadas; doble clic en `Generar` emite un solo `POST`.

---

## W2 — Notice de contenido nuevo (app, `feat/mobile-fase-d`)

### W2.1 Enganche (sin cambiar el gate)

El efecto de `db-context.tsx:222-252` se extiende, no se reescribe: tras `compareVersions` clasificar `remote > local` (camino `seed`), en lugar de lanzar `runSeedInternal` de inmediato, el provider expone el aviso y espera la decisión del usuario. El camino `skip` no cambia; el camino `noop` no cambia (warn existente). El `catch` ("offline") no cambia.

Nuevo estado en `DbContextValue`:

```ts
interface UpdateAvailable {
  remote: string;          // contentVersion remota canónica
  serverTime: string;      // serverTime remoto (para adoptVersion al aceptar)
  bytesTotal: number | null; // de latest.json; null si no disponible
  files: number | null;      // de latest.json; null si no disponible
}
updateAvailable: UpdateAvailable | null;
dismissUpdate: () => void;   // posponer (§W2.3)
acceptUpdate: () => Promise<void>; // descargar ahora (llama runSeedInternal vigente)
```

La fuente de metadatos es **`latest.json`** (conveniencia/observabilidad, decisión D2): `GET <EXPO_PUBLIC_SEED_BASE_URL>/seed/latest.json`, validado con Zod en el borde:

```ts
const LatestJsonSchema = z.object({
  contentVersion: z.string().regex(/^\d+$/),
  manifestUrl: z.string().url(),
  zipUrl: z.string().url(),
  bytesTotal: z.number().int().nonnegative(),
  files: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});
```

Reglas:

1. `latest.json` ilegible o inválido → aviso igualmente con `bytesTotal/files: null` (el seed usa las URLs well-known de `seedFileUrls`, nunca las de `latest.json`; precedente `seed-download.ts:58-68`).
2. `latest.json.contentVersion !== remote` del gate → aviso con `bytesTotal/files: null` (desconfianza ante divergencia; el gate manda).
3. Sin red → sin aviso (el `catch` vigente cubre el caso).

### W2.2 Comparación (qué decide qué)

| Decisión | Fuente | Función |
|---|---|---|
| ¿Hay contenido nuevo? | `GET /api/sync/version` vs kv local | `compareVersions` (sin cambios) |
| ¿Qué tamaño/archivos mostrar? | `latest.json` | `LatestJsonSchema` (solo display) |
| ¿De dónde descargar? | URLs well-known `<base>/seed/<N>/…` | `seedFileUrls` (sin cambios) |

`latest.json` nunca decide SKIP ni versiones; solo adorna el aviso.

### W2.3 Máquina de estados del aviso

```ts
export type UpdateNoticeState =
  | { status: "checking" }                                    // gate en curso
  | { status: "none" }                                        // skip / noop / offline
  | { status: "available"; update: UpdateAvailable }          // aviso visible
  | { status: "dismissed"; remote: string }                   // pospuesto esta versión
  | { status: "downloading" };                                // aceptado, delega al seed
```

Transiciones:

- `checking → none`: `skip`, `noop` u offline.
- `checking → available`: `remote > local` (con metadatos o nulls según §W2.1).
- `available → dismissed`: `dismissUpdate()` (persistir §W2.4).
- `available → downloading`: `acceptUpdate()` (delega a `runSeedInternal` vigente; el `SeedState` existente toma el control visual).
- `dismissed → available`: solo si `remote` cambia (nueva versión remota).
- `downloading → none`: al llegar `SeedState ready` o `continueTextOnly()`.

Lógica pura en `src/db/update-notice.ts` (nuevo archivo, testeable en Node, sin imports de `expo-*`); el provider solo la conecta.

### W2.4 Persistencia del descarte

- Clave kv: `piiyaak:dismissedUpdate` (`TEXT`, mismo prefijo `piiyaak:` de §2.1 de `version-gate.ts`).
- Valor: string canónico de la versión descartada (`"42"`).
- Al clasificar `remote > local`: si `dismissed === remote`, el aviso nace en `dismissed` (no se muestra); si `remote` difiere del descartado, se muestra (`available`).
- Aceptar o instalar con éxito limpia la clave (lápida vacía, mismo patrón que `clearDownloadRecord` en `seed-expo.ts:193-197`, ya que `WordStore` no expone borrado).

### W2.5 UI del aviso (textos exactos)

Componente `UpdateNotice` (`src/components/update-notice.tsx`, nuevo) que reutiliza el lenguaje visual de `SeedProgress` (tarjeta, `theme.card`, botones ≥ 44pt, roles de accesibilidad):

- Contenedor con `accessibilityRole="alert"`, título `Hay contenido nuevo disponible`.
- Detalle con tamaño cuando existe: `Versión <remote> · <X,Y MB> · <N archivos>` (formato de MB: el de `formatSeedProgress`, un decimal); sin metadatos: `Versión <remote>`.
- Botón primario `Descargar ahora` → `acceptUpdate()`; botón fantasma `Más tarde` → `dismissUpdate()`.
- La aplicación permanece operable con el texto local en todo momento; el aviso no bloquea la navegación ni el diccionario.

### W2.6 Tests TDD (vitest, Node, sin nativo)

1. `remote == local` → `none`, sin aviso.
2. `remote > local` con `latest.json` válido → `available` con `bytesTotal/files`.
3. `remote > local` con `latest.json` inválido → `available` con nulls (el gate manda).
4. `dismissUpdate()` → `dismissed`; mismo `remote` no re-avisa; `remote` nuevo sí avisa.
5. `acceptUpdate()` delega a `runSeedInternal` con `(baseUrl, remote, serverTime)` (el flujo seed posterior no se re-testea aquí).
6. Render: roles `alert` + botones `Descargar ahora` / `Más tarde` (snapshot/roles, no píxeles).

---

## W3 — Resume real `savable` + guarda 206 + reintentos (app, `feat/mobile-fase-d`)

### W3.1 Clave kv y esquema del registro (fijo)

Se extiende el registro existente `piiyaak:seedDownload:<N>` (prefijo vigente `seed-expo.ts:36`; `seed-download.ts:29`), que hoy guarda `{ partName, totalBytes, updatedAt }`. Nuevo esquema:

```ts
interface SeedDownloadRecord {
  partName: string;       // `seed-<N>.zip.part` (sin cambios)
  totalBytes: number;     // manifest.zipBytes (sin cambios)
  updatedAt: string;      // ISO-8601 (sin cambios)
  resumeData: string | null; // opaco de savable(); null = sin resume posible
}
```

Reglas:

1. `resumeData` es **opaco**: se persiste tal cual lo devuelve `savable()` y se entrega tal cual a `createDownloadResumable`. **Nunca se construye a mano ni se interpreta** (en Android es un offset como string; en iOS, blob base64 de `NSURLSession`; research P3).
2. Compatibilidad: un registro antiguo sin `resumeData` se lee como `resumeData: null` (re-descarga limpia, §W3.4 caso 1).
3. `contentVersion` distinto (`<M>` vs registro de `<N>`): el `.part` ajeno se borra por diseño antes de empezar (comportamiento vigente `seed-download.ts:136-138`).

### W3.2 Decisión pura resume-vs-fresco (testeable en Node)

Nueva función pura en `src/db/seed-resume.ts` (sin imports `expo-*`):

```ts
export interface ResumeInput {
  record: SeedDownloadRecord | null;
  existingBytes: number | null; // tamaño actual del .part (partialSize)
  supportsResume: boolean;      // HEAD accept-ranges: bytes (vigente)
  resumedStatus: number | null; // status HTTP del resume; null = aún no intentado
}
export type ResumeDecision =
  | { action: "resume" }   // continuar con resumeData
  | { action: "fresh" }    // descarga completa (truncando .part si existe)
  | { action: "truncate-and-fresh" }; // el servidor ignoró el rango: borrar .part y reiniciar
```

Matriz (normativa):

| `record.resumeData` | `existingBytes` | `supportsResume` | `resumedStatus` | Decisión |
|---|---|---|---|---|
| `null`/ausente | — | — | — | `fresh` |
| válido | `null`/`0`/≥ `totalBytes` | — | — | `fresh` (nada que continuar) |
| válido | `0 < b < total` | `false` | — | `fresh` |
| válido | `0 < b < total` | `true` | `null` | `resume` |
| válido | `0 < b < total` | `true` | `206` | `resume` (continuar) |
| válido | `0 < b < total` | `true` | cualquier otro (`200`, etc.) | `truncate-and-fresh` |

La guarda `status === 206` es **obligatoria** tras cada `resumeAsync()`: si no es `206`, borrar el `.part` y reiniciar fresco sin `resumeData` (corrupción por append ciego documentada en research P3.3: `FileSystemModule.kt:922-950` concatena sin verificar). Paridad en iOS aunque `NSURLSession` valide nativamente.

### W3.3 Cableado nativo (`seed-expo.ts`, zona `:124-141`)

1. Mantener viva la instancia `DownloadResumable` durante la descarga (hoy se crea y se suelta en la misma llamada).
2. Ante interrupción o error recuperable: `await task.pauseAsync()` → `persistir savable()` (`{ url, fileUri, options, resumeData }` serializable; se guarda `resumeData` en el registro kv §W3.1) en lugar de abandonar el `.part`.
3. Al reintentar con decisión `resume`: `createDownloadResumable(url, partUri, mismasOptions, cb, resumeData)` + `resumeAsync()`; leer `result.status` y aplicar la matriz §W3.2.
4. `pauseAsync()`/`savable()` solo existen en dispositivo; el import de `expo-file-system` sigue prohibido en tests Node (cabecera vigente `seed-expo.ts:1-17`).

### W3.4 Reintentos (N y delays fijos)

- Máximo **3 intentos** por descarga (1 inicial + 2 reintentos), con backoff **[2000 ms, 8000 ms]**, idéntico a `fetchWithRetry` (`sync.ts:34-59`). Reutilizar esas constantes si el módulo las exporta; si no, duplicar los valores literales con comentario de procedencia (no refactorizar `sync.ts` en este change).
- Solo errores recuperables de red reintentan resume (`timeout`, `network`, `EPIPE`-equivalentes, `resumeData` expirado tratado como `fresh`, no como fallo).
- Errores de verificación/integridad (`dbSha256` distinto, conteos, `manifiesto`, `stale`) **nunca** reintentan resume: reinicio fresco o fallo explícito.

### W3.5 Prohibición explícita

**NUNCA `Range` manual en `downloadAsync`.** `DownloadOptions` acepta `headers`, pero `downloadAsync()` sobrescribe el archivo por especificación (`FileSystem.d.ts` en `expo-file-system@18.1.11`); inyectar `Range` por esa vía produce parcial+completo concatenados (research P3.1). Verificación: `grep -rn "Range" src/db/seed-expo.ts` debe devolver cero resultados fuera de comentarios que documenten esta prohibición; un test assertion sobre el adaptador puede fijarlo si la implementación lo permite sin importar `expo-*`.

### W3.6 Sin `Accept-Ranges` (degradación diseñada)

Si `supportsResume(zipUrl)` es `false` (HEAD sin `accept-ranges: bytes` o fallo del HEAD): decisión `fresh` siempre; el `.part` previo se borra y la descarga es completa. Correcto por diseño; sin aviso de error (el usuario no puede actuar sobre el CDN).

### W3.7 Tests TDD (vitest, Node, sin nativo)

1. Matriz §W3.2 completa (6 filas) como tests de la función pura.
2. `resumeData` opaco: round-trip `writeRecord → readRecord` preserva el string byte a byte (sin parseo ni normalización).
3. Registro antiguo sin `resumeData` → se lee como `null` → `fresh`.
4. `contentVersion` distinto → `.part` ajeno eliminado (test vigente de `downloadSeed`, sin regresión).
5. Reintentos: 3 intentos con delays `[2000, 8000]` ante error recuperable; error de integridad no reintenta.
6. Prohibición: ningún código de producción pasa `headers: { Range }` a `downloadAsync` (grep/test).

---

## W4 — Runbook + E2/E3 + eslint mínimo (web + app)

### W4.1 Runbook (contenido exacto)

Nuevo archivo `openspec/changes/apk-offline-fase-d-auto/DEPLOY.md` (precedente: `DEPLOY.md` de Fase C). Secciones obligatorias:

1. **Dónde viven `keystore` y `versionCode`.** Credenciales EAS (`credentials.json` gestionado por `eas credentials`, keystore Android y certificado iOS en servidores EAS). `versionCode`/`buildNumber` en `app.json` (gestionado, incremento por release). **NUNCA en el repo**: ni keystore (`.jks`/`.p8`/`.p12`), ni contraseñas, ni `SEED_DISPATCH_TOKEN`, ni secretos R2.
2. **Rotación.** PAT fino: regenerar en GitHub (Settings → Tokens) cada ≈90 días y actualizar `SEED_DISPATCH_TOKEN` en el entorno server-only (Vercel → Environment Variables) + redeploy. Keystore: rotar solo ante compromiso (requiere nueva firma y publicación en stores). Recordatorio operativo: agendar la rotación del PAT junto con la cadencia semanal del workflow.
3. **Primera corrida real (paso a paso).** (a) `workflow_dispatch` con `dry_run=true` desde el botón admin (o GitHub UI como escape); (b) revisar logs del run (build, verificación local, SKIP); (c) `dry_run=false`; (d) verificar `curl -fsSL $R2_PUBLIC_BASE_URL/seed/latest.json | jq '{contentVersion, bytesTotal, files}'`; (e) `curl -I $R2_PUBLIC_BASE_URL/seed/<N>/piiyaak-seed.zip` (esperado `accept-ranges: bytes`); (f) `GET /api/sync/version` vs `latest.json` (mismo `contentVersion`).
4. **Si la org bloquea PATs finos.** Migrar a GitHub App (decisión D1 documentada): crear App con permiso Actions Lectura+Escritura, instalar en el repo, emitir token de instalación por llamada en la route. Mismo permiso, cambia solo la emisión del token.
5. **Qué hacer ante `noop` repetidos** (`remote < local`, warn de Fase C F0): intervención manual — verificar `ContentVersion(id=1)` en producción, nunca auto-downgrade.

### W4.2 E2 — Definición canónica única de `bytesTotal` (exacta)

**Definición canónica:** `bytesTotal = dbBytes + Σ files[].size`, calculada por `emitManifest` (`src/lib/seed/bundle-builder.ts:537`) sobre el `manifest.json` generado. `seed-content.yml` pasos 9 (`:253-261`) **replica** ese valor en `latest.json` con `jq -r '.bytesTotal'`; nunca lo recalcula por otra vía.

Cambios normativos:

1. Ningún otro código puede definir `bytesTotal` de otra forma; si algún lector necesita el total, lo lee del manifiesto.
2. Test de contrato (web, nuevo o extendido de `bundle-builder.test.ts`): `latest.json.bytesTotal === manifest.json.bytesTotal` para el mismo build, y `manifest.bytesTotal === dbBytes + Σ files.size` (la segunda parte ya cubierta en `bundle-builder.test.ts:285/394`; el test nuevo fija la primera).
3. Comentario en `seed-content.yml` paso 9 que cite la definición canónica (`emitManifest`, `bundle-builder.ts:537`).

### W4.3 E3 — Deduplicación de `seed-content.yml` (exacta, sin cambio semántico)

Estado actual: pasos 8–11 con guardas `if: ${{ !inputs.dry_run && steps.skip.outputs.skip != 'true' }}` repetidas en 4 pasos (pasos 8 real, 7 publicación, 9 latest, más el `if: ${{ !inputs.dry_run }}` del paso 5). Corrección:

1. Renumerar pasos secuencialmente (hoy hay dos "Paso 8" y salto a "Paso 11").
2. Extraer la condición común a un output de job o a un paso `decide` previo; los pasos de publicación consumen `needs`/output en lugar de repetir la expresión. Si la sintaxis de GitHub Actions impide compartir `if` sin reestructurar jobs, la alternativa aceptada es un comentario único que declare la guarda canónica + las 4 guardas literales idénticas (deduplicación documental, cero riesgo semántico).
3. Verificación: `diff` revisado paso a paso + dry-run en CI; los `if` efectivos resultantes deben ser lógicamente idénticos a los actuales para toda combinación (`dry_run × skip`).

### W4.4 eslint mínimo (app, alcance exacto)

- Agregar `eslint` + `eslint-config-expo` (versión fijada por el implementador según SDK 52) como `devDependencies` en `piiyaak-app/package.json` + `eslint.config.mjs` mínimo (extends del preset Expo, sin reglas custom salvo las necesarias para que el preset pase).
- Nuevo script: `"lint": "eslint src/db/update-notice.ts src/db/seed-resume.ts src/components/update-notice.tsx src/db/seed-expo.ts src/db/seed-download.ts src/db-context.tsx"`.
- **Alcance:** solo archivos tocados por W2/W3 (lista del script). Cero reformateo del resto del repo; `lint` debe pasar limpio en esos archivos; el resto del repo queda fuera del gate.

---

## Criterios de aceptación TDD por work unit

Cada work unit exige ciclo RED → GREEN → refactor verificado (test failing observado antes del código). Tabla de gates:

| WU | Gate RED (test que hoy falla) | Gate GREEN |
|---|---|---|
| W0 | Contrato §W0.2 contra respuesta real | `route.test.ts` en verde; cuerpo aceptado por `VersionResponseSchema` |
| W1 | `POST dispatch` sin token/allowlist; `GET runs` sin forma mínima; modal sin estados | 6 tests §W1.7 en verde; audit `SEED_DISPATCH` escrito |
| W2 | `remote > local` descarga sin avisar | 6 tests §W2.6 en verde; descarte persistido por versión |
| W3 | Interrupción → re-descarga completa siempre | 6 tests §W3.7 en verde; matriz §W3.2 completa |
| W4 | `latest.bytesTotal` diverge sin test; pasos duplicados; app sin lint | Test E2 en verde; diff E3 sin cambio semántico; `lint` limpio en alcance |

Comandos de verificación (web: `vitest run` + `tsc --noEmit`; app: `vitest run` + `tsc --noEmit` + `npm run lint`). `tsc --noEmit` en ambos repos → 0 errores.

## Casos borde (normativos, todos cubiertos por tests salvo indicación)

1. `GET /api/sync/version` con tabla `ContentVersion` vacía → `{"1", <ahora>}` (§W0.1.3).
2. Dispatch con `content_version: ""` → se omite la clave (no se envía vacío a GitHub) (§W1.5).
3. Doble clic en `Generar` → un solo `POST` (§W1.6, `processing`).
4. `dispatches` no devuelve run id → correlación por tiempo en polling (§W1.4).
5. GitHub `429/502` en polling → backoff 15/30/60 s + parada tras 3 fallos (§W1.4).
6. `latest.json` ausente/inválido/divergente → aviso con nulls, el gate manda (§W2.1).
7. Sin red en el gate → sin aviso, app con texto local (§W2.1.3).
8. Descarte persiste por versión; versión nueva re-avisa (§W2.4).
9. Registro de resume antiguo (sin `resumeData`) → `fresh` (§W3.1.2).
10. Servidor responde `200` al resume → `truncate-and-fresh`, nunca append (§W3.2).
11. `.part` de versión ajena → borrado por diseño (§W3.1.3).
12. Sin `Accept-Ranges` → `fresh` silencioso (§W3.6).
13. Error de integridad → sin reintento de resume (§W3.4).
14. **No cubiertos por unitarios** (requieren credenciales/dispositivo; pasos operativos del runbook §W4.1): dispatch real contra GitHub, `206` real del CDN, interrupción física a mitad de descarga, comportamiento iOS ante `Range` ignorado, primera publicación de `seed/<N>/`.
