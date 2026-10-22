# Media en Cloudflare R2 — Rama `feat/r2-media`

## 1. Arquitectura

| Antes | Después (esta rama) |
|---|---|
| Imágenes: `MediaAsset.data` LONGBLOB en MariaDB | Binario en R2 (`images/<uuid>.<ext>`), solo metadatos + `objectKey` en BD |
| Audios: Supabase Storage (bucket `audios`) | R2 (`audios/<wordId>/<ts>-<file>`), URLs públicas permanentes |
| `/api/media/[id]` servía bytes (200, immutable) | **302** a la URL pública (compat con URLs ya guardadas) |
| `@supabase/supabase-js` | Eliminado: cero dependencia de Supabase |

## 2. Decisiones

1. **URLs públicas, no firmadas.** Las URLs se guardan en BD y las cachea el
   service worker offline; las firmadas expiran y romperían el diseño.
2. **Upload por servidor, no presign.** Preserva la validación por firma
   binaria (`validateImageUpload`), imposible con presign. Archivos ≤10 MB.
3. **Prisma, no mysql2.** Una sola capa de datos.
4. **Un bucket, prefijos `images/` y `audios/`.** `fixtures/` queda fuera de
   los prefijos gestionados (nunca lo toca el prune).
5. **Claves deterministas** (`images/<id>.<ext>`) → migración y prune
   idempotentes (HEAD previo, re-ejecutables).

## 3. Contratos

- `POST /api/admin/upload-image` → `{ id, objectKey, url }` (URL pública R2).
  Si la BD falla tras el upload, el objeto se borra (anti-huérfano).
- `POST /api/admin/upload-audio` → `{ audioUrl, objectKey }`.
- `DELETE /api/admin/delete-audio` y borrado de ficha aceptan URL R2, URL
  legacy Supabase (pública o firmada) o clave directa.
- Portadas (`PATCH /api/courses/[id]`): allowlist `/api/media/` legacy +
  base pública R2 (`isAllowedCoverImageUrl`, misma regla en el E2E).
- `next/image` necesita `remotePatterns`: `*.r2.dev` + host custom por env
  (`R2_PUBLIC_BASE_URL`).

## 4. Operación

Variables (`R2_*` en `.env`, ver `.env.example`): `ACCOUNT_ID`,
`ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `BUCKET`, `PUBLIC_BASE_URL`
(dominio custom o `r2.dev`), `ENDPOINT_OVERRIDE` (solo tests locales).

Scripts (todos dry-run por defecto, `--apply --confirm <bucket>` ejecuta):

| Script | Uso |
|---|---|
| `scripts/r2-smoke.ts` | PUT → HEAD → GET público → DELETE (verifica credenciales) |
| `bun run db:migrate-media-to-r2` | Migra legacy (columna `data`, audios Supabase) a R2 |
| `bun run db:r2-prune` | Borra objetos `images/`/`audios/` sin referencia en BD |

E2E: `scripts/e2e-local.sh` suma `.env.r2.test` si existe (sin él, los
uploads devuelven 500). El proyecto `offline-media` requiere
`E2E_R2_IMAGE_URL` apuntando a una imagen real del bucket de test
(hay fixtures estables en `fixtures/fase5-probe*.png`).

Service worker (`public/sw.js` v3): `IMAGE_CACHE` (tope 100) para el origen
R2 + `AUDIO_CACHE` (tope 50); se guardan respuestas `ok` **y opacas**
(`<img>`/`<audio>` piden no-cors: sin esto el caché nunca se llena).

## 5. Migración a producción (cuando se apruebe)

**Backup con mysqldump antes de todo.** Secuencia (la migración de esta rama
asume tabla vacía; con filas hay que partirla):

1. Migración A: `ADD objectKey NULL` (sin dropear `data`).
2. `migrate-media-to-r2 --apply --confirm <bucket-prod>` (sube y registra).
3. Migración B: `DROP data`, `SET objectKey NOT NULL + UNIQUE`.
4. `r2-prune` para verificar cero huérfanos.
5. Reescribir `audioUrl` legacy ya lo hace el script del paso 2.

## 6. Criterios de aceptación

✅ Subida de imagen/audio desde `/admin` funciona contra R2 con la misma UX.
✅ URLs públicas, permanentes y cacheables por el SW (test offline verde).
✅ Datos legacy migrables con script idempotente + backup previo.
✅ `@supabase/supabase-js` fuera de la rama.
✅ Suite unit (879) + E2E (45) verde.
