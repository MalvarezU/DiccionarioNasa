# DEPLOY — Robot de semilla offline (Fase C, W2)

Change: `apk-offline-fase-c-seed` · workflow: `.github/workflows/seed-content.yml` ·
generador: `scripts/build-content-bundle.ts`.

Idioma: español neutral/profesional. Identificadores, claves y código: English.

## 1. Secrets y dónde configurarlos

### 1.1 GitHub (repo Settings → Secrets → Actions → Repository secrets)

| Secreto | Uso en el workflow |
|---|---|
| `CI_SYNC_SECRET` | Encabezado `X-CI-Secret` contra `GET /api/sync/full`. Solo por entorno; nunca en logs ni artefactos. |
| `R2_ACCOUNT_ID` | Construye el endpoint S3 (`https://<id>.r2.cloudflarestorage.com`). |
| `R2_ACCESS_KEY_ID` | Mapeado a `AWS_ACCESS_KEY_ID` para `aws s3api`. |
| `R2_SECRET_ACCESS_KEY` | Mapeado a `AWS_SECRET_ACCESS_KEY` para `aws s3api`. |
| `R2_BUCKET` | Bucket del seed (mismo bucket público). |
| `R2_PUBLIC_BASE_URL` | Base pública para SKIP (`GET seed/latest.json`) y `latest.json` (`manifestUrl`, `zipUrl`). |

Variable opcional (repo Settings → Variables → Actions, **no** es secreto):

| Variable | Default si está vacía |
|---|---|
| `SEED_API_BASE` | `https://diccionario-nasa-liart.vercel.app` |

### 1.2 Servidor (Vercel → proyecto → Settings → Environment Variables, `production`)

| Variable | Notas |
|---|---|
| `CI_SYNC_SECRET` | Mismo valor que el secreto GitHub. Requiere redeploy para tomar efecto (`src/lib/ci-auth.ts` falla cerrado: sin valor, toda validación retorna `false` y la ruta responde 401). |
| `R2_*` | Ya exigidas por el runtime (`src/lib/r2.ts`); el generador las reutiliza sin cambios. |

## 2. Rotación de `CI_SYNC_SECRET` (paso a paso)

Ventana de riesgo: mientras Vercel y GitHub difieran, las corridas fallan
cerrado (401 genérico, sin publish parcial). No hay downtime de lectura: el
seed publicado y `latest.json` siguen servidos. Rotar en horario valle.

1. Generar el nuevo valor (local, nunca en un log ni en un issue):
   `openssl rand -hex 32`.
2. Actualizar `CI_SYNC_SECRET` en Vercel (`production`) y **redeployar**
   (las env vars solo aplican en un deployment nuevo).
3. Actualizar el secreto `CI_SYNC_SECRET` en GitHub (repo Settings →
   Secrets → Actions).
4. Verificar viejo → 401 genérico (mismo cuerpo con y sin encabezado, sin
   oráculo):
   `curl -s -w "\n%{http_code}\n" "$SEED_API_BASE/api/sync/full" -H "X-CI-Secret: <VIEJO>" -o /dev/null`
   esperado: `401` (cuerpo `{"message":"No autorizado"}` si se inspecciona).
5. Verificar nuevo → 200 (solo código, el bundle puede ser pesado):
   `curl -s -o /dev/null -w "%{http_code}\n" "$SEED_API_BASE/api/sync/full" -H "X-CI-Secret: <NUEVO>"`
   esperado: `200`.
6. Correr el workflow con `dry_run: true` (Actions → Seed content →
   Run workflow) y confirmar el summary con las métricas `METRIC`.
7. Borrar el valor viejo de cualquier portapapeles/historial local.

## 3. Verificación manual de una publicación

`<BASE>` = valor de `R2_PUBLIC_BASE_URL` sin barra final.

```bash
# latest.json (único objeto mutable del layout)
curl -fsSL "<BASE>/seed/latest.json" | jq .
# manifiesto de la versión publicada
curl -fsSL "<BASE>/seed/41/manifest.json" | jq '{contentVersion, counts, bytesTotal, dbSha256}'
# la versión del servidor debe coincidir (ambos strings canónicos)
curl -fsSL "$SEED_API_BASE/api/sync/version" | jq -r .contentVersion
# integridad del zip publicado contra el manifiesto
curl -fsSL -o /tmp/seed-check.zip "<BASE>/seed/41/piiyaak-seed.zip"
unzip -p /tmp/seed-check.zip piiyaak.db | sha256sum
# ^ debe ser idéntico a .dbSha256 del manifest.json
```

`GET /api/sync/version` vs `latest.json`: si el servidor avanza y
`latest.json` aún no (el schedule es semanal), es estado normal transitorio;
la app solo hace seed hacia adelante (§4.6 del spec), nunca retrocede.

## 4. Operativa del workflow

- **Manual:** Actions → Seed content → Run workflow. `content_version` vacío
  = versión actual remota; con valor = re-publicación dirigida (pasa
  `--expect-version`, aborta con código 2 si difiere antes de descargar).
  `dry_run: true` genera y verifica en local y omite publicación.
- **Automático:** lunes 03:00 UTC (Fase D podrá cambiar la cadencia).
- **SKIP:** si `latest.json` ya trae la versión generada, el job termina en
  verde sin `putObject`.
- **Inmutabilidad:** `seed/<N>/` nunca se sobrescribe. Si la guarda
  anti-sobrescritura falla, re-publicar exige un `content_version` distinto
  o intervención manual. La corrección de un objeto publicado es una
  versión nueva, nunca una sobrescritura.
- **Primera publicación:** `latest.json` ausente o ilegible → se continúa.
- **Observabilidad:** cada corrida sube `manifest.json` como artifact
  (`seed-manifest`) y publica las líneas `METRIC` en el job summary.

## 5. Gates: duros vs advertencias

Duros (fallan el job): divergencia de versión (código 2 del generador),
`missingMediaKeys` no vacío o hash distinto (código 3), `objectExists`
falso tras subida, verificación post-publicación fallida (bytes o
`dbSha256` distintos).

Advertencias hasta medición real (research P5; convertirlos en gates duros
pertenece a Fase D con números fundados): zip ≤ 100 MB, db ≤ 10 MB,
archivo ≤ 5 MB, cobertura 100 % con hash. La primera corrida publica las
cifras como log + summary.

Códigos del generador (§0 del spec): `0` ok · `2` divergencia de versión
(foto no atómica) · `3` incoherencia de medios · `4` infraestructura/uso.
Todo-o-nada: cualquier fallo deja `<out>` borrado, sin artefacto parcial.

## 6. Runbook R12 — `remote < local` (sin downgrade)

Causa típica: fila `ContentVersion(id=1)` recreada, restore de BD, o semilla
publicada desde una base anterior al bump. La app responde no-op: conserva
el contenido local, registra `console.warn` estructurado y sigue operando
(spec §1.3, §4.6). Nunca hay auto-downgrade.

1. Confirmar: `curl -fsSL "$SEED_API_BASE/api/sync/version"` (remoto) vs
   `curl -fsSL "<BASE>/seed/latest.json"` (último seed) vs versión que
   reporta el dispositivo (`piiyaak:contentVersion` en `kv`).
2. Si el remoto retrocedió por error operativo, la corrección es avanzar:
   bump de `ContentVersion` hacia adelante y (si corresponde) re-publicar
   con `content_version` dirigido. Los dispositivos harán seed hacia la
   versión nueva; los que ya estaban por encima no se tocan.
3. Si el dispositivo quedó por encima del servidor de forma legítima
   (p. ej. staging vs producción), no hacer nada: el sync incremental
   continúa sobre la db adoptada y el próximo seed semanal lo reencuadra.
4. Registrar la causa en el change antes de cerrar el incidente.

## 7. Dry-run (condición operativa)

El dry-run REAL no corre en el entorno de desarrollo de este change (sin
acceso a R2 de producción ni a staging desde aquí); es un paso operativo
previo a la primera publicación real, por cualquiera de estas dos vías:

**A. Staging:** con `SEED_API_BASE` y `CI_SYNC_SECRET` de staging:

```bash
SEED_API_BASE="https://<staging>" CI_SYNC_SECRET="<staging>" \
  bun run scripts/build-content-bundle.ts --out /tmp/seed-dry
# layout esperado: /tmp/seed-dry/{piiyaak.db,media/,manifest.json,piiyaak-seed.zip}
# + líneas METRIC words/courses/modules/lessons/mediaFiles/bytes_total/bytes_audio/bytes_image
```

**B. MinIO local** (vía `R2_ENDPOINT_OVERRIDE`, solo desarrollo):

```bash
R2_ENDPOINT_OVERRIDE="http://localhost:9000" \
  SEED_API_BASE="https://<staging>" CI_SYNC_SECRET="<staging>" \
  bun run scripts/build-content-bundle.ts --out /tmp/seed-dry
```

**C. En CI sin publicar:** Actions → Seed content → Run workflow con
`dry_run: true` (ejecuta generar + verificación local, omite guarda,
publicación y `latest.json`).

En los tres casos el gate es: manifiesto con `format: "piiyaak-seed/1"`,
`dbSha256` coincidente con hash independiente, zip con layout exacto
(`piiyaak.db`, `manifest.json`, `media/<sha256>.<ext>`) y códigos 2/3/4
ante divergencia, medios incoherentes o fallo de infraestructura.

## 8. Qué se loguea y qué NUNCA se loguea (spec §3.4)

Permitido: `contentVersion`, conteos, bytes por clase, `objectKey`s, URLs
públicas, tiempos por paso, códigos de salida, decisión SKIP/publicar.
NUNCA: valor de `CI_SYNC_SECRET`, credenciales R2, cuerpos del bundle,
bytes de medios, encabezados de auth. El generador recibe el secreto solo
por entorno y nunca lo imprime; el workflow no usa `set -x` en pasos con
secretos (los secretos viajan como `env:`, nunca interpolados en `run:`).
