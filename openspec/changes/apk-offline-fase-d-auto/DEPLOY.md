# DEPLOY — Fase D auto: keystore, versionCode, rotación y primera corrida

Change: `apk-offline-fase-d-auto` · botón admin + dispatch (`POST /api/admin/seed/dispatch`,
`GET /api/admin/seed/runs…`) + workflow `.github/workflows/seed-content.yml`.

Idioma: español neutral/profesional. Identificadores, claves y código: English.

Precedente: `openspec/changes/apk-offline-fase-c-seed/DEPLOY.md` (secrets R2,
rotación `CI_SYNC_SECRET`, verificación de publicaciones). Este archivo no lo
repite: cubre lo nuevo de Fase D (credenciales de firma, `versionCode`,
`SEED_DISPATCH_*` y primera corrida del dispatch).

## 1. Dónde viven `keystore` y `versionCode`

- **Keystore Android / certificado iOS:** gestionados por EAS (`eas credentials`).
  Viven en los servidores de EAS, nunca en el repo: ni `.jks`, ni `.p8`/`.p12`,
  ni contraseñas de keystore, ni `SEED_DISPATCH_TOKEN`, ni secretos R2.
- **`versionCode` (Android) / `buildNumber` (iOS):** gestionados, con incremento
  por release. Fuente: `app.json` de `piiyaak-app` (hoy sin `android.versionCode`
  ni `ios.buildNumber` explícitos → los resuelve EAS al compilar; al fijar un
  release se declaran/incrementan ahí y el cambio es código + deploy, nunca
  input de usuario ni del botón admin).
- **Servidor (Vercel → proyecto → Settings → Environment Variables, `production`):**
  `SEED_DISPATCH_TOKEN` (PAT fino, server-only), `SEED_GITHUB_OWNER`,
  `SEED_GITHUB_REPO`. Ninguno viaja a respuestas, logs ni errores (el dispatch
  responde `502` genérico ante fallo upstream).
- **GitHub (repo Settings → Secrets → Actions):** los de Fase C (`CI_SYNC_SECRET`,
  `R2_*`) sin cambios. El workflow `seed-content.yml` no usa el PAT: lo usa solo
  la route `POST /api/admin/seed/dispatch` server-to-server.

## 2. Rotación

### 2.1 PAT fino (`SEED_DISPATCH_TOKEN`)

1. Regenerar en GitHub (Settings → Tokens) cada ≈90 días.
2. Actualizar `SEED_DISPATCH_TOKEN` en Vercel (`production`) y **redeployar**
   (las env vars solo aplican en un deployment nuevo).
3. Verificar: botón admin → `dry_run=true` → `202` con `correlationId` y run
   visible en el historial (`GET /api/admin/seed/runs?per_page=10`).
4. Recordatorio operativo: agendar la rotación del PAT junto con la cadencia
   semanal del workflow (lunes 03:00 UTC) para no perder la ventana.

### 2.2 Keystore

Rotar **solo ante compromiso** (requiere nueva firma y publicación en stores;
los binarios ya instalados dejan de actualizarse contra la firma anterior).
No hay rotación periódica del keystore.

### 2.3 `CI_SYNC_SECRET` + `SEED_DISPATCH_*`

`CI_SYNC_SECRET` rota según el runbook de Fase C (sección 2 de su `DEPLOY.md`:
ventana de riesgo 401 cerrado, verificación viejo-401/nuevo-200). Los
`SEED_GITHUB_OWNER`/`SEED_GITHUB_REPO` solo cambian si el repo se traslada;
el cambio es código + deploy, nunca input del cliente.

## 3. Primera corrida real (paso a paso)

a) `workflow_dispatch` con `dry_run=true` desde el botón admin
   (`Generar contenido offline` → `Solo verificar, sin publicar` activado →
   `Revisar` → `Generar`); escape manual: GitHub UI (Actions → Seed content →
   Run workflow) con el mismo input.
b) Revisar los logs del run (build, verificación local, SKIP).
c) Repetir con `dry_run=false` (modo `publicación`).
d) `curl -fsSL $R2_PUBLIC_BASE_URL/seed/latest.json | jq '{contentVersion, bytesTotal, files}'`
   esperado: `contentVersion` canónico (`/^\d+$/`), `bytesTotal` y `files`
   enteros no negativos.
e) `curl -I $R2_PUBLIC_BASE_URL/seed/<N>/piiyaak-seed.zip`
   esperado: `accept-ranges: bytes` (el resume real de Fase D W3 lo exige).
f) `GET /api/sync/version` vs `latest.json`: mismo `contentVersion`
   (string canónico en ambos; el gate manda ante divergencia).

## 4. Si la org bloquea PATs finos

Migrar a GitHub App (decisión D1 documentada): crear la App con permiso
Actions Lectura+Escritura, instalarla en el repo y emitir un token de
instalación por llamada en la route. Mismo permiso, cambia solo la emisión
del token; la firma de las tres routes y los textos de la UI no cambian.

## 5. Qué hacer ante `noop` repetidos (`remote < local`)

Intervención manual — verificar `ContentVersion(id=1)` en producción, nunca
auto-downgrade (herencia Fase C F0; runbook R12 en el `DEPLOY.md` de Fase C).
La app conserva el contenido local y sigue operando; la corrección es avanzar
(bump hacia adelante y, si corresponde, re-publicación dirigida con
`content_version`), no retroceder el servidor.
