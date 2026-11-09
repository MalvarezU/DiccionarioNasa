# DEPLOY — apk-offline-fase-b-endpoints (Etapa 2: sync público + endpoint CI)

## 1. Variables

| Variable | Alcance | Generación |
|---|---|---|
| `CI_SYNC_SECRET` | Solo `GET /api/sync/full` y Fase C | `openssl rand -base64 32` |

- Configurar el **mismo valor** en dos lados:
  1. Hostinger → entorno de la app web (`CI_SYNC_SECRET`).
  2. GitHub → secret de Actions (Fase C lo envía como header `X-CI-Secret`).
- Longitud mínima esperada: 32 bytes aleatorios (salida `openssl rand -base64 32` ≈ 44 chars).
- Vacío o ausente = falla cerrado: `/api/sync/full` responde 401 siempre.
  Las lecturas públicas (`/api/sync`, `/api/sync/seed`, `/api/sync/version`)
  no la necesitan y no se ven afectadas.
- `R2_PUBLIC_BASE_URL` debe estar configurada: sin base, `/api/sync/full`
  responde 500 completo (todo o nada, nunca bundle parcial).

## 2. Rotación

1. Generar nuevo valor: `openssl rand -base64 32`.
2. Actualizarlo en **Hostinger** (env `CI_SYNC_SECRET`) y redesplegar/reiniciar.
3. Actualizarlo en el **secret de GitHub Actions**.
4. Verificar (§3) con el secreto nuevo → 200; con el viejo → 401.
5. Nota: las lecturas públicas no se afectan en ningún paso (rotación sin
   downtime para la app instalada).

## 3. Verificación manual post-despliegue

```bash
HOST="https://<host>"

# Versión pública → 200 + Cache-Control público.
curl -s -o /dev/null -w "%{http_code}\n" "$HOST/api/sync/version"
curl -sI "$HOST/api/sync/version" | grep -i cache-control
# → public, s-maxage=60, stale-while-revalidate=300

# Seed público sin sesión → 200.
curl -s -o /dev/null -w "%{http_code}\n" "$HOST/api/sync/seed"

# Full sin secreto → 401 genérico.
curl -s -o /dev/null -w "%{http_code}\n" "$HOST/api/sync/full"
# → 401

# Full con secreto → 200 + foto de contenido y conteos.
curl -s -H "X-CI-Secret: $CI_SYNC_SECRET" "$HOST/api/sync/full" \
  | jq '{contentVersion, words: (.words|length), courses: (.courses|length), media: (.media|length)}'

# Coherencia del manifiesto: todo media con sha256 y cero huérfanos.
curl -s -H "X-CI-Secret: $CI_SYNC_SECRET" "$HOST/api/sync/full" \
  | jq -e '[.media[].sha256 | select(. == null)] | length == 0'
```

## 4. Nota `Cache-Control`

- Lecturas públicas (`/api/sync`, `/api/sync/seed`, `/api/sync/version`):
  `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
  Verificar tras el despliegue que el CDN/proxy de Hostinger **preserva**
  `s-maxage=60` (si lo despoja o lo reescribe, la frescura de la app
  instalada cambia: reportarlo antes de Fase C).
- `/api/sync/full` (200 y 401): `Cache-Control: private, no-store`.
  Las respuestas 500 no llevan encabezado de caché.

## 5. Condición Fase C (migración `sha256` a NOT NULL)

Pospuesta a Fase C con condición explícita (spec §3.5):

1. Backfill verificado en producción (`sha256` completo en `MediaAsset`).
2. Conteo de excluidos en cero durante observación: el test de coherencia
   (`missingMediaKeys`, `src/lib/sync/full-bundle.test.ts`) compara
   `refsToKeys(bundle)` contra `media[].objectKey` y reporta excluidos;
   solo con cero excluidos sostenidos se migra la columna a NOT NULL.

No se crea ni modifica `docs/Guia_Arranque_Despliegue.md` (no existe en el repositorio).
