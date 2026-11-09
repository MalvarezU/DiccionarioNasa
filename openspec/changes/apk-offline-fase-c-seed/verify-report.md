# Verify report: `apk-offline-fase-c-seed` — Robot de semilla + APK auto-actualizable

- **Fecha:** 2026-11-09. **Validador:** sesión fresca (no autora del código).
- **Ramas verificadas:** web `feat/fase-c-seed` (`Diccionario-endpoints`, HEAD `f1b9694`) · app `feat/mobile-fase-c` (`piiyaak-app`, HEAD `43190a7`).
- **Commits F0:** web `0e20f46` (String(version) en 4 rutas) · app `8849760` (Zod tolerante + solo-adelante).
- **Alcance de este reporte:** todo lo verificable sin dispositivo ni CI real. Lo que exige EAS, R2 real o hardware queda en la sección NO ejecutable, con motivo por ítem. No se escribió código de producción; no se pusheó nada.

## 1. Cobertura F0 — Tipo canónico de `contentVersion` (spec §1)

**Estado: cubierto en ambos repos.**

- Web: las 4 rutas serializan `String(await getContentVersion())` — verificado por lectura directa en `src/app/api/sync/version/route.ts:15`, `seed/route.ts:74`, `sync/route.ts:162`, `full/route.ts:145`. `getContentVersion()` sigue retornando `number` interno (sin cambio funcional, spec §1.1).
- Tests web: `version/route.test.ts` (`toBe("41")`, `typeof === "string"`), `full/route.test.ts:111-112`, `sync.test.ts:130-131`, `seed/route.test.ts:31-32` (archivo creado en F0, exigido por tasks F0-01). Suite sync+seed en verde (59/59).
- App: `VersionResponseSchema` tolerante (`z.union([string /^\d+$/, number int nonneg]).transform(String)`, `version-gate.ts:18-21`) y `compareVersions` tri-estado (`version-gate.ts:38-53`) conforme a spec §1.3 (remote inválido → `throw`; local ausente/inválido → `seed`; igualdad string → `skip`; `remote < local` → `noop` con `reason`; orden por `parseInt`).
- `export-db.py` sin cambios en la rama móvil (último toque `d9a475e`, previo a Fase C): `isinstance(..., str)` opera sin modificación, como exige spec §1.2.
- Regresión fase-a post-F0: 100/100 en verde con MariaDB local (ver §5).

## 2. Cobertura W1 — Generador bundle (spec §2)

**Estado: cubierto (web).**

- `src/lib/seed/bundle-builder.ts` (lógica pura, red/SQLite inyectados) + `scripts/build-content-bundle.ts` (CLI delgado) + `src/lib/seed/seed-zip.ts` (writer/reader `stored` propio, CRC32, timestamps fijos `2024-01-01`, entradas ordenadas → determinista) + `package.json: seed:build`.
- Mapeo §2.4 verificado por lectura: `words` 1:1 con `spanish_norm`/`nasaYuwe_norm` y `examples` con `JSON.stringify` si es objeto; `courses` sin `createdAt`; `modules`/`lessons` con `lessonNumber` numérico → TEXT y `content` crudo serializado; `media_manifest` con `word_id` sintético `media:<objectKey>` y `local_uri` `media/<sha256>.<ext>` en minúsculas; `kv` con `piiyaak:contentVersion` canónico + `schemaVersion = "4"` sin bump.
- Tabla cerrada de extensiones §2.5 exacta (13 entradas, case-insensitive); `mimeType` fuera de tabla → código 3 con `objectKey` en el mensaje; nunca se deriva extensión de la URL.
- `manifest.json` §2.6 exacto: `format: "piiyaak-seed/1"`, `dbSha256`/`sha256` hex64, `zipBytes`, `localPath` por archivo, conteos `words/courses/modules/lessons/mediaFiles`, `bytesTotal = dbBytes + Σ files[].size`, `files` ordenado por `objectKey`. Zip con layout `/piiyaak.db`, `/manifest.json`, `/media/…` y auto-verificación por reapertura (conteos + `dbSha256` + integridad).
- Foto atómica: `cvPre` (versión pública) vs `bundle.contentVersion` vs `cvPost`; divergencia → código 2 con `<out>` borrado; `--expect-version` aborta antes de descargar. Códigos 0/2/3/4 según spec §0; secreto solo por entorno, nunca impreso (CLI no loguea `ciSecret`).
- Paridad de esquema: `SEED_SCHEMA_SQL` verbatim de la app + `assertSchemaParity` sobre `PRAGMA table_info` de las 9 tablas; `schema-parity.test.ts` en verde. **Desviación documentada (ver WARNING W-1):** `image/* → kind "illustration"` (no `"image"` como escribe spec §2.4) porque el `CHECK` real del SCHEMA de la app solo admite `('audio','illustration')`.

## 3. Cobertura W2 — Workflow `seed-content.yml` (spec §3)

**Estado: cubierto (definición + validación estática; ejecución real fuera de alcance, ver NO ejecutable).**

- Disparadores: `workflow_dispatch` (inputs `content_version`, `dry_run`) + `schedule` lunes 03:00 UTC; `concurrency: group seed-content, cancel-in-progress: false`; `permissions: contents: read`. Parse YAML válido.
- Los 14 steps cubren los 11 pasos numerados del spec §3.2 (checkout; node 24 + `npm ci` + `prisma generate`; `oven-sh/setup-bun@v2`; generar con líneas `METRIC` al summary; SKIP por `latest.json`; guarda anti-sobrescritura por `objectExists`; `putObject` zip+manifest con `ContentType` + verificación; verificación post-publicación con `cmp` + `sha256` de la db extraída; `latest.json` por PUT único + verificación; verificación local en `dry_run`; artifact `seed-manifest`). Paso adicional no exigido pero coherente: guarda de secretos requeridos con fallo cerrado sin valores.
- `dry_run: true` omite guarda, publicación y `latest.json` por diseño (`if: ${{ !inputs.dry_run ... }}`).
- Secretos: 30 referencias, todas `secrets.*`/`vars.*`/`env:`; ningún valor en texto plano; sin `set -x`; matriz de logging §3.4 respetada en comentarios del YAML.
- `DEPLOY.md` completo: 6 secretos + ubicación, rotación `CI_SYNC_SECRET` con verificación viejo-401/nuevo-200, verificación manual (`curl` + `jq`, comparación `/api/sync/version` vs `latest.json`), runbook R12 (causas, confirmación, bump hacia adelante, nunca auto-downgrade), dry-run por 3 vías, matriz de logging, códigos de salida.

## 4. Cobertura W3 — App (spec §4)

**Estado: cubierto a nivel de código + tests (mecanismo nativo pendiente de dispositivo, ver NO ejecutable y WARNING W-2).**

- **W3-01:** `react-native-zip-archive@^9.5.3` en `package.json` + plugin en `app.json` (`["expo-router", "react-native-zip-archive"]`); `EXPO_PUBLIC_SEED_BASE_URL` declarada en perfiles `preview` y `production` de `eas.json` (**valor actual `""` → seed deshabilitado en runtime; ver WARNING W-3**). Envoltorio `seed-unzip.ts` con resolución perezosa, `subscribe` con `remove()` en `finally`, guarda de destino `file://`.
- **W3-02:** `seed-manifest.ts` con schema Zod (`format` literal, versiones `/^\d+$/`, hex64, `localPath` regex, `files` ordenado sin duplicados, `mediaFiles === files.length`, `bytesTotal` consistente) + `verifySeedDir` en el orden de §4.4 (espacio libre con margen `uncompressed + dbBytes` → existencia + `size` por archivo → `integrity_check` → `schemaVersion === "4"` → `contentVersion === remote` → `COUNT(*)` de `words/courses/lessons`). Sin re-hash por archivo, según decisión §4.4 (documentada en el encabezado del módulo).
- **W3-03:** máquina de 6 estados (`seed-machine.ts`: `checking → downloading → verifying → installing → ready / error`, `RETRY → checking`, `ready` terminal) + `seed-progress.tsx` con copy neutral exacto del spec, `accessibilityRole="progressbar"` con valores, `alert` en error, botones "Reintentar" / "Continuar solo con texto", `minHeight: 44` en ambos botones. Fallback de texto intacto (`index.tsx:84-88`: `SeedProgress` si hay `seedState`, si no el texto estático heredado). Apertura instantánea vía `Asset` + copia en `db-context.tsx:168-217` intacta.
- **W3-04:** `seed-download.ts` — primero `manifest.json` liviano (valida schema + SKIP tardío por `contentVersion`), luego zip en `.part` + registro kv `piiyaak:seedDownload:<N>` con `{ partName, totalBytes, updatedAt }` (solo metadatos); URLs well-known desde `EXPO_PUBLIC_SEED_BASE_URL`, nunca desde `latest.json`; base vacía → seed deshabilitado. **Limitación (WARNING W-2):** `seed-expo.ts:124-139` ignora `offset` y no cablea `pauseAsync`/`resumeAsync` ni `Range`; ante corte hay re-descarga limpia desde cero (sin corrupción, pero sin ahorro de bytes). El contrato testeado (segundo intento completa sin corrupción) se cumple por reinicio limpio.
- **W3-05:** `seed-swap.ts` en el orden de §4.5 (cerrar viva → `integrity_check` → `ATTACH` + copia exacta de `course_progress`/`outbox`/`history` con `INSERT OR REPLACE ... SELECT *` → verificación `COUNT(main)===COUNT(live)` con `DETACH` + aborto ante divergencia → renombre viva→`.bak` + nueva→viva → reapertura + `setLocalVersion` conjunta con restauración de `.bak` ante fallo → medios por stem `sha256` a `audios/`/`illustrations/` según prefijo `mimeType` → limpieza solo tras éxito). La viva no se toca hasta el paso 5 (assert en tests). SQL exacto centralizado en `seedCopySql`.
- **W3-06:** `sync.ts:177-195` integra `compareVersions` (`skip` → retorno vacío sin red adicional; `noop` → `console.warn` estructurado sin escrituras; `seed` → delega en `runSeed` inyectado o rama heredada). `db-context.tsx:222+` chequea el seed en segundo plano tras apertura instantánea y cablea `runExpoSeedFlow` con `retrySeed`/`continueTextOnly`.

## 5. Matriz de criterios (spec §9 + tasks CLOSE-01)

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| F0-1 | 4 rutas emiten string; app parsea string+number, escribe canónico | PASS | Lectura de 4 rutas + tests `toBe("41")`; suite 59/59 |
| F0-2 | `export-db.py` sin cambios produce gate | PASS | Sin toques en rama Fase C |
| W1-1 | Mapeo courses/lessons, `spanish_norm`, contenido crudo, `coverImage` NULL | PASS | `bundle-builder.test.ts` en verde (suite 59/59) |
| W1-2 | Naming `<sha256>.<ext>` minúsculas; `mimeType` desconocido → código 3 | PASS | Tests + lectura `resolveExtension` |
| W1-3 | `manifest.json` exacto + `dbSha256` independiente + foto atómica | PASS | Tests + `runBuild` pasos 6–7 |
| W1-4 | CLI, `--expect-version`, secreto solo por entorno, `METRIC`, paridad 9 tablas | PASS | `build-content-bundle.test.ts` + `schema-parity.test.ts` en verde |
| W2-1 | YAML 11 pasos, sin secretos en plano | PASS | Validación estática + 30 refs `secrets.*`, 0 valores |
| W2-2 | Dry-run local, gates duros, SKIP | PASS (diseño) | Lógica `dry_run`/`SKIP`/guardas verificada por lectura; ejecución real en NO ejecutable |
| W2-3 | `DEPLOY.md` completo | PASS | Lectura integral (secrets, rotación, verificación, R12) |
| W3-1 | unzip v9 + plugin + EAS | PASS (código) | `package.json`/`app.json`/`seed-unzip.ts`; build real en NO ejecutable |
| W3-2 | Manifiesto + verificación sin re-hash | PASS | `seed-manifest.test.ts` + `seed-verify.test.ts` en verde |
| W3-3 | Pantalla 6 estados, copy, a11y, antislop UI | PASS | `seed-machine.test.ts` + `seed-progress.test.ts` en verde; revisión manual de copy/roles/44pt |
| W3-4 | Descarga reanudable + contrato de interrupción | PASS con WARNING W-2 | `seed-download.test.ts` en verde; reanudación real por rangos no cableada |
| W3-5 | Swap 8 pasos + preservación | PASS | `seed-swap.test.ts` (8 tests) en verde |
| W3-6 | Gate tri-estado + regresión | PASS | `seed-compare.test.ts`, `sync.test.ts` extendido, suite app 188/188 |
| C-1 | `tsc --noEmit` ambos repos → 0 errores | PASS | Web exit 0; app exit 0 |
| C-2 | Lint en archivos tocados | PASS / N/A | Web `eslint` en seed+rutas: exit 0; app sin script `lint` (N/A) |
| C-3 | Delivery Gate antislop (superficie W3-03) | PASS (manual) | Copy neutral sin hype; sin eyebrow ALL-CAPS, sin middle-dots, sin `→`; roles a11y; táctiles ≥ 44pt |

## 6. Regresiones

- **Fase A (web, post-F0):** `tests/fase-a/`, 11 archivos, **100/100 en verde** con MariaDB local `127.0.0.1:3307` (el servidor ya estaba arriba con `test:test`; no hizo falta levantarlo).
- **Suite app:** `npx vitest run`, 26 archivos, **188/188 en verde** (incluye `seed-compare`, `seed-manifest`, `seed-verify`, `seed-download`, `seed-swap`, `seed-flow`, `seed-machine`, `seed-unzip`, `seed-progress`, `version-gate`, `sync`).
- **Suite web sync+seed:** `src/app/api/sync/ + src/lib/seed + scripts/build-content-bundle.test.ts`, 7 archivos, **59/59 en verde**.

## 7. Hallazgos

### CRITICAL — ninguno.

### WARNING

- **W-1 (W1 vs spec §2.4, nivel documentación):** el spec escribe `kind: image` para `image/*`, pero la implementación mapea `image/* → "illustration"`. La implementación es la correcta: el `CHECK (kind IN ('audio','illustration'))` del SCHEMA real de la app (`sqlite-store.ts:83`) rechazaría `"image"` y rompería `integrity_check`. La desviación está documentada en el encabezado de `bundle-builder.ts`. Acción: registrar errata en `spec.md` §2.4 antes de archivar (una línea).
- **W-2 (W3-04, reanudación nominal):** `seed-expo.ts:124-139` ignora `_opts.offset` y no usa `pauseAsync`/`resumeAsync` ni encabezado `Range`; `supportsResume` (HEAD `accept-ranges`) solo decide si se conserva o borra el `.part`, pero la descarga siempre reinicia desde cero. El contrato testeado (completar sin corrupción) se cumple y la db viva nunca se toca, pero un reintento en red pobre re-descarga el 100 % de los bytes. Además `resumed: true` puede reportarse cuando en realidad hubo reinicio limpio. Acción sugerida: cablear `Range`/`resumeAsync` o renombrar el flag a `partialReused` antes de Fase D.
- **W-3 (operativo, bloquea validación en dispositivo):** `eas.json` (`preview` y `production`) trae `"EXPO_PUBLIC_SEED_BASE_URL": ""`. Con base vacía `seedBaseUrl()` retorna `null` y el seed nunca corre (correcto como fusible, pero la validación §5.3 exige publicar R2, setear el valor real y rebuild). Acción: paso operativo previo a cualquier prueba EAS.
- **W-4 (cosmético):** `seed-expo.ts:148` descarta `updatedAt` del registro (`""` fijo). Sin impacto funcional.

### SUGGESTION

- **S-1:** emitir `INSTALL "copiando datos"` después (no antes) del `unzip` en `seed-flow.ts:65-68`, para que la fase describa la etapa real.
- **S-2:** la app no tiene script `lint`; considerar `eslint` mínimo sobre `src/db/seed-*` y `src/components/seed-progress.tsx` en Fase D.
- **S-3:** antes de archivar el change, anotar en `spec.md` las dos erratas detectadas (W-1 kind `illustration`; W-2 alcance real de la reanudación) para que Fase D no herede texto contradictorio.

## 8. Veredicto: PASS

Todo lo verificable sin dispositivo, CI real ni R2 real está implementado conforme al spec, con tests en verde y gates de cierre en verde. Los 4 WARNING son documentación, mecanismo simplificado cubierto por contrato, y un paso operativo pendiente — ninguno invalida un criterio de aceptación verificable en CI. La validación en dispositivo (§5.3) queda como pendiente explícito fuera del `apply`, tal como ya lo declara tasks CLOSE-01.

### Comandos corridos (resultado exacto observado)

- Web `npx vitest run src/app/api/sync/ src/lib/seed scripts/build-content-bundle.test.ts` → `Test Files 7 passed (7)`, `Tests 59 passed (59)`.
- Web `DATABASE_URL="mysql://test:test@127.0.0.1:3307/piiyaak_test" npx vitest run tests/fase-a/` → `Test Files 11 passed (11)`, `Tests 100 passed (100)` (MariaDB ya activa; no se levantó nada).
- Web `npx tsc --noEmit` → exit `0`, sin salida (0 errores).
- Web `npx eslint src/lib/seed/ scripts/build-content-bundle.ts src/app/api/sync/version/route.ts src/app/api/sync/seed/route.ts src/app/api/sync/route.ts src/app/api/sync/full/route.ts` → exit `0`, sin hallazgos.
- Web `python3 -c "yaml.safe_load(...seed-content.yml...)"` → `YAML ok`, triggers `workflow_dispatch` + `schedule`, 14 steps (nota: `on` parsea como clave `True` en YAML 1.1; irrelevante para Actions).
- App `npx vitest run` → `Test Files 26 passed (26)`, `Tests 188 passed (188)`.
- App `npx tsc --noEmit` → exit `0`, sin salida (0 errores).
- No se pusheó nada (solo lecturas y suites locales).

## 9. NO ejecutable en este entorno (motivo por ítem)

1. **Disparo real del workflow (`workflow_dispatch`/`schedule`) y publicación en `seed/<N>/` de producción:** requiere GitHub Actions con los 6 secretos y el bucket R2 real; este entorno no tiene credenciales ni red de CI. Solo se validó estática del YAML + lógica de pasos por lectura.
2. **Dry-run real contra staging o MinIO (`R2_ENDPOINT_OVERRIDE`):** requiere `SEED_API_BASE`/`CI_SYNC_SECRET` de staging o MinIO local; ninguno accesible desde aquí. Solo se verificó el diseño `dry_run` del workflow y los tests del generador sobre fixture.
3. **Primera corrida de medición COUNT/SUM (research P5):** requiere la BD real con medios; el fixture `bundle-small.json` (2 words, 1 curso) no produce cifras representativas. Los umbrales siguen como advertencias, según el spec.
4. **Build EAS `development`/`preview` (apk) con `react-native-zip-archive` v9 sobre old arch SDK 52:** requiere EAS cloud; el módulo nativo no se ejercita en Node (los tests inyectan la API). Agravado por WARNING W-3 (base URL vacía).
5. **Unzip de tamaño real en gama media/baja (ANR/OOM) y guarda de espacio efectiva:** requiere hardware físico; `getUncompressedSize`/`getFreeDiskStorageAsync` solo están cableados, no medidos.
6. **Interrupción real (modo avión) con reanudación:** requiere radio real; el test simula el contrato con `FileSystem` mockeado (y WARNING W-2 limita el alcance a reinicio limpio).
7. **Instalación nueva 100 % offline post-seed (modo avión: diccionario + cursos + medios sin red):** requiere instalación nueva en dispositivo con el CDN publicado (bloqueado por ítems 1 y 4).
8. **Rotación real de `CI_SYNC_SECRET` (viejo-401/nuevo-200):** requiere Vercanuestro/GitHub con valores reales; `DEPLOY.md` documenta el procedimiento sin ejecutarlo.

## 10. Trazabilidad de skills

- **`api-design-patterns`:** contrato aditivo F0 (`String()` en el borde, 401 genérico heredado), error mínimo y todo-o-nada en W1/W2 (códigos 2/3/4, sin artefacto parcial), idempotencia por `contentVersion`, PUT atómico de `latest.json`, matriz de logging sin secretos. Aplicada en §§1–3.
- **`react-native-patterns`:** reutilización de seams (`Asset`/copy/open, `setLocalVersion`, `fileNameFor` por stem), estados explícitos de pantalla, I/O nativo fuera del hilo JS (módulos con deps inyectadas + `seed-expo.ts` solo-dispositivo), Zod en el borde (`VersionResponseSchema`, `SeedManifestSchema`), sin secretos en el bundle (solo base pública build-time). Aplicada en §4.
- **`test-driven-development-tdd`:** ciclo RED → GREEN por unidad verificable en el historial (p. ej. `ac19335` test W1-01 en rojo antes de `f6c6445` GREEN; F0-03 antes de F0-04); cada comparador, mapeo, manifiesto, descarga y swap tiene su test failing-previo y su gate en verde. Aplicada en §§1–6.
