# Spec: apk-offline-seed-fase-a — Etapa 1: versionado global + borrado lógico + registro de medios

- **Change ID:** `apk-offline-seed-fase-a`
- **Branch:** `feat/etapa1-content-version`
- **Repo scope:** solo `Diccionario-etapa1` (web). App móvil intacta. Admin UI sin cambios. PWA intacta.
- **Estado:** spec (deriva de `proposal.md` ya aprobado; decisiones D2 y D3 cerradas, no se reabren).
- **artifact_store.mode:** hybrid (file-based en `openspec/`; réplica en engram pendiente de runtime).
- **delivery_strategy:** ask-on-risk.

## 0. Alcance de este spec

Este documento es la referencia de implementación de la Fase A. No implementa código; define el DDL exacto, la semántica del bump, el borrado lógico por entidad, el registro de medios, el contrato sync aditivo, los criterios de aceptación TDD y los casos borde. La lista ruta-por-ruta del §2 es exhaustiva para esta fase: ningún otro handler requiere bump.

Supuestos declarados (una línea): el motor de tests (vitest) y el acceso a R2 en staging están disponibles; si no lo están, las fases 2 y 3 del plan se bloquean antes de escribir código.

## 1. DDL Prisma exacto

### 1.1 Tabla nueva `ContentVersion`

```prisma
model ContentVersion {
  id        Int      @id @default(1) // una sola fila, id = 1
  version   Int      @default(0)
  updatedAt DateTime @updatedAt
}
```

- Migración SQL (MySQL/MariaDB, aditiva e idempotente):

```sql
CREATE TABLE IF NOT EXISTS `ContentVersion` (
  `id` INT NOT NULL DEFAULT 1,
  `version` INT NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
);
INSERT IGNORE INTO `ContentVersion` (`id`, `version`) VALUES (1, 1);
```

- El `@default(0)` es el default de schema; la fila semilla arranca en `1` post-migración (criterio numérico del proposal: `version = 1 + N` tras N mutaciones).
- `updatedAt` existe para auditoría y diagnóstico; nunca se usa como marcador de publicación (decisión D2).

### 1.2 Columnas nuevas por tabla

**`Module`** (hoy sin `createdAt`, `updatedAt`, `deletedAt` ni `status`):

```prisma
model Module {
  id        String    @id @default(cuid())
  courseId  String
  title     String
  order     Int       @default(0)
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  course    Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lessons   Lesson[]

  @@index([courseId, order])
  @@index([updatedAt])
}
```

**`Lesson`** (hoy sin `updatedAt` ni `deletedAt`):

```prisma
model Lesson {
  id           String     @id @default(cuid())
  moduleId     String
  title        String
  order        Int        @default(0)
  lessonNumber Int?
  content      Json
  updatedAt    DateTime   @updatedAt
  deletedAt    DateTime?
  module       Module     @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  progress     UserLessonProgress[]

  @@index([moduleId, order])
  @@index([moduleId, lessonNumber])
  @@index([updatedAt])
}
```

- Nota de migración: `updatedAt NOT NULL` en tablas con filas existentes se backfillea con `DEFAULT CURRENT_TIMESTAMP(3)`; es el comportamiento estándar de Prisma en MySQL y no requiere script adicional.

**`MediaAsset`** (hoy sin `sha256` ni `updatedAt`):

```prisma
model MediaAsset {
  id         String   @id @default(cuid())
  objectKey  String   @unique
  filename   String
  mimeType   String
  size       Int
  sha256     String?  // hex SHA-256 (64 chars) sobre bytes originales; nullable hasta completar backfill
  uploadedBy String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([createdAt])
  @@index([updatedAt])
}
```

- `sha256` permanece nullable durante toda la Fase A; el paso a `NOT NULL` pertenece a Fase B y solo cuando el backfill esté verificado al 100%.

**`DictionaryWord`, `Course`:** sin columnas nuevas. Reutilizan `status`/`ARCHIVED` + `updatedAt` existentes (decisión D3).

Todas las columnas son aditivas: ningún campo existente cambia de tipo, nombre o nulabilidad.

## 2. Semántica del bump de versión

### 2.1 Helper único

Nuevo módulo `src/lib/content-version.ts`:

```ts
import { PrismaClient, Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

/** Incremento atómico +1. Retorna la versión resultante. Crea la fila (1,1) si no existe. */
export async function bumpContentVersion(tx: TxClient): Promise<number>;

/** Lectura fresca, sin caché en memoria. Retorna 1 si la tabla aún está vacía (pre-migración). */
export async function getContentVersion(): Promise<number>;
```

Implementación exigida:

- El incremento es `UPDATE ContentVersion SET version = version + 1 WHERE id = 1` (vía `$executeRaw` dentro del cliente transaccional recibido), nunca read-modify-write en JS.
- `bumpContentVersion` primero asegura la fila con `INSERT IGNORE INTO ContentVersion (id, version) VALUES (1, 1)` y luego aplica el `UPDATE` atómico, todo sobre el mismo `tx`.
- `getContentVersion` lee con `findUnique({ where: { id: 1 } })`; si no hay fila, retorna `1` sin crearla (la creación ocurre en el primer bump o en la migración).

### 2.2 Reglas de invocación

1. **Orden dentro de la transacción:** mutación primero, bump al final, dentro de la misma transacción Prisma (`db.$transaction`) donde el motor lo permita. Donde el handler hoy no usa transacción explícita, se envuelve mutación + bump en una.
2. **Fallo sin bump:** si la mutación falla (excepción, validación, 4xx/5xx antes del commit), no hay bump. El bump post-commit solo se admite donde la transacción conjunta sea imposible; en ese caso el orden es mutación → bump, y un bump fallido tras mutación exitosa se registra en log con nivel error (alerta), nunca se silencia.
3. **Una operación lógica = +1:** `bulk-status`, `import/confirm`, `revert` y `reorder` producen exactamente un bump aunque toquen N filas.
4. **No-op sin bump:** validaciones fallidas, 404, 409 (incluido revert ya aplicado) y operaciones que no modifican ninguna fila publicable (reorder idéntico, bulk con 0 filas afectadas) no hacen bump. El criterio `1 + N` del proposal se interpreta sobre mutaciones efectivas.
5. **Sin caché:** ningún handler cachea la versión; `sync`/`seed` la leen fresca con `getContentVersion()` por request.

### 2.3 Inventario ruta-por-ruta (exhaustivo para Fase A)

| # | Método + path | Archivo handler | Punto de bump |
|---|---|---|---|
| 1 | `POST /api/admin/words` | `src/app/api/admin/words/route.ts` | Tras `dictionaryWord.create` exitoso, misma transacción |
| 2 | `PUT /api/admin/words/[id]` | `src/app/api/admin/words/[id]/route.ts` | Tras `update` exitoso (incluye transición a/de `ARCHIVED`), misma transacción |
| 3 | `PATCH /api/admin/words/[id]` (si existe; si no, N/A verificado en spec-review) | mismo archivo | Igual que PUT |
| 4 | `DELETE /api/admin/words/[id]` | mismo archivo | Tras reemplazo lateral a `status = ARCHIVED` (ver §3.1), misma transacción |
| 5 | `POST /api/admin/words/bulk-status` | `src/app/api/admin/words/bulk-status/route.ts` | +1 por request con ≥1 fila afectada, misma transacción que el `updateMany` |
| 6 | `POST /api/admin/import` (legacy) | `src/app/api/admin/import/route.ts` | +1 por request con ≥1 fila aplicada (escribe filas reales, espejo de `confirm`, misma transacción); 0 filas o 4xx → sin bump |
| 7 | `POST /api/admin/import/confirm` | `src/app/api/admin/import/confirm/route.ts` | +1 por confirmación aplicada (≥1 fila), misma transacción |
| 8 | `POST /api/admin/import/preview` | `src/app/api/admin/import/preview/route.ts` | Sin bump: solo lectura |
| 9 | `POST /api/admin/audit-logs/[id]/revert` | `src/app/api/admin/audit-logs/[id]/revert/route.ts` | +1 por revert aplicado; 404/409 (ya revertido, conflicto con cambio posterior) sin bump |
| 10 | `POST /api/dictionary/update-audio` (legacy) | `src/app/api/dictionary/update-audio/route.ts` | +1 si modificó ≥1 fila `DictionaryWord`; ver §4.3 para registro de medios asociado. Queda marcado `@deprecated` (eliminación en Fase B) |
| 11 | `POST /api/admin/upload-audio` | `src/app/api/admin/upload-audio/route.ts` | +1 tras crear la fila `MediaAsset` (§4.1, reemplazo lateral que cierra la brecha de inventario) |
| 12 | `POST /api/admin/upload-image` | `src/app/api/admin/upload-image/route.ts` | +1 junto al `mediaAsset.create` existente, misma transacción lógica (compensación R2 vigente: si el insert falla, se borra el objeto y no hay bump) |
| 13 | `POST /api/admin/delete-audio` | `src/app/api/admin/delete-audio/route.ts` | +1 tras borrar objeto R2 y eliminar la fila `MediaAsset` resuelta por `objectKey` (§3.3); si no se resuelve fila ni objeto, 404/400 sin bump |
| 14 | `DELETE /api/media/[id]` | `src/app/api/media/[id]/route.ts` | +1 tras `deleteMediaAssetById` exitoso (fila + R2 best-effort, ver `src/lib/media/delete-asset.ts`); 404 sin bump |
| 15 | `POST /api/courses` | `src/app/api/courses/route.ts` | Tras `course.create`, misma transacción |
| 16 | `PUT /api/courses/[id]`, `DELETE /api/courses/[id]` | `src/app/api/courses/[id]/route.ts` | PUT: tras update. DELETE: tras reemplazo lateral a `status = ARCHIVED` (ver §3.1) |
| 17 | `POST /api/modules`, `PUT /api/modules/[id]`, `DELETE /api/modules/[id]` | `src/app/api/modules/route.ts`, `src/app/api/modules/[id]/route.ts` | POST/PUT: tras mutación. DELETE: tras `deletedAt = now()` (ver §3.2) |
| 18 | `POST /api/modules/[id]/lessons`, `PUT|DELETE /api/lessons/[id]`, `PUT|DELETE /api/courses/[id]/lessons/[lessonId]` | `src/app/api/modules/[id]/lessons/route.ts`, `src/app/api/lessons/[id]/route.ts`, `src/app/api/courses/[id]/lessons/[lessonId]/route.ts` | POST/PUT: tras mutación. DELETE: tras `deletedAt = now()` |
| 19 | `POST /api/courses/[id]/reorder` | `src/app/api/courses/[id]/reorder/route.ts` | +1 por request que reordene ≥1 módulo o lección; request no-op (listas vacías o orden idéntico) sin bump |

Notas:

- El punto 8 se lista explícitamente como **sin bump** (solo lectura, sin doble conteo con `confirm`). El punto 6 (legacy) sí bumpea desde C1: escribe filas reales fuera del flujo en dos pasos, así que no hay doble conteo con el punto 7.
- `src/app/api/courses/_lib.ts` (`createModule`, `updateModule`) es código compartido, no ruta: el bump se inserta en los handlers que lo llaman (puntos 17), no en la librería, para mantener la regla de +1 por operación lógica.
- Queda fuera de bump toda ruta de lectura, progreso de usuario (`progress`, `course-progress`, `games/*`, favoritos, historial) y auth: no son contenido publicable.

## 3. Borrado lógico por entidad

### 3.1 `DictionaryWord` y `Course` vía `ARCHIVED`

- Los DELETE físicos de los puntos 4 y 16 se reemplazan por `update({ data: { status: "ARCHIVED" } })`. El endpoint mantiene su código de respuesta actual (200/204 según cada handler).
- `DictionaryWord.status` es `String` libre: **normalización obligatoria**. Toda escritura de estado convierte a mayúsculas (`toUpperCase().trim()`) y valida contra `{"DRAFT", "PUBLISHED", "ARCHIVED"}`; valor inválido → 400. Esto cierra la regresión "archived minúscula invisible al sync".
- El sync existente (`src/app/api/sync/route.ts`) compara `w.status === "ARCHIVED"`: se cambia a comparación normalizada (`String(w.status).toUpperCase() === "ARCHIVED"`), tanto en el filtro de `words` como en la construcción de `removedIds`. Test de regresión exigido (§6, caso R-ARCHIVED).
- El árbol de cursos y las lecturas públicas ya excluyen `ARCHIVED`; verificar en spec-review que ningún `findMany` de cursos omita el filtro.

### 3.2 `Module` y `Lesson` vía `deletedAt`

- DELETE de los puntos 17 y 18 = `update({ data: { deletedAt: new Date() } })` + bump en la misma transacción. Respuesta HTTP sin cambios.
- Toda lectura pública y de seed del árbol de cursos excluye `deletedAt != null` (`where: { deletedAt: null }`). Incluye: `GET /api/courses`, `GET /api/courses/[id]`, `GET /api/courses/[id]/manifest`, `GET /api/modules*`, `GET /api/modules/[id]/lessons`, `GET /api/lessons/[id]`.
- Revert de un borrado lógico de Module/Lesson = `deletedAt = null` + bump (+1, regla 2.2.3).
- No se agrega `status` a Module/Lesson (decisión D3: rompería contrato y admin UI).

### 3.3 `MediaAsset` por diff de manifiesto (sin `deletedAt`)

- Decisión de spec (cierra el pendiente 3 del proposal): en `delete-audio` (punto 13) y `media DELETE` (punto 14) la fila `MediaAsset` se **elimina** (no se marca). La reconciliación de la APK es por diff: el manifiesto del seed lista `(objectKey, sha256)` vigentes y lo ausente respecto al caché local se considera borrado.
- Orden en `deleteMediaAssetById` ya vigente (fila primero, R2 best-effort después, huérfano recogido por `r2-prune`) se mantiene; el spec solo agrega el bump posterior al borrado de fila exitoso.
- `delete-audio` hoy solo borra el objeto R2: se extiende para resolver la fila por `objectKey` (vía `audioRefToKey` + `findFirst`) y eliminarla antes del borrado R2. Si la clave no resuelve a fila, se borra igualmente el objeto (compatibilidad) y el bump aplica igual, ya que el inventario efectivo cambió.

### 3.4 Exposición en `removedIds`

- Fase A: `GET /api/sync` mantiene su semántica actual (ventana por `since` + `removedIds` con ARCHIVED en ventana y tombstones DELETE de bitácora), con la comparación de `ARCHIVED` normalizada (§3.1).
- Los `deletedAt` de Module/Lesson **no** se exponen en `removedIds` en Fase A porque el árbol de cursos no está expuesto en el sync actual (riesgo R2 del proposal): Fase A deja versionado + borrado lógico listos y documenta la exposición del árbol como primer ítem de Fase B.
- Regla de bitácora: los reemplazos laterales (DELETE→ARCHIVED, DELETE→`deletedAt`) siguen registrando `AuditLog(action: "DELETE")` con el `entityId`, de modo que los tombstones existentes continúan funcionando sin cambios.

## 4. Registro de medios (`sha256`)

### 4.1 Hash en uploads (una línea sobre el buffer)

- En `upload-audio` (punto 11), `upload-image` (punto 12) y el path de escritura de `update-audio` (punto 10): calcular `sha256 = createHash("sha256").update(buffer).digest("hex")` sobre los bytes originales **antes** del `putObject`, y persistirlo en la fila `MediaAsset` (`sha256`, `objectKey`, `filename`, `mimeType`, `size`).
- `upload-audio` hoy no crea fila: reemplazo lateral obligatorio — tras `putObject` exitoso crea `MediaAsset` con el hash; si el insert falla, aplica la misma compensación que `upload-image` (borrar objeto R2, sin bump).
- `upload-image` agrega el campo `sha256` al `mediaAsset.create` existente; el resto del flujo (compensación incluida) no cambia.
- Formato: hex minúsculas, 64 caracteres. Validación en test con hash calculado independientemente (fixture binaria pequeña, §6).

### 4.2 Backfill idempotente y reanudable

Nuevo script `scripts/backfill-media-sha256.ts`:

1. Recorre `MediaAsset WHERE sha256 IS NULL` en lotes de 100 ordenados por `id` asc (reanudable: cada lote commitea por separado; interrumpir y re-ejecutar es seguro).
2. Por fila: descarga el objeto R2 por `objectKey`, calcula sha256, `UPDATE` solo esa fila. Segunda corrida sobre filas ya completas = 0 writes (idempotencia verificable).
3. Si el objeto R2 **ya no existe**: no falla (warning). Registra `{ objectKey, mediaAssetId }` en el reporte de huérfanos y continúa con la siguiente fila. Nunca borra la fila en el backfill (la purga física es fuera de alcance explícito).
4. Audios legacy sin fila: para cada `DictionaryWord.audioUrl` que resuelva a clave R2 (`audioRefToKey`) sin `MediaAsset` correspondiente: si el objeto existe, crea la fila (`filename` derivado de la clave, `mimeType` por firma binaria con `detectAudioMime`, `size` del objeto, `sha256` calculado); si no existe, lo anota en la sección "audios fuera de inventario" del reporte.
5. Salida: resumen en stdout + artefacto de reporte (JSON) con `{ updated, skipped, missingInR2[], legacyCreated[], legacyMissing[] }`. Criterio: segunda corrida = `{ updated: 0, legacyCreated: 0 }`.

### 4.3 `update-audio` legacy

- El handler actual asigna rutas locales (`/audio/*.wav`) sin buffer R2: en Fase A, por cada palabra tocada cuya `audioUrl` resultante resuelva a objeto R2 existente, crea o actualiza la fila `MediaAsset` con `sha256` calculado sobre los bytes descargados; las referencias locales sin objeto R2 se reportan como "fuera de inventario" sin crear fila y sin bloquear.
- Se marca el handler `@deprecated` en su docblock; su eliminación pertenece a Fase B.

## 5. Contrato sync aditivo

### 5.1 `contentVersion` en respuestas

- `GET /api/sync` (`src/app/api/sync/route.ts`) y `GET /api/sync/seed` (`src/app/api/sync/seed/route.ts`) agregan el campo `contentVersion: number` (vía `getContentVersion()`) al JSON de respuesta.
- Garantía de compatibilidad (patrón aditivo de `api-design-patterns`): ningún campo existente se renombra, cambia de tipo o se elimina; los tests de contrato (§6) hacen snapshot de las claves preexistentes (`words`, `removedIds`/`total`, `page`, `pageSize`, `totalPages`, `serverTime`, `nextCursor`) y asertan `contentVersion` adicional.
- Auth sin cambios (se mantiene `requireAuth`); la apertura pública del seed es decisión de Fase B.

### 5.2 Decisión `sinceVersion`: recorte explícito de Fase A

**Se recomienda exponer solo la versión actual en Fase A; `sinceVersion` queda recortado para Fase B.** Justificación:

1. Sin delta-query real por `updatedAt` + keyset (Fase B), un `?sinceVersion=` solo podría devolver `pendingChanges ≈ contentVersion − sinceVersion`, un conteo aproximado a nivel operaciones que invita a interpretarlo como lista exacta de cambios y a construir lógica de APK sobre una promesa falsa.
2. `GET /api/sync` ya acepta `since` (timestamp ISO) con semántica distinta; introducir `sinceVersion` en paralelo crea dos ejes de incrementalidad que colisionan y rompen la regla de consistencia del contrato.
3. El recorte no bloquea nada: la APK de Fase A ya puede comparar su versión cacheada contra `contentVersion` ("¿estoy atrasada?") y re-seedear; el "qué cambió" exacto es por definición Fase B.

## 6. Criterios de aceptación verificables (estilo TDD)

Cada criterio es un test RED→GREEN previo a su implementación mínima (skill `test-driven-development-tdd`); ningún bump, columna o campo sync existe sin su test failing previo. Nomenclatura sugerida `fase-a.<grupo>.test.ts`.

- [ ] **MIG-01 — Migración idempotente.** `prisma migrate deploy` corre dos veces seguidas sin errores; `ContentVersion` contiene exactamente una fila `(1, v>=1)`.
- [ ] **MIG-02 — Schema.** Introspección Prisma aserta: `Module`/`Lesson` con `updatedAt` + `deletedAt` nullable e índice en `updatedAt`; `MediaAsset` con `sha256` nullable + `updatedAt`.
- [ ] **BUMP-01 — Helper atómico.** `bumpContentVersion` sobre versión `v` deja `v+1` y retorna el nuevo valor; dos bumps concurrentes (`Promise.all`) dejan exactamente `+2` (sin lost update).
- [ ] **BUMP-02 — Un bump por operación lógica.** `bulk-status` sobre N palabras, `import/confirm` sobre N filas y `reorder` sobre N lecciones dejan `+1` cada uno, no `+N`.
- [ ] **BUMP-03 — Fallo sin bump.** Mutación con 400/404/409 (incluido revert ya aplicado y reorder no-op) deja la versión intacta.
- [ ] **BUMP-04 — Secuencia mixta.** N≥5 mutaciones efectivas consecutivas (words + media + courses) desde `v0` dejan `v0 + N` exacto.
- [ ] **BUMP-05 — Cobertura por grupo.** Cada punto con bump del §2.3 tiene un test que falla sin la llamada a `bumpContentVersion` y pasa con ella (trazabilidad test↔ruta en el nombre del test).
- [ ] **DEL-01 — Word/Course.** DELETE deja la fila con `status = "ARCHIVED"` (no desaparece) y la excluye de lecturas públicas; el bump aplicó.
- [ ] **DEL-02 — Module/Lesson.** DELETE deja `deletedAt` seteado, excluye del árbol público y aplica bump; revert del borrado (`deletedAt = null`) aplica +1.
- [ ] **DEL-03 — Media por diff.** `DELETE /api/media/[id]` y `delete-audio` eliminan fila + objeto (o reportan `storageDeleted: false`) y aplican bump; el `objectKey` ya no aparece en el inventario.
- [ ] **R-ARCHIVED — Regresión de case.** Palabra con `status = "archived"` (minúsculas, dato histórico) aparece en `removedIds` de `GET /api/sync` y no en `words`.
- [ ] **HASH-01 — Uploads.** Upload de audio e imagen con fixture binaria crea fila `MediaAsset` con `sha256` igual al hash calculado independientemente en el test.
- [ ] **HASH-02 — Backfill.** Primera corrida completa `sha256` faltantes y crea filas legacy existentes en R2; segunda corrida = 0 writes; objetos faltantes y audios fuera de inventario aparecen en el reporte sin fallar el script.
- [ ] **SYNC-01 — Contrato aditivo.** `GET /api/sync` y `GET /api/sync/seed` devuelven `contentVersion: number` con todas las claves preexistentes intactas (snapshot aditivo); el valor coincide con `getContentVersion()`.
- [ ] **GATES — Calidad.** `tsc --noEmit` 0 errores; linter del proyecto en limpio; suite TDD de Fase A en verde; `git status` confirma cero diffs en app móvil, Admin UI y PWA.

## 7. Casos borde

| # | Caso | Comportamiento exigido en Fase A |
|---|---|---|
| E1 | Concurrencia de bumps (dos admins guardan a la vez) | `UPDATE` atómico, sin read-modify-write; el conteo puede subir +2 ante dos operaciones reales distintas (correcto por D2: la versión cuenta operaciones, no tiempo). Sin idempotency-key en Fase A salvo donde ya exista; documentado como deuda si aparecen retries agresivos. |
| E2 | Revert de bitácora | Solo bump si el revert aplica (2xx). 409 por ya-revertido o por divergencia con cambios posteriores → sin bump y sin mutación. Revertir un DELETE físico histórico sin snapshot completo → 422 documentado, sin bump. |
| E3 | Reorder masivo | N módulos/lecciones reordenados = +1. Request válido pero no-op = 0 bumps. Orden parcial (algunos ids no pertenecen al curso) = +1 si ≥1 fila cambió. |
| E4 | Tombstones paginados (C2 CERRADO) | Loop keyset `(createdAt, id)` con `take: 1000` por página hasta página corta, sin tope duro (mismo patrón que el loop de words de `GET /api/sync`); el dedup por `Set` se mantiene y el shape de respuesta no cambia (solo puede traer MÁS `removedIds`). Test de volumen con 5001 filas verifica que el sync no trunca. Nota Fase B: si `removedIds` masivo agranda el payload, paginar la RESPUESTA, no la query. |
| E5 | R2 huérfano (objeto sin fila / fila sin objeto) | Objeto sin fila: lo crea el backfill si es referenciado (§4.2.4); el resto se lista en el reporte, sin purga. Fila sin objeto: warning en backfill, fila intacta. `r2-prune` existente sigue siendo el único recolector. |
| E6 | `update-audio` legacy sobre rutas `/audio/*.wav` locales | Sin fila `MediaAsset` (no hay objeto R2 que hashear); reporte "fuera de inventario"; bump solo por las filas `DictionaryWord` efectivamente tocadas. |
| E7 | Migración en MySQL/MariaDB productiva | Solo `ALTER TABLE` aditivos + `INSERT IGNORE`; dry-run en staging antes de producción; ventana de mantenimiento solo si el dry-run lo exige. |
| E8 | `Course.status` enum vs `DictionaryWord.status` libre | `Course` usa enum `ContentStatus` (case seguro por construcción); la normalización de §3.1 aplica a `DictionaryWord`. El sync normaliza ambos lados por igual. |

## 8. No-alcance reafirmado + primer ítem de Fase B

- Sin cambios en app móvil, Admin UI ni PWA (gate GATES lo verifica).
- Sin delta-sync por `updatedAt` + keyset, sin manifiesto completo descargable, sin descarga binaria masiva, sin tabla de tombstones, sin purga de R2 huérfano ni de `ARCHIVED` antiguos, sin `NOT NULL` en `sha256`, sin apertura pública del seed.
- **Primer ítem de Fase B:** exponer el árbol courses/modules/lessons (con `deletedAt` y `removedIds` correspondientes) en `sync`/`seed` + definir `sinceVersion` con delta-query real.

## 9. Trazabilidad de skills

- `api-design-patterns` (`/home/mario/.agents/skills/api-design-patterns/SKILL.md`): contrato aditivo sin breaking changes (§5.1), keyset aplicado en E4 (tombstones) y futuro para delta-sync de words (§1.2), idempotencia de bump y backfill (§2.1, §4.2), `sinceVersion` recortado por riesgo de contrato (§5.2). Aplicada en §§1, 2, 4, 5 y casos E1/E4.
- `test-driven-development-tdd` (`/home/mario/.pi/agent/skills/test-driven-development-tdd/SKILL.md`): ciclo RED→GREEN→refactor por cada bump, columna, hash y campo sync; "sin test failing previo no hay código". Aplicada en §6 (criterios MIG/BUMP/DEL/HASH/SYNC/R) y en el plan por fases del proposal §7.
- Evidencia base: `proposal.md` aprobado (requerido, leído primero) + verificación puntual en `prisma/schema.prisma`, `src/app/api/sync/route.ts`, `src/app/api/sync/seed/route.ts`, `src/lib/media/storage.ts`, `src/app/api/admin/upload-audio/route.ts`, `src/app/api/admin/upload-image/route.ts`, `src/lib/media/delete-asset.ts`, `src/app/api/admin/delete-audio/route.ts`, `src/app/api/dictionary/update-audio/route.ts`, `src/app/api/media/[id]/route.ts`, `src/app/api/courses/[id]/reorder/route.ts`, `src/app/api/admin/words/[id]/route.ts`, `src/app/api/admin/audit-logs/[id]/revert/route.ts`; inventario de rutas vía glob de `src/app/api/**/route.ts`. Sin re-mapeo de cero.
