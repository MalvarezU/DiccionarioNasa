# Tasks: apk-offline-fase-c-seed — Robot de semilla + APK auto-actualizable

- **Change ID:** `apk-offline-fase-c-seed`
- **Spec base:** `openspec/changes/apk-offline-fase-c-seed/spec.md` (§1 F0, §2 W1, §3 W2, §4 W3, §5 aceptación TDD)
- **Proposal base:** `openspec/changes/apk-offline-fase-c-seed/proposal.md` (F0, W1–W3, plan §8)
- **Research vinculante:** `openspec/changes/apk-offline-fase-c-seed/research.md` (P1–P5, R1–R7; decisiones D1–D3 no se reabren)
- **Ramas:**
  - Web: `/home/mario/Escritorio/Proyectos/Diccionario-endpoints` — rama `feat/fase-c-seed`
  - App: `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app` — rama `feat/mobile-fase-c`
- **Idioma:** español neutral/profesional. Identificadores, claves y código: English.
- **Estrategia de entrega:** `auto-chain` (F0 → W1 → W2 → W3). Cada unidad avanza únicamente con su gate TDD en verde.
- **Regla TDD global:** sin test en rojo previo no existe código de producción. Cada tarea indica su paso RED y su paso GREEN de forma explícita.

## Orden de dependencias

```
F0-01 ─▶ F0-02 ─▶ F0-03 ─▶ F0-04 ─┐
                                   ├▶ W1-01 ─▶ W1-02 ─▶ W1-03 ─▶ W1-04 ─▶ W1-05
                                   │                                              ─▶ W2-01 ─▶ W2-02 ─▶ W2-03 ─┐
                                   │                                                                          ├▶ W3-01 ─▶ W3-02 ─▶ W3-03 ─▶ W3-04 ─▶ W3-05 ─▶ W3-06 ─▶ CLOSE-01
F0 comparador (§1.3) ─────────────┘ (W3 consume compareVersions de F0)         (W2 consume generador de W1)
```

F0 desbloquea el contrato. W1 produce el artefacto. W2 lo publica. W3 lo consume. W3 no inicia su implementación hasta que F0 se encuentra en verde en ambos repositorios.

---

## F0 — Tipo canónico de `contentVersion` (spec §1)

### F0-01 — Tests RED web: las 4 rutas emiten string

- **Repo + rama:** web — `Diccionario-endpoints`, rama `feat/fase-c-seed`
- **Criterios que cierra:** spec §1.1, §5 (F0 web).
- **Archivos exactos (editar):**
  - `src/app/api/sync/version/route.test.ts`
  - `src/app/api/sync/full/route.test.ts`
  - `src/app/api/sync/sync.test.ts` (extender con aserción de `contentVersion` si aún no la contiene)
  - Crear si no existe: `src/app/api/sync/seed/route.test.ts` (cobertura de la cuarta ruta)
- **Test RED → GREEN:**
  - RED: actualizar las expectativas a `expect(body.contentVersion).toBe("41")` (valor de ejemplo según fixture) y `expect(typeof body.contentVersion).toBe("string")` en las 4 rutas. Ejecutar `bun run test:run src/app/api/sync/version/route.test.ts src/app/api/sync/full/route.test.ts` y confirmar fallo (el código aún emite número).
  - GREEN: se implementa en F0-02. Esta tarea termina con los tests en rojo por la razón esperada (emisión numérica, no error tipográfico).
- **Dependencia:** ninguna (inicio de cadena).
- **Gate:** los 4 tests fallan con mensaje de tipo (`expected string, received number` o equivalente). No se escribe código de producción en esta tarea.

### F0-02 — Implementación GREEN web: serializar `String(version)`

- **Repo + rama:** web — `Diccionario-endpoints`, rama `feat/fase-c-seed`
- **Criterios que cierra:** spec §1.1, §5 (F0 web).
- **Archivos exactos (editar):**
  - `src/app/api/sync/version/route.ts` (responder `"contentVersion": String(version)`)
  - `src/app/api/sync/seed/route.ts` (misma serialización)
  - `src/app/api/sync/route.ts` (misma serialización)
  - `src/app/api/sync/full/route.ts` (misma serialización)
  - `src/lib/content-version.ts` (sin cambio funcional; únicamente comentario de contrato si resulta necesario)
- **Test RED → GREEN:**
  - RED: reutiliza los tests de F0-01 (ya en rojo).
  - GREEN: aplicar `String(await getContentVersion())` en el borde de cada ruta. Ejecutar `bun run test:run src/app/api/sync/version/route.test.ts src/app/api/sync/full/route.test.ts src/app/api/sync/sync.test.ts` y, si se creó, `src/app/api/sync/seed/route.test.ts`. Confirmar verde total.
- **Dependencia:** F0-01.
- **Gate:** `bun run typecheck` → 0 errores; `bun run test:run` del área sync en verde; `export-db.py:110` (`isinstance(..., str)`) opera sin modificación contra el backend actualizado.

### F0-03 — Tests RED app: coerción tolerante + comparador solo-adelante

- **Repo + rama:** app — `piiyaak-app`, rama `feat/mobile-fase-c`
- **Criterios que cierra:** spec §1.2, §1.3, §5 (F0 app + `compareVersions`).
- **Archivos exactos (editar/crear):**
  - `src/db/version-gate.test.ts` (extender: parseo de `{ contentVersion: 41 }` → `"41"`; canónico `"41"` idéntico; rechazo de `""` y `-1`)
  - Crear: `src/db/__tests__/seed-compare.test.ts` (casos `compareVersions`: `("41","41")` → `skip`; `("40","41")` y `(null,"41")` → `seed`; `("42","41")` → `noop`; remoto `"x"` → `throw`)
- **Test RED → GREEN:**
  - RED: escribir los casos descritos y ejecutar `npx vitest run src/db/version-gate.test.ts src/db/__tests__/seed-compare.test.ts`. Confirmar fallo (el schema actual rechaza número con `ZodError`; `compareVersions` no existe).
  - GREEN: se implementa en F0-04.
- **Dependencia:** ninguna en app (puede redactarse en paralelo a F0-01, pero su GREEN exige F0-04). Para el orden de la cadena, se considera desbloqueada desde el inicio.
- **Gate:** tests en rojo por la razón esperada (rechazo de número + símbolo ausente). Sin código de producción en esta tarea.

### F0-04 — Implementación GREEN app: schema tolerante + `compareVersions`

- **Repo + rama:** app — `piiyaak-app`, rama `feat/mobile-fase-c`
- **Criterios que cierra:** spec §1.2, §1.3, §5 (F0 app).
- **Archivos exactos (editar):**
  - `src/db/version-gate.ts` (reemplazar `z.string().min(1)` por `z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform((v) => String(v))`; agregar tipo `VersionMove` y función `compareVersions(local, remote)` según spec §1.3; `getRemoteVersion` conserva firma; `sync.ts:165` no se modifica en esta tarea)
- **Test RED → GREEN:**
  - RED: reutiliza F0-03.
  - GREEN: implementar el schema y `compareVersions` (igualdad sobre string, orden sobre `parseInt` validado, `remote` inválido → `throw`, `local` ausente/inválido → `seed`, `remote < local` → `noop` con `reason`). Ejecutar `npx vitest run src/db/version-gate.test.ts src/db/__tests__/seed-compare.test.ts` hasta verde.
- **Dependencia:** F0-03 (y contractualmente posterior a F0-02 para la verificación integrada, aunque el código no depende de la web).
- **Gate:** `npx tsc --noEmit` → 0 errores en app; `getRemoteVersion` deja de lanzar `ZodError` contra backend con `contentVersion` numérico legacy y escribe canónico string en `kv`; verificación manual: `remote < local` produce `noop` sin escrituras (assert de store intacto).

---

## W1 — Generador `scripts/build-content-bundle.ts` (spec §2)

### W1-01 — Tests RED W1: fixture de bundle + mapeo + naming + manifiesto

- **Repo + rama:** web — `Diccionario-endpoints`, rama `feat/fase-c-seed`
- **Criterios que cierra:** spec §2.3, §2.4, §2.5, §2.6, §5 (W1 mapeo/naming/manifiesto).
- **Archivos exactos (crear):**
  - `src/lib/seed/__fixtures__/bundle-small.json` (bundle mínimo: 2 words, 1 course con 1 module y 2 lessons —una con `content` objeto y una con documento corrupto E5—, 2 items `media[]` con `audio/mpeg` e `image/png`)
  - `src/lib/seed/bundle-builder.test.ts` (casos: mapeo courses/lessons, `spanish_norm`, `content` crudo preservado, `coverImage` NULL, naming `<sha256 minúsculas>.<ext>`, `mimeType` desconocido → código 3, `manifest.json` con conteos/bytes exactos y `files` ordenado, `dbSha256` coincidente con hash independiente)
  - `src/lib/seed/schema-parity.test.ts` (paridad `PRAGMA table_info` de 9 tablas contra el `SCHEMA` de la app; divergencia simulada → fallo)
- **Test RED → GREEN:**
  - RED: escribir los tests descritos y ejecutar `bun run test:run src/lib/seed/bundle-builder.test.ts src/lib/seed/schema-parity.test.ts`. Confirmar fallo (módulo `src/lib/seed/bundle-builder.ts` inexistente).
  - GREEN: se implementa en W1-02/W1-03/W1-04.
- **Dependencia:** F0-02 (el fixture utiliza `contentVersion` string canónico).
- **Gate:** tests en rojo por símbolo ausente, no por error de sintaxis del test. El fixture queda congelado como referencia de la cadena.

### W1-02 — Implementación GREEN W1 (núcleo): db extendida + `media_manifest`

- **Repo + rama:** web — `Diccionario-endpoints`, rama `feat/fase-c-seed`
- **Criterios que cierra:** spec §2.3, §2.4, §5 (W1 mapeo).
- **Archivos exactos (crear/editar):**
  - Crear: `src/lib/seed/bundle-builder.ts` (funciones puras: `buildDatabase(bundle)`, `mapCourses()`, `mapMediaManifest()`, `resolveExtension(mimeType)` con tabla cerrada §2.5; reutilizar `collectMediaRefs` / `refsToKeys` / `missingMediaKeys` de `src/lib/sync/full-bundle.ts` y `getObjectBytes` de `src/lib/r2.ts`)
  - Reutilizar sin modificar (lectura): `src/lib/sync/full-bundle.ts`, `src/lib/r2.ts:105-118`, `src/db/sqlite-store.ts` de la app (referencia de DDL, ruta absoluta documentada en el encabezado del módulo)
- **Test RED → GREEN:**
  - RED: subconjunto de W1-01 (mapeo, `spanish_norm`, `media_manifest` con `word_id` sintético `media:<objectKey>`, `local_uri` en minúsculas, `kind` por prefijo `mimeType`).
  - GREEN: implementar hasta que dicho subconjunto pase con `bun run test:run src/lib/seed/bundle-builder.test.ts`. Alcance mínimo: `words` (mapeo 1:1 de `export-db.py:149-168`, `examples` con `JSON.stringify` si es objeto), `courses`/`modules`/`lessons` según tabla §2.4 (`lessonNumber` numérico → TEXT, `content` crudo serializado), tablas de usuario vacías, `kv` con `piiyaak:contentVersion` y `schemaVersion = "4"`.
- **Dependencia:** W1-01.
- **Gate:** subconjunto de mapeo en verde; `bun run typecheck` sin errores nuevos; sin dependencias nuevas (solo `bun:sqlite` integrado).

### W1-03 — Implementación GREEN W1 (manifiesto, zip, foto atómica, códigos)

- **Repo + rama:** web — `Diccionario-endpoints`, rama `feat/fase-c-seed`
- **Criterios que cierra:** spec §0 (códigos 0/2/3/4), §2.2 (pasos 1–7), §2.5, §2.6, §5 (W1 manifiesto/foto/R2).
- **Archivos exactos (editar):**
  - `src/lib/seed/bundle-builder.ts` (agregar: `emitManifest()`, empaquetado zip determinista con entradas ordenadas, auto-verificación por reapertura, comparación `cvPre`/`bundle.contentVersion`/`cvPost`, verificación `sha256(bytes)` por item)
  - `src/lib/seed/bundle-builder.test.ts` (casos ya redactados en W1-01 para esta fase: `manifest.json` exacto con `format: "piiyaak-seed/1"`, `zipBytes`, `localPath`, conteos `words`/`courses`/`modules`/`lessons`/`mediaFiles`, `bytesTotal = dbBytes + Σ files[].size`; `cvPost !== cvPre` → código 2 con `<out>` borrado; `getObjectBytes` null → código 3; excepción de red → código 4; hash distinto → código 3)
- **Test RED → GREEN:**
  - RED: ejecutar el subconjunto de manifiesto/foto atómica y confirmar fallo antes de implementar.
  - GREEN: implementar hasta verde completo con `bun run test:run src/lib/seed/bundle-builder.test.ts src/lib/seed/schema-parity.test.ts`.
- **Dependencia:** W1-02.
- **Gate:** layout interno del zip exacto (`/piiyaak.db`, `/manifest.json`, `/media/<sha256>.<ext>`, sin subdirectorios salvo `media/`); `mimeType` fuera de la tabla §2.5 falla con código 3 e incluye el `objectKey` en el mensaje; nunca se deriva extensión de la URL.

### W1-04 — CLI delgado + métricas + paridad de esquema

- **Repo + rama:** web — `Diccionario-endpoints`, rama `feat/fase-c-seed`
- **Criterios que cierra:** spec §2.2 (firma CLI, env, `--expect-version`), §2.3 (sin bump `schemaVersion`), §3.2 paso 4 (líneas `METRIC`).
- **Archivos exactos (crear/editar):**
  - Crear: `scripts/build-content-bundle.ts` (envoltorio CLI: `--out <dir> [--api-base <url>] [--expect-version <N>]`; env `CI_SYNC_SECRET`, `SEED_API_BASE`, credenciales R2; impresión de `METRIC words|courses|modules|lessons|mediaFiles|bytes_total|bytes_audio|bytes_image`; códigos de salida §0)
  - Crear: `scripts/build-content-bundle.test.ts` (parseo de argumentos, `--expect-version` divergente → código 2 antes de descargar, secreto solo por entorno y nunca impreso)
  - `src/lib/seed/schema-parity.test.ts` (cierre del gate de paridad: las 9 tablas existen con las columnas del `SCHEMA` de la app; `schemaVersion` permanece `"4"`)
  - `package.json` (agregar script `seed:build: bun run scripts/build-content-bundle.ts --out dist/seed` si el mantenedor lo acepta; cambio aditivo)
- **Test RED → GREEN:**
  - RED: `bun run test:run scripts/build-content-bundle.test.ts` en rojo antes del CLI.
  - GREEN: implementar el envoltorio delgado (toda la lógica permanece en `bundle-builder.ts`) hasta verde.
- **Dependencia:** W1-03.
- **Gate:** `bun run scripts/build-content-bundle.ts --help` documenta la firma; el script nunca imprime el secreto; `schema-parity` en verde.

### W1-05 — Verificación local del artefacto (gate de bloque W1)

- **Repo + rama:** web — `Diccionario-endpoints`, rama `feat/fase-c-seed`
- **Criterios que cierra:** proposal §8 (gate W1), spec §5 (W1) y §5.1 (bordes R2 caído, `mimeType` desconocido).
- **Archivos exactos (usar, sin modificar salvo fixtures):**
  - Salida `dist/seed/` generada localmente (`piiyaak.db`, `media/`, `manifest.json`, `piiyaak-seed.zip`)
  - `src/lib/seed/__fixtures__/bundle-small.json` (entrada)
- **Test RED → GREEN:** no aplica test nuevo; es verificación de bloque:
  1. Ejecutar el generador contra el fixture (o contra staging con `SEED_API_BASE` de staging y `CI_SYNC_SECRET` de staging).
  2. Confirmar `PRAGMA integrity_check = ok` sobre la db extraída, conteos del bundle coincidentes y `dbSha256` verificado de forma independiente.
  3. Medir y registrar `COUNT/SUM` derivados del bundle (`files`, `bytes_total`, `bytes_audio`, `bytes_image`) como referencia para W2.
- **Dependencia:** W1-04.
- **Gate:** artefacto local completo y verificable; cualquier fallo produce código 2/3/4 documentado y ningún artefacto parcial. Este gate debe estar en verde antes de redactar W2.

---

## W2 — Workflow `.github/workflows/seed-content.yml` (spec §3)

### W2-01 — Definición del workflow (YAML, disparadores, pasos, publicación)

- **Repo + rama:** web — `Diccionario-endpoints`, rama `feat/fase-c-seed`
- **Criterios que cierra:** spec §3.1, §3.2 (pasos 1–11), §3.3, §3.4.
- **Archivos exactos (crear):**
  - `.github/workflows/seed-content.yml` (disparadores `workflow_dispatch` con inputs `content_version` y `dry_run` + `schedule` lunes 03:00 UTC; `concurrency: group: seed-content, cancel-in-progress: false`; `permissions: contents: read`; runner `ubuntu-latest`, Node 24, `oven-sh/setup-bun@v2`; pasos 1–11 del spec incluyendo SKIP barato por `latest.json`, guarda anti-sobrescritura por `objectExists`, `putObject` con `ContentType`, verificación post-publicación y subida de `manifest.json` como artifact)
- **Test RED → GREEN (sin correr el workflow real):**
  - RED: validación estática en rojo inicial (archivo ausente o con esquema incompleto).
  - GREEN: validación YAML satisfactoria (`yamllint` o `actionlint` si se encuentra disponible en el entorno; como mínimo `python3 -c "import yaml"` o `bunx --yes js-yaml`) más revisión de permisos mínimos y ausencia de secretos en el YAML (solo referencias `secrets.*`).
- **Dependencia:** W1-05 (el workflow invoca el generador verificado).
- **Gate:** el YAML declara los 11 pasos del spec sin desviaciones; `dry_run: true` omite los pasos 6, 7 y 9 por diseño; ningún secreto aparece en texto plano.

### W2-02 — Verificación sin workflow real: dry-run local + coherencia

- **Repo + rama:** web — `Diccionario-endpoints`, rama `feat/fase-c-seed`
- **Criterios que cierra:** spec §3.2 (paso 10), §3.3 (gates duros), §5 (W2), §5.1 (bordes).
- **Aclaración explícita (exigida por el brief):** esta tarea verifica todo lo verificable **sin** ejecutar el workflow real contra R2 de producción. Lo que sí se ejecuta: validación YAML (W2-01) + dry-run local del generador contra staging o contra fixture con `R2_ENDPOINT_OVERRIDE` hacia MinIO local. Lo que **no** se ejecuta en `apply`: `workflow_dispatch`/`schedule` reales ni publicación en `seed/<N>/` de producción.
- **Archivos exactos (usar/crear):**
  - `dist/seed/` (salida del dry-run)
  - Documentar el comando en la descripción del PR (no se versiona un script adicional salvo que resulte necesario; si se crea, ubicarlo en `scripts/seed-dry-run.sh`)
- **Test RED → GREEN:**
  - RED: casos esperados en rojo antes del ajuste: `missingMediaKeys` no vacío → job rojo; `latest.json` ya con `<N>` → SKIP verde sin `putObject` (verificado por contador mock); bytes re-descargados idénticos + `dbSha256` coincidente, diferencia → rojo.
  - GREEN: dry-run local en verde con métricas en el summary (`words`, `courses`, `modules`, `lessons`, `mediaFiles`, `bytes_total`, `bytes_audio`, `bytes_image`); primera corrida en modo medición (umbrales P5 como advertencias, no como gates).
- **Dependencia:** W2-01.
- **Gate:** dry-run verde; lista de gates duros confirmada (divergencia código 2, `missingMediaKeys`/hash código 3, `objectExists` falso, verificación post-publicación fallida). La publicación real queda programada fuera del `apply`.

### W2-03 — `DEPLOY.md` del change (secrets, rotación, runbook R12)

- **Repo + rama:** web — `Diccionario-endpoints`, rama `feat/fase-c-seed`
- **Criterios que cierra:** spec §3.5, §5.2, riesgos R6/R12.
- **Archivos exactos (crear):**
  - `openspec/changes/apk-offline-fase-c-seed/DEPLOY.md` (contenido mínimo: lista de secrets `CI_SYNC_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` y dónde configurarlos; rotación de `CI_SYNC_SECRET` paso a paso con verificación viejo-401/nuevo-200; verificación manual con `curl` del `manifest.json` público + `jq` de conteos y comparación `GET /api/sync/version` vs `latest.json`; runbook R12 para `remote < local` con causas, confirmación y bump manual o reseteo dirigido)
- **Test RED → GREEN:** verificación documental (checklist §3.5 completo). Sin test automatizado; la revisión exige que cada comando del documento sea copiable y que ningún ejemplo incluya valores secretos.
- **Dependencia:** W2-02.
- **Gate:** revisión de un segundo lector confirma que el documento permite publicar y verificar sin acceder a este change. El workflow no se considera terminado sin este archivo.

---

## W3 — App `feat/mobile-fase-c` (spec §4)

### W3-01 — Dependencia nativa + configuración (requiere build EAS real fuera del `apply`)

- **Repo + rama:** app — `piiyaak-app`, rama `feat/mobile-fase-c`
- **Criterios que cierra:** spec §4.1, riesgo R5.
- **Archivos exactos (editar):**
  - `package.json` (agregar `react-native-zip-archive` v9 mediante `npx expo install react-native-zip-archive`)
  - `app.json` (extender `plugins` a `["expo-router", "react-native-zip-archive"]`)
  - `eas.json` (definir `EXPO_PUBLIC_SEED_BASE_URL` —mismo valor que `R2_PUBLIC_BASE_URL`— en los perfiles `preview` y `production`; documentar la variable en el encabezado del perfil)
- **Test RED → GREEN:**
  - RED: `npx tsc --noEmit` y resolución del módulo fallan antes de la instalación (import inexistente).
  - GREEN: instalación completa y `npx tsc --noEmit` → 0 errores en simulador local. **Límite explícito:** la compatibilidad con old arch sobre SDK 52 (RN 0.76.9) únicamente queda validada con un build EAS real en `development`/`preview` (apk). Dicha validación pertenece a la fase de dispositivo (§5.3) y queda fuera del `apply`.
- **Dependencia:** F0-04 (contrato de versión estable) y W1-05 (formato del artefacto conocido).
- **Gate:** diff limitado a las tres configuraciones; plan B `unzipit` documentado en la descripción del PR pero no instalado salvo bloqueo del build.

### W3-02 — Esquema `manifest.json` + verificación en dispositivo (sin re-hash por archivo)

- **Repo + rama:** app — `piiyaak-app`, rama `feat/mobile-fase-c`
- **Criterios que cierra:** spec §2.6, §4.4, §5 (W3 manifiesto), §5.1 (manifiesto corrupto, `schemaVersion` distinta, espacio insuficiente).
- **Archivos exactos (crear/editar):**
  - Crear: `src/db/seed-manifest.ts` (schema Zod del manifiesto: `format === "piiyaak-seed/1"`, tipos §2.6, `files` ordenado; lector que aborta ante major distinto)
  - Crear: `src/db/__tests__/seed-manifest.test.ts` (manifiesto válido pasa; `format` distinto, `dbSha256` con mayúsculas o longitud inválida, conteo negativo → rechazo; `schemaVersion !== "4"` → no adoptar)
  - Crear o extender: `src/db/__tests__/seed-verify.test.ts` (chequeos §4.4: existencia + `size === files[].size` vía `getInfoAsync` mockeado; `PRAGMA integrity_check`; `kv.schemaVersion`; `kv.piiyaak:contentVersion === remote`; `COUNT(*)` coincidente; cualquier fallo → sin swap)
- **Test RED → GREEN:**
  - RED: escribir los tests y ejecutar `npx vitest run src/db/__tests__/seed-manifest.test.ts src/db/__tests__/seed-verify.test.ts`. Confirmar fallo (módulos inexistentes).
  - GREEN: implementar `seed-manifest.ts` y la función de verificación hasta verde. Decisión §4.4 aplicada: no se recalcula `sha256` por archivo; la cobertura se documenta por capas (HTTPS + CRC32 nativo + sizes + `dbSha256` + conteos, con verificación real de hashes en CI §3.2 paso 8).
- **Dependencia:** W3-01.
- **Gate:** `manifest.json` inválido o `dbSha256` distinto implica sin swap (assert explícito en test).

### W3-03 — Pantalla "Preparando contenido" (máquina de 6 estados)

- **Repo + rama:** app — `piiyaak-app`, rama `feat/mobile-fase-c`
- **Criterios que cierra:** spec §4.2, §5.2 (Delivery Gate antislop en superficie UI).
- **Archivos exactos (editar/crear):**
  - `src/app/index.tsx` (reemplazar el texto estático de la línea 83 por la máquina de estados; la apertura instantánea vía `db-context.tsx:63-84` permanece intacta como fallback)
  - Crear: `src/components/seed-progress.tsx` (componente de progreso: barra + `X de Y MB (N %)`; `accessibilityRole="progressbar"`; error con `accessibilityRole="alert"`; objetivos táctiles ≥ 44pt)
  - Crear o extender: `src/components/__tests__/seed-progress.test.ts` (si la suite lo admite; como mínimo tests de la máquina de estados: `checking` → `downloading` → `verifying` → `installing` → `ready` / `error` con `canRetry` y `textOnly`)
- **Copy exigido (neutral, sin hype):** `checking` "Comprobando versión del contenido…"; `downloading` "Descargando contenido…"; `verifying` "Verificando contenido…"; `installing` "Instalando contenido…" con fase "copiando datos" / "moviendo medios"; `error` con mensaje específico + botones "Reintentar" y "Continuar solo con texto". El diccionario de texto permanece utilizable en `error`.
- **Test RED → GREEN:**
  - RED: tests de estados en rojo antes del componente.
  - GREEN: implementar hasta verde con `npx vitest run` del área correspondiente.
- **Dependencia:** W3-02 (la pantalla consume los estados de verificación).
- **Gate:** Delivery Gate antislop (superficie UI) → PASS; `npx tsc --noEmit` → 0 errores; sin bloqueo sin salida.

### W3-04 — Descarga reanudable (`createDownloadResumable` + registro `kv`)

- **Repo + rama:** app — `piiyaak-app`, rama `feat/mobile-fase-c`
- **Criterios que cierra:** spec §4.3, §5 (W3 interrupción), §5.1 (corte a mitad, almacenamiento lleno).
- **Archivos exactos (crear/editar):**
  - Crear: `src/db/seed-download.ts` (primero `manifest.json` liviano para SKIP tardío; luego zip vía `FileSystem.createDownloadResumable(url, <documentDirectory>seed-<N>.zip.part, {}, onProgress)`; persistencia `kv` `piiyaak:seedDownload:<N>` con `{ partName, totalBytes, updatedAt }`; `pauseAsync`/`resumeAsync` en sesión; entre reinicios: reanudar si existe `.part` + registro para el mismo `<N>` y el servidor acepta rango, en caso contrario descarga fresca con borrado del parcial; URLs well-known `<base>/seed/<remote>/manifest.json` y `<base>/seed/<remote>/piiyaak-seed.zip` desde `EXPO_PUBLIC_SEED_BASE_URL`; la app nunca construye URLs desde `latest.json`)
  - Crear: `src/db/__tests__/seed-download.test.ts` (contrato de interrupción simulada: segundo intento completa sin corrupción por reanudación o reinicio limpio; parcial aislado en `.part`; db viva intacta; almacenamiento lleno → estado `error` con reintento)
- **Test RED → GREEN:**
  - RED: contrato de interrupción en rojo (módulo inexistente o comportamiento incorrecto con `FileSystem` mockeado).
  - GREEN: implementar hasta verde con `npx vitest run src/db/__tests__/seed-download.test.ts`.
- **Dependencia:** W3-02 (el `manifest.json` aporta hashes y tamaños para decidir SKIP tardío).
- **Gate:** corte a mitad deja la db viva sin tocar; el test verifica el contrato, no el mecanismo del sistema operativo. La interrupción real (modo avión) se verifica en dispositivo, fuera del `apply`.

### W3-05 — Swap atómico con preservación (`ATTACH`, 8 pasos)

- **Repo + rama:** app — `piiyaak-app`, rama `feat/mobile-fase-c`
- **Criterios que cierra:** spec §4.5, §5 (W3 swap), §5.1 (bundle corrupto, conteo divergente).
- **Archivos exactos (crear/editar):**
  - Crear: `src/db/seed-swap.ts` (pasos §4.5 en orden: 1. `closeAsync` de la viva; 2. apertura temporal + `PRAGMA integrity_check`; 3. `ATTACH ... AS live` y copia exacta de `course_progress`, `outbox`, `history` con `INSERT OR REPLACE ... SELECT *`; 4. verificación `COUNT(*)` de las 3 tablas `main === live`, divergencia → abortar con `DETACH` sin tocar la viva; 5. `DETACH`, cierre, renombre viva → `.bak` y nueva → `SQLite/piiyaak.db` vía `moveAsync`; 6. reapertura `openDatabaseSync` + `setLocalVersion` conjunta, fallo → restaurar `.bak` y estado `error`; 7. medios por `stem sha256` a `audios/` o `illustrations/` según prefijo de `mimeType`; 8. limpieza de tmp, `.part`, `piiyaak:seedDownload:<N>` y `.bak` solo tras éxito)
  - Crear: `src/db/__tests__/seed-swap.test.ts` (dbs en memoria con `ATTACH`: preservación fila a fila de las 3 tablas, adopción conjunta de `contentVersion`, reemplazo de `words`, conteo divergente simulado → sin swap con viva intacta, reapertura fallida → restauración de `.bak`)
- **Test RED → GREEN:**
  - RED: tests de swap en rojo (módulo inexistente).
  - GREEN: implementar hasta verde con `npx vitest run src/db/__tests__/seed-swap.test.ts`.
- **Dependencia:** W3-04 (el swap solo opera sobre el directorio temporal verificado de §4.4).
- **Gate:** `PRAGMA integrity_check` distinto de `ok` aborta antes del paso 5; la db viva no se toca hasta el paso 5 (assert de test).

### W3-06 — Integración del gate solo-adelante + regresión

- **Repo + rama:** app — `piiyaak-app`, rama `feat/mobile-fase-c`
- **Criterios que cierra:** spec §4.6, §5 (W3 tri-estado), §5.2 (gates de cierre).
- **Archivos exactos (editar):**
  - `src/db/sync.ts` (extender `syncNow` con `compareVersions`: `skip` → retorno vacío sin red adicional con assert de cero fetch tras version; `seed` → flujo §4.2–§4.5; `noop` → warn estructurado sin seed y continuación con local; el sync incremental posterior opera sobre la db adoptada)
  - `src/db/sync.test.ts` (extender con tri-estado + `remote < local` no-op con store intacto + string/number de F0)
  - `src/db/version-gate.test.ts` (confirmar escritura conjunta `setLocalVersion` tras adopción)
- **Test RED → GREEN:**
  - RED: casos de integración en rojo (gate actual solo compara igualdad, sin tri-estado).
  - GREEN: implementar hasta `npx vitest run src/db/sync.test.ts src/db/version-gate.test.ts` en verde más regresión de Fases A/B (`npx vitest run` completo de `src/db/`).
- **Dependencia:** W3-05 (requiere descarga y swap verificados).
- **Gate:** `npx tsc --noEmit` → 0 errores; `lint` en archivos tocados sin disputa de estilo; regresión de Fases A/B en verde.

---

## CLOSE-01 — Gates finales de ambos repositorios

- **Repo + rama:** web `feat/fase-c-seed` y app `feat/mobile-fase-c` (verificación cruzada, sin código nuevo).
- **Criterios que cierra:** spec §5.2.
- **Archivos:** ninguno (tarea de verificación).
- **Verificación:**
  - Web: `bun run typecheck` → 0 errores; `bun run lint` (o `bunx eslint` según convención del repo) en archivos tocados; `bun run test:run` completo en verde.
  - App: `npx tsc --noEmit` → 0 errores; `lint` equivalente; `npx vitest run` completo en verde.
  - Confirmar `DEPLOY.md` completo y `seed-content.yml` validado.
- **Dependencia:** W2-03 y W3-06.
- **Gate:** todos los comandos anteriores en verde. La validación en dispositivo (§5.3: unzip v9, zip de tamaño real en gama media/baja, interrupción real, offline total post-seed) queda registrada como pendiente fuera del `apply` y no bloquea el cierre de tareas, pero debe citarse en el reporte final.

---

## Review Workload Forecast

- **Chained PRs recommended:** Yes.
  - Web (`Diccionario-endpoints`, `feat/fase-c-seed` → `main`): **3 PRs encadenados** (stacked-to-main, según `chain_strategy` del proposal).
    1. `F0-web` (F0-01 + F0-02): contrato string en 4 rutas + tests.
    2. `W1-generador` (W1-01 … W1-05): `bundle-builder.ts` + CLI + tests + fixture.
    3. `W2-workflow` (W2-01 … W2-03): `seed-content.yml` + `DEPLOY.md`.
  - App (`piiyaak-app`, `feat/mobile-fase-c` → `main`): **2 PRs encadenados** (stacked-to-main).
    1. `F0-contrato` (F0-03 + F0-04): schema tolerante + `compareVersions` + tests.
    2. `W3-seed` (W3-01 … W3-06): dependencia v9 + manifiesto + pantalla + descarga + swap + integración.
  - Total: **5 PRs** en 2 repos. Cada PR incluye sus tests y docs (nunca se recortan tests ni comentarios para ajustar el presupuesto).
- **400-line budget risk:** High (ambos bloques principales superan el umbral por diseño).
- **Changed lines estimadas (adiciones + eliminaciones, sin contar `package-lock.json` ni `dist/`):**
  - Web F0: ~120–180.
  - Web W1: ~600–750 (núcleo ~350 + tests ~300 + CLI ~120).
  - Web W2: ~280–350 (YAML ~150 + `DEPLOY.md` ~150).
  - **Subtotal web: ~1000–1280.**
  - App F0: ~120–180.
  - App W3: ~850–1100 (pantalla ~250 + descarga ~150 + verificación ~150 + swap ~200 + tests ~350 + config).
  - **Subtotal app: ~970–1280.**
  - Ningún slice individual, salvo F0-web y F0-app, cabe en 400 líneas; por ello se aplica encadenado y no compresión.
- **Decision needed before apply:** Yes.
  1. **Chain strategy:** confirmar `stacked-to-main` (propuesta en el proposal) frente a `feature-branch-chain` con tracker draft/no-merge. La recomendación de este forecast es `stacked-to-main` en ambos repos por tratarse de unidades que pueden integrarse en orden. Sin confirmación, `apply` no debe crear ramas ni PRs.
  2. **Alcance de validación EAS:** confirmar que la instalación de `react-native-zip-archive` v9 y el build `development`/`preview` (apk) con prueba en dispositivo real de gama media quedan **fuera** del `apply` y se ejecutan como verificación posterior (§5.3). El `apply` entrega código + tests en verde, no binarios validados.
- **Notas de entrega:** `delivery_strategy: auto-chain` (F0 → W1 → W2 → W3, cada unidad con gate TDD). Si el forecast resulta en encadenados, la estrategia de cadena se pregunta antes de crear cualquier PR, conforme a la skill `chained-pr`. El unzip v9 requiere validación en build EAS real fuera del `apply`; dicha validación se registra como riesgo y como trabajo pendiente de dispositivo.

## Trazabilidad de skills

- `api-design-patterns`: contrato aditivo F0 (`String()` en el borde, 401 genérico heredado), error mínimo y todo-o-nada en W1/W2, idempotencia por `contentVersion`, `PUT` atómico de `latest.json`. Aplicada en F0-02, W1-03, W1-04, W2-01, W2-02.
- `react-native-patterns`: reutilización de seams (`Asset`/copy/open, `fileNameFor`, gate con Zod en el borde), estados explícitos de pantalla, I/O nativo fuera del hilo JS, sin secretos en el bundle. Aplicada en W3-01 … W3-06.
- `test-driven-development-tdd`: ciclo RED → GREEN → refactor por comparador, mapeo, manifiesto, descarga y swap; cada tarea declara su RED verificable y el criterio "sin test en rojo previo no hay código". Aplicada en todas las tareas F0/W1/W3 y en la verificación W2-02.
- `chained-pr`: presupuesto de 400 líneas, corte por unidad de trabajo entregable con tests y docs, pronóstico de 5 PRs en 2 repos y decisión de estrategia previa al `apply`. Aplicada en el forecast.
