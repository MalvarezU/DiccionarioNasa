# Spec: apk-offline-fase-b-endpoints — Etapa 2: sync público + endpoint CI

- **Change ID:** `apk-offline-fase-b-endpoints`
- **Branch:** `feat/fase-b-endpoints`
- **Repo scope:** solo web (`Diccionario-endpoints`). App móvil intacta. Workflows de GitHub Actions intactos. Admin UI sin cambios.
- **Estado:** spec (deriva de `proposal.md` aprobado; decisiones F1 PUBLISHED-only y F2 bundle único cerradas, no se reabren).
- **artifact_store.mode:** hybrid (file-based en `openspec/`; engram pendiente).
- **delivery_strategy:** auto-chain (W1 → W2 → W3 → W4; cada work unit con gate TDD antes de avanzar).

## 0. Alcance de este spec

Este documento es la referencia de implementación de la Etapa 2. No implementa código; define la firma exacta de cada ruta nueva o modificada, la ubicación exacta de los cambios en `sync`/`seed`, el contrato del autenticador CI, el serializador del árbol de cursos, el constructor del manifiesto por referencias con su alcance de parser fijado, el contenido de `.env.example`, la estructura del `DEPLOY.md` del change, los criterios de aceptación TDD y los casos borde. La lista ruta-por-ruta de los §1–§3 es exhaustiva: ningún otro handler requiere cambios.

Supuesto declarado (una línea): el motor de tests (vitest) y el acceso a R2 en staging se encuentran disponibles; en caso contrario, W3 se bloquea antes de escribir código.

Convenciones: los errores de servidor conservan el formato existente `{ message: "Error interno del servidor" }` con estado 500. Ningún campo preexistente de `sync`/`seed`/`courses` cambia de forma (compatibilidad aditiva). El copy de errores nuevos se mantiene en español, consistente con `auth.ts` y las rutas actuales.

## 1. W1 — `GET /api/sync/version`

### 1.1 Ruta

Nuevo archivo `src/app/api/sync/version/route.ts`. Sin autenticación, sin parámetros, sin paginación.

```ts
export async function GET(_request: NextRequest): Promise<NextResponse>
```

Comportamiento: lectura fresca mediante `getContentVersion()` (sin caché en memoria en esta fase, idéntico a `sync`/`seed` actuales). No se agrega capa de memoización.

### 1.2 Response exacta

Estado 200, cuerpo JSON:

```json
{ "contentVersion": 41 }
```

- `contentVersion`: número entero (`getContentVersion()`, 1 cuando la tabla se encuentra vacía).
- Sin campos adicionales. Sin `serverTime`, sin `nextCursor`, sin `words`.

### 1.3 Encabezado de caché

Valor exacto, en esta ruta y en todas las lecturas públicas nuevas o modificadas:

```
Cache-Control: public, s-maxage=60, stale-while-revalidate=300
```

Es el primer precedente de `Cache-Control` del repositorio (ninguna ruta lo emite hoy). El valor se repite literalmente en W2. La respuesta de error 500 no lleva este encabezado.

### 1.4 Errores

| Condición | Estado | Cuerpo |
|---|---|---|
| Éxito | 200 | `{ contentVersion: N }` + `Cache-Control` |
| Excepción interna | 500 | `{ message: "Error interno del servidor" }` |

No existe 401 ni 400 en esta ruta: no hay sesión que validar ni parámetros que parsear.

### 1.5 Tests TDD (W1)

1. Sin sesión → 200, forma exacta `{ contentVersion: number }`, encabezado `Cache-Control` con el valor exacto del §1.3.
2. Avance de versión: tras una mutación con bump (p. ej. actualización de palabra en transacción con `bumpContentVersion`), una segunda lectura devuelve `N+1`.

## 2. W2 — Sync público con caché (D1 + F1)

### 2.1 Eliminación de `requireAuth` (ubicación exacta)

- `src/app/api/sync/route.ts`: eliminar líneas 3 (`import { requireAuth } from "@/lib/auth"`) y 45–46 (`const { error } = await requireAuth()` / `if (error) return error`). El bloque `try` y todo el código posterior se conservan sin cambios de indentación más allá del dedentado mecánico.
- `src/app/api/sync/seed/route.ts`: eliminar líneas 3 (`import { requireAuth }`) y 11–12 (mismo guard). Sin otros cambios de import.

Las escrituras (favoritas, historial, progreso, admin) conservan sus guards sin modificación. El flag `showAll` de editor en cursos no se toca.

### 2.2 Filtro PUBLISHED-only en consulta (decisión F1)

**`sync/route.ts` (líneas 75–79).** El `where` actual es solo el filtro de ventana (`updatedFilter`). Pasa a ser conjunción obligatoria:

```ts
const rows = await db.dictionaryWord.findMany({
  where: {
    AND: [
      { status: "PUBLISHED" },
      updatedFilter,
    ],
  },
  orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
  take: limit + 1,
})
```

El post-filtro JS de líneas 122–130 se reemplaza:

- Sale: el `.filter(w => status !== "ARCHIVED")` sobre `page` para construir `words` (líneas 129–130). Con el filtro en consulta, `page` ya contiene solo PUBLISHED; el mapeo a la forma pública se aplica directo.
- Se conserva: la derivación de `removedIds` (líneas 122–127). Con el filtro DB, `page.filter(ARCHIVED)` queda vacío por construcción, pero la línea se mantiene como defensa (costo cero, protege contra regresión si el `where` se altera en el futuro) más la lista de `tombstoneIds` del loop keyset (líneas 89–121, intacto, sin tocar `take: 1000` ni el patrón `createdAt/id`).
- El filtro de ventana (`since`/`cursor`, líneas 63–73) y la paginación keyset (`limit`, `encodeCursor`/`decodeCursor`) se preservan byte por byte.

**`seed/route.ts` (línea 23).** Ya filtra en DB y no cambia:

```ts
const where = { status: "PUBLISHED" }
```

Se verifica en review que el `where` compartido por `count` + `findMany` (líneas 24–31) siga siendo el mismo objeto.

### 2.3 Forma pública de word (contrato congelado)

Ambas rutas devuelven por elemento exactamente:

```
id, spanish, nasaYuwe, pronunciation, audioUrl, illustrationUrl,
culturalContext, category, examples, status, updatedAt (ISO string)
```

Ningún campo se agrega ni se elimina. `status` será siempre `"PUBLISHED"` en `upserts`; se mantiene en el payload por compatibilidad aditiva (la app lo espera).

Respuesta `sync` (forma intacta + encabezado nuevo):

```json
{
  "words": [ ... ],
  "removedIds": ["..."],
  "contentVersion": 41,
  "serverTime": "2026-11-07T00:00:00.000Z",
  "nextCursor": null
}
```

Respuesta `seed` (forma intacta + encabezado nuevo): `{ words, total, page, pageSize, totalPages, contentVersion, serverTime }`.

### 2.4 Encabezado `Cache-Control`

Idéntico valor que W1 en ambas rutas, solo en respuestas 200:

```
Cache-Control: public, s-maxage=60, stale-while-revalidate=300
```

Implementación: tercer argumento de `NextResponse.json(body, { headers: { "Cache-Control": "..." } })` en cada `return` de éxito. Las respuestas 400/500 existentes no lo llevan.

### 2.5 Centralización de `isEditor()` — decisión

Los tres helpers locales `isEditor()` (`courses/[id]/route.ts:13`, `courses/[id]/manifest/route.ts:9`, `courses/[id]/lessons/[lessonId]/route.ts:10`) quedan intactos en este change. Justificación: W2 no modifica ninguna ruta de courses; centralizar implicaría tocar tres archivos fuera del diff mínimo con riesgo de cambio de comportamiento en vistas de editor. Se registra como deuda en §6.

### 2.6 Tests TDD (W2) y casos de regresión

Con fixture mixta (al menos 1 PUBLISHED + 1 DRAFT + 1 ARCHIVED + 1 tombstone por `AuditLog` DELETE):

1. `GET /api/sync` sin sesión → 200 (antes 401). Encabezado `Cache-Control` presente con valor exacto.
2. `GET /api/sync/seed` sin sesión → 200 (antes 401). Encabezado presente.
3. Cero filas DRAFT o ARCHIVED en `upserts` de ambas rutas (regresión F1/R1).
4. ARCHIVED + tombstones preservados en `removedIds` de `sync` (regresión post-C2: loop keyset de 1000 intacto).
5. `contentVersion` presente en ambas respuestas.
6. Suite Fase A en verde (tombstones keyset post-C2, bumps T10/T11): sin regresión.

## 3. W3 — `GET /api/sync/full` + manifiesto por referencias (D3 + D4)

### 3.1 `src/lib/ci-auth.ts` (nuevo)

```ts
import { timingSafeEqual } from "node:crypto"

/** Lee el secreto esperado; null si no configurado (falla cerrado). */
export function expectedCiSecret(): string | null

/** Compara en tiempo constante con resguardo de longitud. */
export function isValidCiSecret(provided: string | null | undefined): boolean

/** Respuesta 401 genérica, sin distinguir ausencia de inválido. */
export function ciUnauthorized(): Response
```

Semántica exacta:

- Fuente: `process.env.CI_SYNC_SECRET`. Vacío o ausente → `expectedCiSecret()` retorna `null` y toda validación falla (falla cerrado; la ruta responde 401 aunque el llamante no envíe nada).
- Comparación: `timingSafeEqual(Buffer(a), Buffer(b))` solo cuando las longitudes coinciden; si difieren, retorno `false` inmediato sin comparar (resguardo obligatorio: `timingSafeEqual` lanza con longitudes distintas). Comparar primero `a.length !== b.length` no filtra información útil (la longitud del secreto no es el secreto).
- Entrada: encabezado `X-CI-Secret` (`request.headers.get("x-ci-secret")`). Valor ausente, vacío o no-string → inválido. Nunca query string (el secreto en URL queda en access logs).
- Respuesta 401: `Response.json({ message: "No autorizado" }, { status: 401 })`. Mensaje idéntico con y sin encabezado (sin oráculo). Sin `Cache-Control` público; explícitamente `Cache-Control: private, no-store` en 200 y 401 de esta ruta.
- Sin log del valor recibido ni del esperado, en ningún nivel.

Rate-limit: se omite en esta ruta con justificación documentada (un solo consumidor — GitHub Actions —, IP compartida de runners que convierte un límite por IP en denegación agregada, y ausencia de caché en ruta autenticada que impide absorber picos). La decisión queda registrada aquí; no se importa `checkRateLimit`/`getClientIp`.

Tests TDD: sin encabezado → 401 genérico; secreto inválido → 401 idéntico (mismo cuerpo y estado, sin distinción); secreto válido → pasa; longitudes distintas no lanzan; `CI_SYNC_SECRET` ausente → todo 401.

### 3.2 `GET /api/sync/full` — contrato exacto

Nuevo archivo `src/app/api/sync/full/route.ts`.

**Request:**

```
GET /api/sync/full
X-CI-Secret: <CI_SYNC_SECRET>
```

Sin query params (cualquier param se ignora; no hay 400 por params extra). Sin paginación (decisión F2). Sin sesión NextAuth (la clave CI es la única credencial).

**Response 200:**

```json
{
  "contentVersion": 41,
  "words": [
    {
      "id": "...", "spanish": "...", "nasaYuwe": "...",
      "pronunciation": "...", "audioUrl": "...", "illustrationUrl": "...",
      "culturalContext": "...", "category": "...", "examples": "...",
      "status": "PUBLISHED", "updatedAt": "2026-11-07T00:00:00.000Z"
    }
  ],
  "courses": [
    {
      "id": "...", "title": "...", "description": "...",
      "coverImage": "...", "status": "PUBLISHED",
      "sequential": true, "createdAt": "...", "updatedAt": "...",
      "modules": [
        {
          "id": "...", "courseId": "...", "title": "...", "order": 0,
          "updatedAt": "...",
          "lessons": [
            { "id": "...", "moduleId": "...", "title": "...", "order": 0,
              "lessonNumber": 1, "content": { "version": 2, "blocks": [] },
              "updatedAt": "..." }
          ]
        }
      ]
    }
  ],
  "media": [
    { "objectKey": "audios/...", "url": "https://cdn.../...",
      "sha256": "64hex...", "size": 1234, "mimeType": "audio/mpeg" }
  ]
}
```

- `words[]`: misma forma pública que §2.3, `status` siempre `"PUBLISHED"`, orden estable por `id asc` (igual que `seed`, sin paginación: `take` sin límite).
- `courses[]`: solo `status: "PUBLISHED"`, orden por `id asc`. Cada curso incluye `modules` (`deletedAt: null`, `order asc`) con `lessons` (`deletedAt: null`, `lessonNumber asc, id asc`) con `content` incluido (decisión D3: el bundle CI sí embarca bloques, a diferencia del manifest público que los recorta).
- `media[]`: solo filas referenciadas por el bundle (D4, §3.4), cada una con `sha256` no nulo (R3(b), §3.5). `url` es la URL pública R2 derivada con `publicUrl(objectKey)`.
- `contentVersion`: foto atómica tomada en el mismo request que los datos (misma lectura `getContentVersion()`; no se exige transacción `SERIALIZABLE`, el criterio es observabilidad: el número acompaña al payload para SKIP-BUILD de Fase C).

**Errores:**

| Condición | Estado | Cuerpo |
|---|---|---|
| Sin secreto o inválido | 401 | `{ message: "No autorizado" }` |
| Excepción interna (incluye R2 caído durante serialización) | 500 | `{ message: "Error interno del servidor" }` |

R2 caído no degrada a bundle parcial: si `publicUrl`/base falta o la construcción del manifiesto lanza, la ruta responde 500 completo (todo o nada). No existe 206 ni bundle sin `media`.

### 3.3 Serializador del árbol de cursos

Reutiliza el include del detalle público `courses/[id]/route.ts:26-41` generalizado a lista:

```ts
db.course.findMany({
  where: { status: "PUBLISHED" },
  orderBy: { id: "asc" },
  include: {
    modules: {
      where: { deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        lessons: {
          where: { deletedAt: null },
          orderBy: [{ lessonNumber: "asc" }, { id: "asc" }],
        },
      },
    },
  },
})
```

Recortes obligatorios respecto del detalle:

1. **Rama `stats` excluida** (`route.ts:55-91`, solo editor+): el bundle no ejecuta ninguna consulta a `userLessonProgress` ni devuelve `alumnos`/`promedioPct`/`completadas`. Test: la respuesta no contiene la clave `stats` en ningún nivel.
2. **`deletedAt` excluido en cada nivel**: `where: { deletedAt: null }` en módulos y lecciones; cursos ARCHIVED excluidos por `status`. Sin borrado físico en el bundle.
3. **Words embebidas PUBLISHED-only**: donde el bundle resuelva palabras referenciadas por bloques (`word`/`vocabulary` vía `wordIdsUsedByContent`), el `where` incluye `status: "PUBLISHED"` (precedente: `lessons/[lessonId]/route.ts:93-94`). Documento corrupto (`parseLessonContent` falla) → cero palabras para esa lección, la lección igual se incluye (precedente on-demand §87-90).

`interactiveCount` no se computa en el bundle. Si algún índice futuro lo necesita, la regla es la del manifest (`countInteractive`: corrupto → 0, nunca lanzar).

### 3.4 Constructor de manifiesto — módulo `src/lib/sync/full-bundle.ts` (nuevo)

Funciones puras y testeables sin HTTP:

```ts
import type { LessonBlock } from "@/lib/courses/blocks"

/** Todas las URLs R2 candidatas referenciadas por el contenido PUBLISHED. */
export function collectMediaRefs(input: {
  words: Array<{ audioUrl: string | null; illustrationUrl: string | null }>
  courses: Array<{ coverImage: string | null }>
  lessonBlocks: LessonBlock[][]
}): string[]

/** Deriva la clave R2 de una URL pública por strip de la base. null si no deriva. */
export function publicUrlToKey(url: string): string | null

/** Filtra refs a claves R2 válidas y deduplica. Sin tabla completa. */
export function refsToKeys(urls: readonly string[]): string[]
```

Reglas de extracción (fuentes cerradas, solo contenido PUBLISHED del bundle):

1. `words.audioUrl`, `words.illustrationUrl`: tal cual (pueden ser `null` → se omiten).
2. `course.coverImage`: solo si `isAllowedCoverImageUrl(url)` es verdadero; solo entran al manifiesto URLs bajo `R2_PUBLIC_BASE_URL` (el redirect legacy `/api/media/<id>` se excluye del manifiesto: no es objeto R2 directo).
3. Bloques de lección (`blocks.ts:69-107`): `image.url`, `audio.media.url`, `listening.media.url`. `video.youtubeId` excluido por diseño (no es R2). `word`/`vocabulary` no aportan medios.
4. `text.html` con `<img>` embebida: **alcance fijado — NO se extrae**. Justificación: el sanitizador (`text-sanitizer.ts:19-36`) opera con whitelist cerrada de 12 tags (`TEXT_BLOCK_ALLOWED_TAGS`) que no incluye `img`; todo `<img>` embebido se elimina antes de guardar, por lo que el HTML persistido nunca contiene imágenes referenciables. Implementar extracción por expresión regular sobre HTML equivaldría a parsear un formato que el pipeline ya garantiza ausente. Si el whitelist incluye `img` en el futuro, este spec se enmienda y el extractor se extiende con fixture. La laguna queda documentada aquí en lugar de código improvisado.
5. Derivación de clave: `publicUrlToKey` hace strip de `R2_PUBLIC_BASE_URL` (vía `r2PublicBase()` de `media/storage.ts`), corta query string (`?…`), valida con la misma política de clave segura (sin `..`, charset admitido). No existe equivalente a `audioRefToKey` para imágenes: esta función es la única vía (un solo módulo, sin duplicar lógica de strip en cada extractor). Legacy Supabase y claves relativas se resuelven solo para audio vía `audioRefToKey` existente; para imagen fuera de base R2 → `null` (excluida).
6. Consulta: `db.mediaAsset.findMany({ where: { objectKey: { in: keys }, sha256: { not: null } } })`. Nunca tabla completa (anti-huérfanos R4). Elemento: `{ objectKey, url: publicUrl(objectKey), sha256, size, mimeType }`.

### 3.5 Regla `sha256` NULL — R3(b) fijada

Se adopta la opción (b) del proposal: filtro `WHERE sha256 IS NOT NULL` en la consulta del manifiesto + test de coherencia que falla si alguna referencia PUBLISHED carece de fila con hash. Sin migración NOT NULL en este change (pospuesta a Fase C con condición: backfill verificado en producción + conteo de excluidos en cero durante observación, registrado en el DEPLOY).

Test de coherencia: con fixture donde una URL referenciada no tiene `MediaAsset` o lo tiene con `sha256: null`, el test que compara `refsToKeys(bundle)` contra `media[].objectKey` falla y reporta la lista de excluidos. En verde, cero excluidos.

### 3.6 Tests TDD (W3)

1. Sin encabezado → 401 con cuerpo genérico exacto.
2. Secreto inválido → 401 idéntico al anterior (mismo estado y cuerpo; sin oráculo de tiempo ni mensaje).
3. Secreto válido → 200 con forma `{ contentVersion, words[], courses[], media[] }`.
4. Coherencia: todo word/course PUBLISHED; todo `media[].sha256` no nulo (64 hex); todo `objectKey` referenciado por el bundle (cero huérfanos: `media[].objectKey ⊆ refsToKeys(bundle)`).
5. Recorte: respuesta sin clave `stats`; sin `deletedAt` en módulos/lecciones; fixture con curso ARCHIVED y módulo con `deletedAt` no aparecen.
6. Alcance de parser con fixture: bloque `image` R2 incluido, `video.youtubeId` excluido, `coverImage` externa (no R2) excluida, `text.html` con `<img>` no aporta refs (documenta §3.4.4).

## 4. W4 — Documentación y entorno (D5)

### 4.1 `.env.example` (contenido a agregar)

Al final del archivo, tras el bloque `ADMIN_*`, sin alterar ninguna línea existente:

```bash
# Semilla offline para CI (Fase B, GET /api/sync/full). Requerido SOLO para
# esa ruta y para Fase C; las lecturas públicas no lo necesitan.
# Generar con: openssl rand -base64 32
# Configurar el mismo valor en Hostinger (env CI_SYNC_SECRET) y como secret
# de GitHub Actions (Fase C lo envía como header X-CI-Secret).
# Rotar = cambiar en ambos lados; sin downtime en lecturas públicas.
CI_SYNC_SECRET=""
```

Vacío por defecto (falla cerrado: §3.1). El comentario incluye generación, alcance y rotación en tres líneas.

### 4.2 `DEPLOY.md` del change (estructura)

Nuevo archivo `openspec/changes/apk-offline-fase-b-endpoints/DEPLOY.md`:

1. **Variables**: `CI_SYNC_SECRET` (generación `openssl rand -base64 32`, dónde configurarla en Hostinger, longitud mínima esperada).
2. **Rotación**: pasos (generar → Hostinger → secret de Actions → verificar), nota de que las lecturas públicas no se afectan.
3. **Verificación manual post-despliegue** (comandos reproducibles):
   - `curl -s -o /dev/null -w "%{http_code}" https://<host>/api/sync/version` → 200 + inspección de `Cache-Control`.
   - `curl ... /api/sync/seed` sin sesión → 200.
   - `curl ... /api/sync/full` sin secreto → 401; con secreto → 200 + `jq '{contentVersion, words: (.words|length), courses: (.courses|length), media: (.media|length)}'`.
4. **Nota `Cache-Control`**: verificación del encabezado tras despliegue (CDN/proxy de Hostinger debe preservar `s-maxage=60`).
5. **Condición Fase C**: backfill verificado + excluidos en cero antes de migrar `sha256` a NOT NULL.

No se crea ni modifica `docs/Guia_Arranque_Despliegue.md` (no existe en el repositorio).

## 5. Criterios de aceptación TDD (los 5 del plan, verificables)

1. `GET /api/sync/version` sin sesión → 200 `{ contentVersion }` con `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
2. `GET /api/sync?since=...` y `GET /api/sync/seed` sin sesión → 200; con fixture mixta: ninguna fila DRAFT en `upserts`; ARCHIVED sigue en `removedIds`; `contentVersion` presente; encabezado de caché presente.
3. `GET /api/sync/full` sin header → 401; con secreto inválido → 401 (mismo cuerpo); con secreto válido → 200 con `{ contentVersion, words[], courses[], media[] }` donde todo word/course es PUBLISHED, todo `media[].sha256` es no nulo, y ningún `objectKey` es huérfano (referenciado por el bundle).
4. `npx tsc --noEmit` → 0 errores; `npx vitest run` (grupo nuevo + Fase A sin regresión) → verde; eslint en rutas tocadas → 0.
5. `.env.example` documenta `CI_SYNC_SECRET`; `DEPLOY.md` del change actualizado (configuración, rotación, verificación manual).

Gates por work unit: W1 (tests §1.5 + Fase A verde) → W2 (tests §2.6) → W3 (tests §3.1/§3.6, suborden: `ci-auth` → serializador → manifiesto) → W4 (revisión de docs). Orden secuencial, sin test failing previo no hay código (test-driven-development-tdd).

## 6. Casos borde

| # | Caso | Comportamiento esperado |
|---|---|---|
| E1 | Secreto rotado (valor viejo en Actions, nuevo en Hostinger) | 401 genérico hasta sincronizar ambos lados; lecturas públicas intactas (rotación sin downtime). Test: secreto anterior → 401, nuevo → 200. |
| E2 | Bundle vacío (cero words y cero courses PUBLISHED) | 200 con `{ contentVersion, words: [], courses: [], media: [] }`. Sin 404 ni 500. |
| E3 | R2 caído durante serialización del bundle | 500 completo `{ message: "Error interno del servidor" }`; nunca bundle parcial sin `media`. Test con base R2 ausente / `r2PublicBase()` nulo. |
| E4 | Curso PUBLISHED sin módulos (o módulos todos con `deletedAt`) | Curso presente con `modules: []`. Sin exclusión del curso ni error. |
| E5 | Lección con `content` corrupto (falla `parseLessonContent`) | La lección se incluye con su `content` crudo; `interactiveCount` (si se computa en el futuro) = 0; palabras referenciadas = `[]`. Nunca rompe el bundle (precedente on-demand). Test con `content: { blocks: "roto" }`. |
| E6 | `CI_SYNC_SECRET` ausente en entorno | `expectedCiSecret()` → `null`; toda llamada a `/api/sync/full` → 401. Las rutas públicas no se afectan. |
| E7 | `text.html` con `<img>` embebida en fixture | No aporta referencias (alcance §3.4.4). El test lo fija como exclusión documentada, no como extracción. |
| E8 | `coverImage` legacy `/api/media/<id>` | Excluida del manifiesto (no es clave R2). Test con curso con portada legacy → `media` sin esa entrada, curso intacto. |

## 7. Deudas conocidas y no-alcance reafirmado

- `isEditor()` triplicado en courses (§2.5): se deja como está; centralizar queda como deuda documentada.
- Migración `sha256` NOT NULL: pospuesta a Fase C con condición explícita (§3.5).
- App móvil, workflows, Admin UI, PWA, paginación del bundle, limpieza física de huérfanos R2, purga de ARCHIVED: fuera de alcance (proposal §3).
- Trazabilidad de skills: `api-design-patterns` (caché HTTP nativa, clave de servicio por encabezado con comparación en tiempo constante y error genérico, contrato aditivo, manifiesto por referencias; aplicada en §1–§3) y `test-driven-development-tdd` (ciclo RED → GREEN → refactor por ruta, filtro, autenticador, serializador y extractor; aplicada en §5 y gates por work unit).
