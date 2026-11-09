# Archive Report: apk-offline-fase-c-seed — cierre de rama

**Estado: ARCHIVADA — verify final PASS, lista para PRs stacked-to-main.** Seed offline completo en web `feat/fase-c-seed` (F0 + W1 + W2) y app `feat/mobile-fase-c` (F0 + W3, solo referenciada aquí): gates en verde con resultados observados, warnings no bloqueantes declarados como deuda, `openspec/` commiteado en un commit docs, sin push.

## Quick path

1. Mergear F1-a a `main` primero (base de todo: `d0136ad` + Fase A PRs #1–3 como pre-requisito de integración).
2. Abrir PRs stacked-to-main de Fase C (plan abajo).
3. Antes de cualquier prueba EAS: dry-run de staging según `DEPLOY.md` + publicar R2 y setear `EXPO_PUBLIC_SEED_BASE_URL` real (hoy `""` → seed deshabilitado).
4. Fase D (fuera de este change): botón admin + auto-chain.

## Estado al cierre

| Tema | Estado observado |
|---|---|
| Rama web | `feat/fase-c-seed` en `/home/mario/Escritorio/Proyectos/Diccionario-endpoints`, 6 commits sobre base `d0136ad`, `git status` solo con `.atl/*` modificado (fuera de este commit) + `openspec/` staged |
| Rama app (referencia, no modificada) | `feat/mobile-fase-c` en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app`, 9 commits, `git status` limpio |
| Re-verify final | Web: sync+seed **59/59**, fase-a **100/100**, `tsc` 0 errores, `eslint` limpio · App: 26 files / **188 tests PASS**, `tsc` 0 |
| Openspec commiteado | `research.md`, `proposal.md`, `spec.md`, `tasks.md`, `verify-report.md`, `DEPLOY.md` (ya en `f1b9694`), este archivo |
| Push / PRs | Sin push, sin PRs abiertos al archivar |

### Commits web en la rama (observado `git log --oneline`)

| # | Commit | Unidad |
|---|---|---|
| base | `d0136ad` | Merge F1-a (sha256 en sync/seed) como base de fase-c-seed |
| F0 | `0e20f46` | Serializar `contentVersion` como string en 4 rutas |
| W1 | `ac19335` | W1-01 RED: fixture + mapeo/naming/manifiesto/paridad/CLI |
| W1 | `f6c6445` | W1-02/W1-03 generador bundle seed + zip determinista + códigos |
| W1 | `5c917b4` | W1-04 CLI `build-content-bundle` + script `seed:build` |
| W2 | `6f4a139` | W2-01 workflow `seed-content` con 11 pasos del spec |
| W2 | `f1b9694` | W2-02/W2-03 DEPLOY con secrets, rotación, verificación y runbook R12 |

### Commits app en `feat/mobile-fase-c` (referencia, rama no tocada por este reporte)

| # | Commit | Unidad |
|---|---|---|
| F0 | `8849760` | Aceptar `contentVersion` string-or-number + comparar solo-adelante |
| W3 | `a99ce83` … `43190a7` | 8 commits W3-01…W3-06c (unzip v9 + manifest + pantalla + descarga + swap + gate + cableado expo) |

## Decisiones

| Decisión | Resolución |
|---|---|
| F0 — string canónico con coerción | 4 rutas web emiten `String(version)`; app parsea string+number (Zod tolerante) y escribe canónico; `export-db.py` sin cambios produce gate |
| D1 — zip | Bundle seed como zip determinista (writer propio `stored`, CRC32, timestamps fijos, entradas ordenadas) |
| D2 — descarga R2 | Publicación en `seed/<N>/` (zip + manifest + `latest.json` por PUT único) con guarda anti-sobrescritura y verificación post-publicación |
| D3 — sin downgrade | Versionado solo-adelante: `remote < local` → `noop` con `reason`; runbook R12 ordena bump hacia adelante, nunca auto-downgrade |
| P1 — unzip nativo | `react-native-zip-archive` v9 + config plugin; `seed-unzip.ts` con resolución perezosa y `subscribe` con `remove()` en `finally` |
| Formato | Zip con db extendida + `media/<sha256>.<ext>` + `manifest.json` (`format: "piiyaak-seed/1"`, `dbSha256`/`sha256` hex64, conteos, `bytesTotal`) |
| Transporte | `createDownloadResumable`: primero `manifest.json` liviano (SKIP tardío), luego zip en `.part` + registro kv solo-metadatos; URLs well-known desde `EXPO_PUBLIC_SEED_BASE_URL` |
| Presupuestos | Excedidos con resets de maintainer registrados |

## Gates (resultados observados)

| Gate | Comando | Resultado |
|---|---|---|
| Web sync+seed | `npx vitest run src/app/api/sync/ src/lib/seed scripts/build-content-bundle.test.ts` | 7 archivos, **59/59 PASS** |
| Web fase-a (regresión) | `npx vitest run tests/fase-a/` (MariaDB local) | 11 archivos, **100/100 PASS** |
| Web tipos | `npx tsc --noEmit` | **exit 0, 0 errores** |
| Web lint | `npx eslint` en seed + rutas tocadas | **exit 0, limpio** |
| App suite | `npx vitest run` | 26 archivos, **188/188 PASS** |
| App tipos | `npx tsc --noEmit` | **exit 0, 0 errores** |
| Delivery Gate antislop (W3-03) | Revisión manual copy/roles/táctiles | **PASS** — copy neutral, sin eyebrow ALL-CAPS, sin middle-dots, sin `→`; `progressbar` con valores; botones ≥ 44pt |

Veredicto del verify-report: **PASS**. Todo lo verificable sin dispositivo, CI real ni R2 real está implementado conforme al spec.

## Deuda declarada (warnings no bloqueantes, NO corregidos)

- [ ] **(a) `resumed` informativo** — `src/db/seed-download.ts:133-155` (app): el flag puede reportar `resumed: true` cuando hubo reinicio limpio. `downloadFile` real (`seed-expo.ts:124-139`) ignora el offset y re-descarga completo; retries = 100 % de bytes. Solo lo leen tests, ninguna UI. Fix real (`Range`/`resumeAsync`) requiere dispositivo → Fase D.
- [ ] **(b) Erratas menores spec §2.4/§3** — ya documentadas en W1: `image/* → kind "illustration"` (no `"image"`), porque el `CHECK (kind IN ('audio','illustration'))` del schema real rechazaría `"image"`. La implementación es la correcta; el spec hereda texto contradictorio a corregir en Fase D.
- [ ] **W-3 operativo**: `eas.json` (`preview`, `production`) trae `"EXPO_PUBLIC_SEED_BASE_URL": ""` → seed deshabilitado en runtime. Validación en dispositivo exige publicar R2 + valor real + rebuild.
- [ ] **W-4 cosmético**: `seed-expo.ts:148` descarta `updatedAt` del registro (`""` fijo). Sin impacto funcional.
- [ ] **S-1/S-2/S-3** (sugerencias verify-report §7): orden del `INSTALL "copiando datos"`; `eslint` mínimo en app para `seed-*`; anotar erratas en `spec.md` antes de Fase D.

## NO ejecutable en este entorno (motivo por ítem, ver verify-report §9)

1. Disparo real del workflow + publicación en `seed/<N>/`: requiere Actions con 6 secretos y R2 real.
2. Dry-run real contra staging/MinIO: requiere `SEED_API_BASE`/`CI_SYNC_SECRET` de staging o MinIO local.
3. Primera corrida COUNT/SUM (research P5): requiere BD real con medios; umbrales siguen como advertencias.
4. Build EAS con `react-native-zip-archive` v9: requiere EAS cloud (agravado por W-3).
5. Unzip de tamaño real en gama media/baja (ANR/OOM): requiere hardware físico.
6. Interrupción real con reanudación: requiere radio real (más W-2: alcance = reinicio limpio).
7. Instalación nueva 100 % offline post-seed: requiere dispositivo + CDN publicado (bloqueado por 1 y 4).
8. Rotación real de `CI_SYNC_SECRET`: requiere valores reales; `DEPLOY.md` documenta el procedimiento sin ejecutarlo.

Además, fuera de código: `EXPO_PUBLIC_SEED_BASE_URL` vacío hasta publicar R2; backfill `sha256` incompleto degrada a on-demand.

## Pendientes fuera del change (no bloquean archivo)

- [ ] Merge de F1-a a `main` (base de todo).
- [ ] Dry-run staging según `DEPLOY.md`.
- [ ] Merges Fase A PRs #1–3 (pre-requisito de integración).
- [ ] Fase D: botón admin + auto-chain (+ fix `Range`/`resumeAsync`, erratas spec, `eslint` app).

## Plan de PRs stacked-to-main

Estrategia: `stacked-to-main`, `delivery_strategy: auto-chain`, `chain_strategy: stacked-to-main`.

| PR | Contenido | Base → Head |
|---|---|---|
| PR-F1a | Base `d0136ad` (sha256 en sync/seed) + Fase A PRs #1–3 | `main` → merge F1-a |
| PR-C1 | F0 (`0e20f46`) + W1 (`ac19335`, `f6c6445`, `5c917b4`) | F1-a → `feat/fase-c-seed-w1` |
| PR-C2 | W2 (`6f4a139`, `f1b9694`) + openspec (este archive) | PR-C1 → `feat/fase-c-seed` |
| PR-C3 (app) | F0 (`8849760`) + W3 (`a99ce83`…`43190a7`) | `main` app → `feat/mobile-fase-c` |

Cada PR lleva sus tests con el código (work-unit) y pega los gates observados. Sin push desde este reporte: los PRs los abre el orquestador.

## Checklist de archivo

- [x] Gates web + app en verde con resultados observados
- [x] `git status` app limpio; web solo con `.atl/*` fuera de este commit
- [x] `openspec/changes/apk-offline-fase-c-seed/` commiteado (research, proposal, spec, tasks, verify-report, DEPLOY.md, este reporte)
- [x] Deuda declarada (a)(b) + W-3/W-4 + sugerencias, sin corregir
- [x] Sin push (los PRs los abre el orquestador)
- [ ] Merge F1-a a `main` (siguiente recomendado — fuera de este reporte)
- [ ] Dry-run staging (operativo pre-producción)
- [ ] Fase D (botón admin + auto-chain)
