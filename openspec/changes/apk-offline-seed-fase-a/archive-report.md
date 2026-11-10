# Archive Report: apk-offline-seed-fase-a — cierre de rama

**Estado: ARCHIVADA — lista para PRs stacked-to-main.** Fase A completa en `feat/etapa1-content-version`: 15 commits, gates G1/G2/G3 en verde con resultados observados, W1/W2/W3 cerrados, `git status` limpio, sin push ni PRs abiertos.

## Quick path

1. Abrir PR1 → PR2 → PR3 stacked-to-main (plan abajo; PR0 ya está en `main`).
2. Antes del merge de PR1: dry-run de `DEPLOY.md` en staging (`migrate deploy` ×2 + smoke + backfill) — pendiente operativo, no bloquea archivo.
3. Verificación de archivo: `git log --oneline main..HEAD` (15 commits), `git status --porcelain` (limpio), `ls tests/fase-a/*.test.ts` (11 archivos).

## Estado al cierre

| Tema | Estado observado |
|---|---|
| Rama | `feat/etapa1-content-version`, 15 commits sobre `main`, `git status --porcelain` limpio |
| Re-verify final | `npx vitest run tests/fase-a/` → **11 archivos, 100/100 PASS**; `npx tsc --noEmit` → **exit 0, 0 errores**; `npx eslint` en rutas tocadas → **exit 0** |
| Tests vecinos | Slice 3: 99/99; lesson-editor (C0): 99/99 |
| Flakes UI | 4 suites con flakes solo en corrida completa (deuda, fuera del gate — ver § Deudas) |
| Openspec commiteado | `proposal.md`, `spec.md`, `tasks.md`, `verify-report.md` (+§6 gate), `DEPLOY.md`, este archivo |
| Push / PRs | Sin push, sin PRs abiertos al archivar |

### Commits en la rama (observado `git log --oneline main..HEAD`)

| # | Commit | Unidad |
|---|---|---|
| T01 | `6ff485c` | Migración ContentVersion + columnas aditivas y semilla |
| T02 | `1dc9360` | Helper `bumpContentVersion`/`getContentVersion` atómico |
| T03 | `5311f3f` | Bumps words CRUD + bulk-status |
| T04 | `8000aff` | Bumps import-confirm y revert (regla dos pasos) |
| T05 | `2479319` | Bumps cursos/módulos/lecciones/reorder + borrado lógico |
| T06 | `12a3120` | Bumps medios + delete-audio resuelve fila + legacy con bump |
| T07 | `8255798` | Borrado lógico + normalización case + revert module/lesson + R-ARCHIVED |
| fix | `b420c89` | Revert module/lesson sin unión de delegates (TS2349) |
| T08 | `5ba4c7f` | `sha256` en uploads audio/imagen + legacy update-audio (HASH-01) |
| T09 | `f2eb05a` | Backfill idempotente `sha256` + reporte de huérfanos (HASH-02) |
| T10 | `4b2f65f` | `contentVersion` aditivo en sync y seed (SYNC-01/BUMP-04) |
| T11 | `7662726` | Anti-olvido de bumps en rutas mutantes publicables |
| C1 | `175d92a` | Legacy import bumps +1 por request aplicada, allowlist vaciada |
| C2 | `4f9132b` | Tombstones paginados por keyset + test de volumen 5001 |
| docs | `27bfd2f` | Registro SDD + gate + runbook deploy |

C0 vive en `main` como `63297b0` (no en esta rama). Nota: los hashes históricos intermedios del diario de apply-progress difieren por el rebase final; los de esta tabla son los observados al cierre.

## Decisiones

| Decisión | Resolución |
|---|---|
| D2 — versión global atómica | `UPDATE ... SET version = version + 1` sobre el mismo `tx` (nunca read-modify-write en JS); `INSERT IGNORE (1,1)` asegura la fila; `getContentVersion` lee fresco por request con fallback `1`. Concurrencia `+2` exacto en verde |
| D3 — borrado por entidad | `DictionaryWord`/`Course` → `ARCHIVED`; `Module`/`Lesson` → `deletedAt`; `MediaAsset` → eliminación de fila + diff de manifiesto `(objectKey, sha256)`. Sin doble semántica |
| `sinceVersion` | Recortado (spec §5.2): ninguna ruta lo acepta ni devuelve `pendingChanges`; solo versión actual. Sin colisión con el `since` ISO existente |
| Fork A — PR0 aparte | `fix/tiptap-align` (commit `63297b0` en `main`): alinea `@tiptap/*` a 3.33.0; resolvió W1. Rama rebaseada 12/12 sobre `main` con PR0 |
| Fork B — bump por request | C1 (`175d92a`): legacy import hace bump +1 por request aplicada; allowlist del anti-olvido queda vacía |
| Budgets | Slice 2 (3217/900) y C1 (681/600) excedidos con reset de maintainer registrado; resto complete |

## Gates (resultados observados)

| Gate | Comando | Resultado |
|---|---|---|
| G1 | `npx vitest run tests/fase-a/` | 11 archivos, **100/100 PASS** |
| G2 | `npx tsc --noEmit` | **exit 0, 0 errores** (W1 resuelto vía PR0 + rebase) |
| G3 | `npx eslint` en rutas tocadas | **exit 0** |

### W1/W2/W3 del verify-report original

| Hallazgo | Resolución al cierre |
|---|---|
| W1 — `tsc` TS2769 tiptap | **Resuelto**: PR0 `fix/tiptap-align` mergeado a `main` + rebase; G2 en verde |
| W2 — migración sin dry-run formal en staging | **Resuelto en docs**: `DEPLOY.md` con `migrate deploy` ×2 + diff vacío + smoke de bumps + backfill. Ejecución en staging **pendiente** como paso operativo previo a producción; no bloquea archivo |
| W3 — volumen 5k+ sin evidenciar (E4) | **Resuelto**: C2 tombstones por keyset `(createdAt, id)` + test de 5001 filas en `fase-a.tombstones.test.ts` PASS; E4 cerrado en spec §7 |

## Deudas conocidas (fuera del gate)

- [ ] **Staging dry-run pendiente**: ejecutar `DEPLOY.md` en staging (migrate ×2, smoke, backfill `--json`) antes del merge a producción. No bloquea archivo ni PRs.
- [ ] **Flakes UI en corrida completa** (85/85 en aislamiento; fuera del gate): `course-manager.test.tsx`, `explore-section.test.tsx`, `juegos/escucha-game.test.tsx`, player (`player-shell`, `player-motion`, `curso.test.tsx`).
- [ ] **Paginación de respuesta Fase B**: C2 pagina tombstones por keyset; la paginación general de `sync` queda para Fase B.
- [ ] **Engram pendiente**: `artifact_store.mode: hybrid` — este reporte es file-based; falta anotar el cierre en engram (memoria de la sesión padre).

## Plan de PRs stacked-to-main

Estrategia: `stacked-to-main`, `delivery_strategy: ask-on-risk (split)`.

| PR | Contenido | Base → Head |
|---|---|---|
| PR0 | `fix/tiptap-align` — alinear `@tiptap/*` | **Ya en `main`** (`63297b0`) |
| PR1 | T01 + T02 (migración + helper atómico) | `main` → `feat/etapa1-pr1-mig-helper` |
| PR2 | T03–T07 + C1 (bumps words/import/courses/media, borrado lógico, legacy por request) | PR1 → `feat/etapa1-pr2-bumps` |
| PR3 | T08–T11 + C2 + docs (sha256, backfill, sync aditivo, anti-olvido, tombstones keyset, openspec) | PR2 → `feat/etapa1-pr3-sync-docs` |

Cada PR lleva sus tests con el código (work-unit) y pega G1/G2/G3 observados. `bun.lock` con una sola versión de `@tiptap/core` se verifica en PR1.

## Checklist de archivo

- [x] G1 + G2 + G3 en verde con resultados observados
- [x] `git status --porcelain` limpio
- [x] `openspec/` commiteado (proposal, spec, tasks, verify-report+§6, DEPLOY.md, este reporte)
- [x] 11 archivos de test en `tests/fase-a/`
- [ ] Push / PRs (siguiente recomendado — fuera de este reporte)
- [ ] Staging dry-run (operativo pre-producción)
- [ ] Anotación en engram (pendiente, modo hybrid)
