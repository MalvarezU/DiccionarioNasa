# Archive report — apk-offline-fase-b-endpoints (Etapa 2: sync público + endpoint CI)

- **Estado final: CLOSED.** Verificación original PARTIAL → remediación 3/3 cerrada → sin gaps de cobertura conocidos. Solo resta UN WARNING ambiental (BD fase-a no ejecutable aquí).
- **Branch:** `feat/fase-b-endpoints`. **Estrategia de chain:** stacked-to-main. **Siguiente paso:** abrir PR1 y PR2 (los abre el orchestrator o el usuario; sin push ni PRs desde este reporte).
- **Idioma:** neutral/professional Spanish.

## Executive summary (5 líneas)

1. La Etapa 2 expone sync/seed/version como lecturas públicas PUBLISHED-only con `Cache-Control` (F1) y agrega `GET /api/sync/full` con secreto CI para semilla atómica de Fase C (F2, bundle único).
2. Gates finales en verde: **41/41 tests TDD nuevos**, `tsc --noEmit` 0 errores, `eslint` 0 en archivos tocados (verificado 2026-11-08).
3. La remediación cerró los 3 gaps del verify PARTIAL (W-2 fixture a nivel ruta, W-3 `where` fijo del manifiesto, S-1/E1 rotación) en commits `4aee766`, `b4c82be`, `762b991` — solo tests, cero cambios prod.
4. Budgets: PR1 366/400 complete; PR2 805/600 con reset de maintainer registrado; remediación y verify dentro de budget.
5. Riesgo abierto único: regresión de integración `tests/fase-a/` PENDIENTE con BD (sin daemon de contenedores; `Can't reach database server at localhost:3307`, 2 intentos) — re-ejecutar antes del merge a `main`.

## Decisiones cerradas (no reabrir)

| Decisión | Contenido |
|---|---|
| F1 PUBLISHED-only | Sync/seed/full exponen solo PUBLISHED; DRAFT nunca llega a clientes anónimos. Consecuencia: 2 tests fase-a invirtieron expectativa R-ARCHIVED (`toContain` → `notToContain`, comentado). |
| F2 bundle único | `GET /api/sync/full` responde `{ contentVersion, words[], courses[], media[] }` sin paginación; foto atómica para SKIP-BUILD de Fase C. |
| R3(b) sha256 | Filtro `WHERE sha256 IS NOT NULL` + test de coherencia `missingMediaKeys`; migración NOT NULL pospuesta a Fase C con condición (backfill verificado en prod + excluidos en cero). |
| isEditor() | Triplicado en courses queda intacto; centralizar es deuda documentada. |
| Rate-limit en `/full` | Omitido con justificación (consumidor único, IP compartida de runners); registrado en spec §3.1. |

## Forks del plan (ambos cerrados por el usuario)

- Fork 1 → PUBLISHED-only (F1). Fork 2 → bundle único (F2). Sin forks pendientes.

## Remediación 3/3 (post-verify PARTIAL)

| Commit | Gap que cierra | Naturaleza |
|---|---|---|
| `4aee766` | W-2: fixture ARCHIVED/`deletedAt` a nivel ruta con fake que honra `where` | Solo tests |
| `b4c82be` | W-3: fija `where` del manifiesto (`sha256 NOT NULL` + `in: keys`) y guard sin refs | Solo tests |
| `762b991` | S-1/E1: secreto rotado viejo→401 / nuevo→200, misma longitud | Solo tests |

Cero cambios de producción en remediación; el contrato no se movió.

## Evidencia de gates (observada 2026-11-08)

- `npx vitest run` (5 archivos: version, sync, ci-auth, full, full-bundle) → `Test Files 5 passed (5), Tests 41 passed (41)`.
- `npx tsc --noEmit` → salida vacía, exit 0.
- `npx eslint` (6 fuentes + 5 tests) → salida vacía, exit 0.
- `npx vitest run tests/fase-a/` (2 intentos) → `10 failed | 1 passed (11)` por setup: `Can't reach database server at localhost:3307` — WARNING ambiental, no fallo del change.

## Budgets y PRs planificados

| Slice | Contenido | Líneas | Estado |
|---|---|---|---|
| PR1 lecturas públicas | T01 + T02 (version, sync/seed públicos, tests W1/W2) | 366/400 | Complete |
| PR2 semilla CI | T03 + T04 + T05 + T06 (ci-auth, full+tree, manifiesto, docs) | 805/600 | Con reset de maintainer registrado |
| Remediación + verify | 3 commits test-only + reportes | Dentro de budget | Complete |

Chain: stacked-to-main (PR2 sobre rama de PR1). Forks cerrados, sin `size:exception` adicional.

## Archivos del change

- `src/app/api/sync/version/route.ts` (+ test) — W1.
- `src/app/api/sync/route.ts`, `src/app/api/sync/seed/route.ts` (+ tests) — W2.
- `src/lib/ci-auth.ts` (+ test) — W3a.
- `src/app/api/sync/full/route.ts` (+ tests) — W3b.
- `src/lib/sync/full-bundle.ts` (+ tests) — W3c.
- `.env.example` (bloque `CI_SYNC_SECRET`), `openspec/changes/apk-offline-fase-b-endpoints/DEPLOY.md` — W4.
- `openspec/changes/apk-offline-fase-b-endpoints/`: `proposal.md`, `spec.md`, `tasks.md`, `verify-report.md`, `DEPLOY.md`, `archive-report.md` (este archivo).
- Sin diffs en app móvil, workflows ni Admin UI. Ruido `.atl/` es tooling local, fuera del change.

## Checklist de cierre

- [x] T01–T06 verificadas contra spec (T01, T02, T03, T04, T05, T06 en verde).
- [x] F1/F2/R3(b) implementadas y testeadas.
- [x] Casos borde E1–E8 cubiertos (E1 agregado en remediación S-1).
- [x] Remediación W-2/W-3/S-1 cerrada (commits `4aee766`, `b4c82be`, `762b991`).
- [x] `openspec/` del change completo y commiteado.
- [ ] Regresión `tests/fase-a/` con BD — PENDIENTE (WARNING ambiental; re-ejecutar con contenedores antes del merge).
- [ ] Abrir PR1 y PR2 — siguiente recomendado (orchestrator/usuario).

## Deudas conocidas y follow-ups

1. **Regresión fase-a con BD pendiente** (único gate abierto): re-ejecutar `npx vitest run tests/fase-a/` con contenedores; validar explícitamente las 2 expectativas R-ARCHIVED invertidas por F1.
2. **`sha256` NOT NULL pospuesto a Fase C** con condición explícita (DEPLOY.md §5): backfill verificado en producción + excluidos en cero sostenidos.
3. **`isEditor()` triplicado en courses**: centralizar queda como deuda (spec §2.5).
4. **Escala futura**: si el catálogo crece un orden de magnitud, el bundle único (F2) requerirá paginación; el formato ya es extensible (`contentVersion` de foto).
5. **Rotación de `CI_SYNC_SECRET`**: procedimiento en DEPLOY.md §2 (Fase C lo consume como secret de Actions).

## Trazabilidad de skills

- `work-unit-commits`: commits por unidad de trabajo (T01→T02→ci-auth→full→manifiesto→docs→remediación test-only); tests y docs junto a la unidad que verifican; slices PR1/PR2 como chained PRs.
- `cognitive-doc-design`: este reporte — respuesta primero (CLOSED + siguiente paso), progressive disclosure (summary → decisiones → evidencia → checklist → deudas), tablas y checklists para revisión sin reconstruir la historia.
