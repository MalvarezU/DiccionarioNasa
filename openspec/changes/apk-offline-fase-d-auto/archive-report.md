# Archive Report: apk-offline-fase-d-auto — cierre de rama

**Estado: ARCHIVADA — verify final PASS, lista para PRs stacked-to-main.** Automatización Fase D completa: botón admin + dispatch con audit (web `feat/fase-d-auto`), notice de contenido nuevo + resume real con guarda 206 (app `feat/mobile-fase-d`, solo referenciada aquí), erratas E1/E2/E3 cerradas y runbook operativo. Gates en verde con resultados observados, warnings no bloqueantes declarados como deuda, `openspec/` commiteado en un commit docs, sin push.

## Quick path

1. Abrir los 5 PRs stacked-to-main contra `main` (plan abajo: PR-1 W0, PR-2 W1, PR-3 W2 app, PR-4 W3 app, PR-5 W4).
2. Antes del primer dispatch real: setear `SEED_DISPATCH_TOKEN` / `SEED_GITHUB_OWNER` / `SEED_GITHUB_REPO` en Vercel (`production`) + redeploy (verify §5 S-1).
3. Primera corrida según `DEPLOY.md` §3 (`dry_run=true` → logs → `dry_run=false`), verificando `accept-ranges: bytes` en el CDN (W3 lo exige).
4. Fase E (fuera de este change): build EAS, `EXPO_PUBLIC_SEED_BASE_URL` real, aviso en red real, rotación PAT ≈90 días.

## Estado al cierre

| Tema | Estado observado |
|---|---|
| Rama web | `feat/fase-d-auto` en `/home/mario/Escritorio/Proyectos/Diccionario-endpoints`, 8 commits sobre Fase C, `git status` solo con `.atl/*` modificado (fuera de este commit, no se commitea) + `openspec/changes/apk-offline-fase-d-auto/` staged |
| Rama app (referencia, no modificada) | `feat/mobile-fase-d` en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app`, 7 commits Fase D, `git status` limpio |
| Re-verify final | **PASS** — web W0 + W1 (15/15 spot + 35/35 en su momento, `tsc` 0, `eslint` 0) + W4 (runbook + E2 + E3 + zod + eslint); app W2 + W3 (suite **235/235**, `tsc` 0); regresión fase-a **100/100** con BD local en 127.0.0.1:3307 (levantada para la ocasión) |
| Openspec commiteado | `proposal.md`, `research.md`, `spec.md`, `tasks.md`, `verify-report.md`, `DEPLOY.md` (ya en rama), este archivo |
| Push / PRs | Sin push, sin PRs abiertos al archivar |

### Commits web en la rama (observado `git log --oneline`)

| # | Commit | Unidad |
|---|---|---|
| W0 | `e3a8fa7` | `serverTime` en `GET /api/sync/version` + test de contrato (E1) |
| W1 | `2bf5a07` | Dispatch seed con validación, audit y mapeo 502 |
| W1 | `e69c3f6` | Historial y detalle de runs |
| W1 | `f5a4530` | Modal admin con polling |
| W4 | `d4cae72` | Runbook keystore/versionCode/rotación y primera corrida (W4.1) |
| W4 | `482331f` | E2 definición canónica única de `bytesTotal` (W4.2) |
| W4 | `bbe6b2e` | E3 deduplicación de pasos sin cambio semántico (W4.3) |
| W4 | `f476a82` | Fija zod en devDependencies (W4.4) |

### Commits app en `feat/mobile-fase-d` (referencia, rama no tocada por este reporte)

| # | Commit | Unidad |
|---|---|---|
| W2 | `4f3731c` | Máquina pura del aviso con 5 estados (W2.1) |
| W2 | `2299da8` | Enganche del aviso en `db-context` con `latest.json` y descarte kv (W2.2) |
| W2 | `1f2d14d` | Componente `UpdateNotice` no bloqueante (W2.3) |
| W3 | `8560056` | Decisión pura resume-vs-fresco, matriz de 6 filas (W3.1) |
| W3 | `4b2d9bf` | Registro kv con `resumeData` opaco + sweep de `.part` (W3.2) |
| W3 | `9949216` | Resume `savable` con guarda 206 + prohibición `Range` (W3.3) |
| W4 | `52f3421` | eslint mínimo acotado a archivos Fase D (W4.4) |

## Decisiones

| Decisión | Resolución |
|---|---|
| D1 — PAT fino | Token de grano fino solo en env server-only (`SEED_DISPATCH_TOKEN`), expiración corta, `ref: "main"` constante del lado servidor, `inputs` en allowlist (`content_version`, `dry_run`), audit `SEED_DISPATCH` solo en éxito, `502` genérico sin filtrar upstream |
| D2 — formato `latest.json` | Forma mínima con `contentVersion` canónico + `bytesTotal` + `files`; `bytesTotal` = `dbBytes + Σ files.size` (definición canónica E2, test de contrato en `bundle-builder.test.ts`) |
| Transporte descarga R2 | `seed/<N>/` (zip + manifest + `latest.json`); app descarga manifest liviano primero, luego zip en `.part` + registro kv solo-metadatos |
| Solo-adelante + string canónico | `contentVersion` string `/^\d+$/`; `remote < local` → `noop` manual, nunca auto-downgrade (herencia Fase C F0/R12) |
| D3 — resume real | Solo vía `pauseAsync() → savable() → resumeAsync()` con guarda `status === 206`; `resumeData` opaco nunca interpretado; `MAX_ATTEMPTS = 3`, delays `[2000, 8000]`; **NUNCA `Range` manual** en `downloadAsync` (corrompe: sobrescribe en lugar de continuar; prohibición fijada por test) |
| `serverTime` aditivo (E1) | `GET /api/sync/version` emite `{ contentVersion, serverTime }` desde `updatedAt` sin migraciones; fila ausente → `{ "1", <ahora> }` sin crear fila |
| Sin downgrade operativo | `noop` repetidos → intervención manual contra `ContentVersion(id=1)`, documentado en `DEPLOY.md` §5 |
| Presupuestos | Excedidos con resets de maintainer registrados: W1 1384, W2 app 671, W3 801, W4 6233 (lockfiles), verify incluido |

## Gates (resultados observados, del `verify-report.md` §2–§3)

| Gate | Comando | Resultado |
|---|---|---|
| Web W0 + seed spot | `npx vitest run src/app/api/sync/version src/app/api/admin/seed` | 3 archivos, **15/15 PASS** (W1 llegó a 35/35 en su momento con modal + runs) |
| Web modal | `npx vitest run src/components/admin/SeedDispatchModal.test.tsx` | 1 archivo, **7/7 PASS** |
| Web seed lib | `npx vitest run src/lib/seed/` | 2 archivos, **24/24 PASS** |
| Web fase-a (regresión) | `npx vitest run tests/fase-a/` (MariaDB local 127.0.0.1:3307) | 11 archivos, **100/100 PASS** |
| Web tipos / estilo | `npx tsc --noEmit` / `npx eslint` en archivos tocados | **exit 0 / exit 0** |
| Workflow YAML | `yaml.safe_load` | **YAML_OK**, 14 steps, guardas deduplicadas |
| App suite completa | `npx vitest run` | 31 archivos, **235/235 PASS** |
| App tipos / estilo | `npx tsc --noEmit` / `npm run lint` (6 archivos Fase D) | **exit 0 / 0 errores**, 7 warnings preexistentes (W-2) |

## Deuda no bloqueante (warnings del verify §4, van a follow-up)

- **W-1. `zod` en `devDependencies` usado en runtime** (web). Funciona en Vercel (sin prune de devDeps en build Next.js), pero una dependencia de route handlers pertenece a `dependencies`. Follow-up: mover `zod` a `dependencies`.
- **W-2. 7 warnings `eslint` en app.** Imports sin uso preexistentes (`OutboxRow`, `AuthError`), directiva `eslint-disable` sin efecto (línea 340, introducida por W2) y 3 avisos `exhaustive-deps`. Gate (0 errores) cumplido. Follow-up: limpiar directiva e imports.
- **W-4. Sync manual bypasa el aviso** (app, conforme al spec §W2.1 pero inconsistente en UX). `syncNow` descarga de inmediato sin pasar por `Descargar ahora / Más tarde`. Follow-up: enrutar esa vía por el mismo `notice` o documentar la diferencia.
- **W-5. Tests de enganche `db-context` estáticos** (app). Afirman con `toContain` sobre el fuente (imposible importar `expo-sqlite` en Node); eslabón más débil de la red TDD. Follow-up: extraer el cableado a función pura testeable.

## NO ejecutable aquí — pendientes operativos (verify §5, requieren credenciales/dispositivo)

| Ítem | Motivo |
|---|---|
| Dispatch real contra GitHub (`workflow_dispatch` con PAT fino → 204 + run visible) | Sin `SEED_DISPATCH_TOKEN`/`OWNER`/`REPO` en este entorno; red real prohibida por contrato de validación |
| `206` real del CDN (`Accept-Ranges: bytes` en `R2_PUBLIC_BASE_URL/seed/<N>/piiyaak-seed.zip`) | Sin URL pública publicada; el HEAD de `supportsResume` solo se resuelve en runtime |
| Interrupción física (modo avión a mitad) y reanudación por bytes | Requiere dispositivo con `expo-file-system` nativo (`pauseAsync`/`savable`/`resumeAsync` no existen en Node) |
| Comportamiento iOS cuando el servidor ignora el `Range` en un resume | Requiere iPhone/simulador con `NSURLSession`; la guarda 206 existe por paridad |
| Aviso de contenido nuevo en red real | Requiere build en dispositivo contra backend + CDN reales |
| Primera corrida y publicación de `seed/<N>/` + `latest.json` | Requiere secretos R2/GitHub y decisión `dry_run=false`; pasos en `DEPLOY.md` §3, no ejecutados |
| Build EAS / publicación en stores | Requiere credenciales EAS y `versionCode`/`buildNumber` (`DEPLOY.md` §1–§2) |
| Rotación de secretos + `EXPO_PUBLIC_SEED_BASE_URL` real | Operativo post-deploy: PAT ≈90 días con redeploy; setear base URL real en la app |

## Checklist de archivo

- [x] Verify final **PASS** sin CRITICAL, sin tocar código (validador fresco)
- [x] `DEPLOY.md` con las 5 secciones (keystore/versionCode, rotación, primera corrida, escape GitHub App, `noop` manual)
- [x] Este `archive-report.md` creado junto a `proposal.md`, `research.md`, `spec.md`, `tasks.md`, `verify-report.md`
- [x] Commit docs único solo con `openspec/changes/apk-offline-fase-d-auto/` — `.atl/*` excluido, nada fuera de `openspec/`, sin push
- [ ] PRs stacked-to-main abiertos (siguiente paso, no parte de este commit)

## Next step

Abrir PRs stacked-to-main (auto-chain, 5 PRs según forecast en `tasks.md`): **PR-1** W0 (`e3a8fa7`), **PR-2** W1 dispatch+runs+modal (`2bf5a07`/`e69c3f6`/`f5a4530`; si supera 400 líneas tras un pase honesto de slicing, dividir en PR-2a rutas / PR-2b modal), **PR-3** W2 app (`4f3731c`/`2299da8`/`1f2d14d`), **PR-4** W3 app (`8560056`/`4b2d9bf`/`9949216`), **PR-5** W4 (`d4cae72`/`482331f`/`bbe6b2e`/`f476a82` + `52f3421` app). En el PR de W1, registrar la tabla `dry_run × skip` con los `if` efectivos antes/después (verify S-3). Fase E arranca tras el merge con la primera corrida real del runbook.
