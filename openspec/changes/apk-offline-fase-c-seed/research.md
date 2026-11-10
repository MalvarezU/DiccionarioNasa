# Fase C (seed APK offline) — Investigación `sdd-research`

> Alcance: solo lectura. Docs oficiales + código instalado en los repos. Ningún archivo fue modificado salvo este reporte.
> Nota de ruta: el brief indica `Diccionario-semilla/…`, ruta que no existe en este entorno. El backend real es
> `/home/mario/Escritorio/Proyectos/pyajte/Diccionario nasa ` (rama `feat/fase-c-seed` como fuente web) y la app es
> `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app`. El reporte se crea en `openspec/changes/apk-offline-fase-c-seed/research.md`
> dentro del backend (árbol de trabajo en `main`; la rama `feat/fase-c-seed` se consultó vía `git show`/`git grep`).

## Versiones exactas verificadas

| Componente | Versión | Fuente |
|---|---|---|
| `expo` (app) | 52.0.49 | `piiyaak-app/package-lock.json` |
| `react-native` (app) | 0.76.9 | `piiyaak-app/package.json` |
| `expo-file-system` (app) | 18.1.11 | `package-lock.json` + `node_modules/expo-file-system/package.json` |
| `expo-sqlite` (app) | 15.2.14 | `package-lock.json` |
| `expo-asset` (app) | **58.0.18** (era SDK 58; la app es SDK 52) | `node_modules/expo-asset/package.json`, fechas npm: `11.0.5` = 2025-03-20, `58.0.18` = 2026-10-21 |
| `expo-av` (app) | 16.0.8 | `package-lock.json` |
| `expo-updates` (app) | ausente | `package-lock.json` / `node_modules` |
| `react-native-zip-archive` (app) | ausente | `package-lock.json` |
| `unzipit` (app) | ausente; último 2.1.1, sin dependencias | npm registry |
| `react-native-zip-archive` último | 9.5.3 (2026-10-08), peers `react>=18`, `react-native>=0.70` | npm registry |
| New Architecture (app) | desactivada (sin `newArchEnabled` en `app.json`) → old arch | `piiyaak-app/app.json` |
| Builds EAS | `development`/`preview` = apk, `production` = aab | `piiyaak-app/eas.json` |
| `MediaAsset.size` (web, rama `feat/fase-c-seed`) | `Int` requerido (bytes); `sha256 String?` nullable; `mimeType String` requerido | `prisma/schema.prisma:137-156` |
| `getContentVersion()` (web) | `Promise<number>` (INT autoincremental, transacción atómica) | `src/lib/content-version.ts` |
| `VersionResponseSchema` (app) | `z.object({ contentVersion: z.string().min(1), … })` | `piiyaak-app/src/db/version-gate.ts:14-18` |
| Workflows backend | solo `ci-unit.yml` y `ci-e2e.yml` (`workflow_dispatch`, node 24); `CI_SYNC_SECRET` sin uso en workflows | `.github/workflows/`, `.env.example:41-47` (rama `feat/fase-c-seed`) |
| `GET /api/sync/full` (rama `feat/fase-c-seed`) | `{ contentVersion: number, words[], courses[] (crudo), media[]: {objectKey, url, sha256, size, mimeType} }`, auth solo `X-CI-Secret`, `Cache-Control: private, no-store`, filtra `sha256 NOT NULL` | `src/app/api/sync/full/route.ts`, `src/lib/sync/full-bundle.ts` |
| Naming local de medios (app) | `<sha256>.<ext>` (`fileNameFor`, minúsculas) | `piiyaak-app/src/db/media-cache.ts:117-123` |
| Seam de seed existente (app) | `Asset.fromModule(require("../assets/piiyaak.db"))` → copia a `SQLite/piiyaak.db` → `openDatabaseSync` | `piiyaak-app/src/db-context.tsx:63-84` |
| `export-db.py` (app) | genera `assets/piiyaak.db` con `words` + `kv` (+ `piiyaak:contentVersion` solo si `/api/sync/version` devuelve **string**) | `piiyaak-app/scripts/export-db.py:100-132` |

---

## P1 — Unzip en dev-builds EAS

| Opción | ¿Compatible SDK 52 + old arch (RN 0.76.9)? | ¿Config plugin / prebuild? | ¿Progreso / streaming? | Notas |
|---|---|---|---|---|
| **`react-native-zip-archive` v9** | Sí. Tabla oficial: RN 0.70–0.81 → "Latest v9 (old architecture works; rebuild native)". v9 intenta `TurboModuleRegistry` y cae a `NativeModules` en old arch | Sí: plugin `"react-native-zip-archive"` en `app.json` (+ `app.plugin.js` incluido en el paquete). Solo dev builds / EAS, no Expo Go | Progreso sí (`subscribe`, 0…1 ponderado por bytes en unzip); `AbortSignal`/`cancel()`; `entries` selectivo; `listContents`; `getUncompressedSize`; protección ZipSlip (`ERR_UNSAFE_PATH`). Sin streaming desde red: primero descargar, luego descomprimir. `unzipAssets()` para zips empaquetados | Requiere iOS 15.5+. Playground oficial probado en SDK 55, no en 52 → validar en build EAS real |
| **`unzipit` 2.1.1 (JS puro)** | Sí (JS puro, funciona hasta en Expo Go) | No | Sin progreso nativo; inflate en hilo JS, pesado en memoria; escritura archivo por archivo manual vía `expo-file-system` | Descripción npm: "random access unzip". Sin protección ZipSlip integrada. Viable solo para zips pequeños |
| **Otras (jszip, etc.)** | Sí (JS puro) | No | Peor: todo en memoria | Descartadas; la propia comparativa del README de zip-archive las marca "Memory-heavy" |
| **`expo-file-system`** | N/A | N/A | N/A | Sin unzip nativo en 18.1.11 ni en el código de la app (verificado). En SDK 52 el API clásico (`downloadAsync`, `createDownloadResumable`) es el API por defecto y no está marcado obsoleto en `build/*.d.ts`; en SDK 53+ el nuevo API `File`/`Directory` es el defecto y el clásico vive en `expo-file-system/legacy` (docs oficiales v58) |

**Recomendación:** `react-native-zip-archive` v9. Justificación: (1) es la única opción con I/O nativo y progreso real, necesario para un paquete de medios de decenas de MB en gama media/baja; (2) el proyecto ya distribuye solo vía dev builds EAS (Expo Go no es un escenario), por lo que el costo "no funciona en Expo Go" no aplica; (3) el plugin se aplica solo con el flujo CNG/prebuild que EAS ya usa; (4) `entries` selectivo y `getUncompressedSize` habilitan a futuro extracción parcial/on-demand sin cambiar de librería. `unzipit` queda como plan B documentado si el módulo nativo bloquea algún build.

## P2 — Formato del paquete

| Opción | Integridad verificable | Dónde vive `contentVersion` | Costo de primer arranque |
|---|---|---|---|
| **(a) `.db` pregenerada extendida** (extender `export-db.py`: `words` + `courses`/`modules`/`lessons` + `media_manifest` + `kv`) | Media: sí, por `sha256` contra `media[]` del bundle. La `.db` en sí: solo vía `PRAGMA integrity_check` post-copia (sin hash de filas) | En `kv` (`piiyaak:contentVersion`), como hoy | Mínimo: copiar archivo + abrir. Cero INSERTs en el hilo JS |
| **(b) JSON + inserción local** | Igual que (a) para medios; el JSON puede llevar hash por tabla pero hay que implementarlo | En el propio JSON y luego en `kv` tras insertar | Alto: miles de `upsertWords`/cursos en el hilo JS en primer arranque; compite con el presupuesto de búsqueda (<150 ms, Fase C app) |
| **(c) zip (`piiyaak.db` + `media/<sha256>.<ext>` + `manifest.json`)** | Sí, completo: `manifest.json` con `contentVersion`, `dbSha256` y lista `[{objectKey, sha256, size}]`; verificación archivo por archivo antes del swap | Dos niveles: `manifest.json` en la raíz del zip (legible **antes** de descomprimir → permite SKIP) + `kv` dentro de la `.db` | Medio: descarga con progreso + `unzip` nativo + verificación + copia. Sin INSERTs |

**Recomendación:** (c). Justificación: (1) reutiliza tres seams existentes sin inventar protocolo: `export-db.py` (generación), `Asset.fromModule` + copia en `db-context.tsx:63-84` (instalación), y `fileNameFor` `<sha256>.<ext>` en minúsculas (`media-cache.ts:119-120`), idéntico al layout `media/<sha256>.<ext>` propuesto; (2) `manifest.json` con `contentVersion` habilita la decisión SKIP **antes** de descargar/descomprimir, que (a) sola no permite; (3) el filtrado `sha256 NOT NULL` de `/api/sync/full` garantiza que todo lo empaquetado es verificable, y `missingMediaKeys()` ya implementa el chequeo de coherencia en el backend; (4) evita el costo JS de (b). Extensión de `export-db.py` requerida en cualquier caso: hoy solo exporta `words`+`kv` (sin `courses`/`modules`/`lessons`/`media_manifest`, y `schemaVersion "4"`), por lo que (a) y (c) comparten ese trabajo.

## P3 — Versionado de seed: tipo canónico y política de movimientos

**Tipo canónico.** Hecho verificado: la web emite **número** (`getContentVersion(): Promise<number>`; `/api/sync/version`, `/api/sync/seed` y `/api/sync/full` serializan el entero) mientras la app **exige string** (`VersionResponseSchema` con `z.string().min(1)`; `version-gate.ts:14-18`) y compara con igualdad exacta de strings (`sync.ts:165`). Consecuencia observable hoy: `getRemoteVersion()` lanza `ZodError` contra el backend real, y `export-db.py:110` (`isinstance(…, str)`) deja el bundle **sin** `piiyaak:contentVersion` ("el bundle quedará sin gate inicial"). No es un detalle de Fase C: es un bug de contrato que Fase C debe cerrar.

**Recomendación:** tipo canónico **`string`** (entero serializado como string) en el cable y en `kv`. Justificación: (1) `kv.value` es `TEXT` — el string evita conversiones en cada lectura/escritura del gate; (2) `export-db.py` ya espera string y funciona sin cambios; (3) robusto frente a límites de precisión JSON si el contador crece. Implementación en dos lados: web serializa `String(version)` en `/api/sync/version`, `/api/sync/seed` y `/api/sync/full`; app acepta tolerante (`z.union([z.string(), z.number()]).transform(String)`) para no romper contra backends viejos. Lectura tolerante + escritura canónica en string.

**Política de movimientos** (con `local` = `kv`, `remote` = `/api/sync/version`):

| Caso | Acción |
|---|---|
| `remote == local` | SKIP total (sin red adicional). Es el caso que hace rentable a Fase C |
| `remote > local` (o `local` ausente) | Re-seed atómico: descargar → verificar contra `manifest.json` → swap (copiar `.db` + medios) → adoptar versión con escritura conjunta (`setLocalVersion`). Preservar siempre `course_progress`, `outbox`, `history` (tablas de usuario: copiar vía `ATTACH` o excluir del reemplazo) |
| `remote < local` | **No re-seed.** Mantener local, registrar y alertar. Un downgrade destruiría progreso/outbox más nuevos que el seed remoto. Causas típicas: fila `ContentVersion(id=1)` recreada (vuelve a 1), restore de BD, reloj. Requiere intervención (bump manual o reseteo dirigido), nunca automática |

## P4 — Transporte al dispositivo

| Opción | Qué versiona el workflow | Efecto en el binario / latencia de publicación |
|---|---|---|
| **(a) Recurso EAS (`assetBundlePatterns` + plugin `expo-asset` / `SQLiteProvider.assetSource`)** | Nada de contenido: el `contentVersion` queda congelado en el build. Cada cambio de contenido exige rebuild + nueva versión + revisión de tienda (`production` = aab) | Docs oficiales: los assets locales "are automatically bundled into your app binary at build time". `assetBundlePatterns` actual `["**/*"]` ya incluiría el `.db`. El plugin `expo-asset` soporta explícitamente `.db`. Costo: binario crece con db+medios; contenido nace desactualizado (el gate forzaría sync completa en primer arranque, anulando el beneficio) |
| **(b) Descarga en primer arranque desde R2 pública con `createDownloadResumable`** | El workflow versiona el artefacto: objeto inmutable `seed/<contentVersion>/piiyaak-seed.zip` + `manifest.json`; la app decide con `GET /api/sync/version` (público, `s-maxage=60`) vs `kv` local | Binario lean (el `.db` de texto puede seguir empaquetado como apertura instantánea; los medios, pesados y no acotados, nunca). Publicación de contenido sin rebuild ni tienda. Requiere red en primer arranque (aceptable: luego offline total). `createDownloadResumable` con callback de progreso existe en 18.1.11 (`FileSystem.d.ts:166`, `FileSystem.types.d.ts:129`); `media-fs.ts` ya envuelve `downloadAsync`. R2 expone URLs públicas permanentes (`publicUrl`, `r2.ts:60-64`) |
| **(c) `eas-update` (OTA)** | El workflow versionaría rama/canal por `contentVersion` | `expo-updates` **ausente** en la app: hay que añadir dependencia + disciplina de runtime versions. Las updates entregan JS+assets (una `.db` como asset es técnicamente posible), pero aplican al reiniciar (no garantizado antes del primer render), los assets grandes son frágiles en redes pobres, y se añade complejidad operativa (canales, rollback) sin resolver la verificación de integridad mejor que (b) |

**Recomendación:** (b) como transporte primario, combinado con (a) mínimo ya existente: mantener `assets/piiyaak.db` de solo-texto (palabras+cursos, liviano) empaquetado para apertura instantánea, y descargar el zip de medios versionado en primer arranque con progreso reanudable. El workflow versiona exclusivamente el par inmutable (`manifest.json` + zip por `contentVersion`); la app nunca descarga sin haber comparado versiones (SKIP barato).

## P5 — Presupuesto (consulta del workflow y umbrales)

**Consulta.** `MediaAsset.size` es `Int` requerido en bytes (nunca NULL por esquema); `sha256` es nullable hasta completar el backfill; no hay columna de clase (derivar audio/imagen por prefijo de `mimeType` o de `objectKey`: `audios/…` vs `images/…`). El workflow debe correr, como paso de medición (no solo gate), sobre el conjunto efectivamente empaquetado:

```sql
SELECT COUNT(*) AS files,
       COALESCE(SUM(size),0) AS bytes_total,
       SUM(CASE WHEN mimeType LIKE 'audio/%' THEN size ELSE 0 END) AS bytes_audio,
       SUM(CASE WHEN mimeType LIKE 'image/%' THEN size ELSE 0 END) AS bytes_image,
       SUM(CASE WHEN sha256 IS NULL THEN 1 ELSE 0 END) AS files_without_hash
FROM MediaAsset
WHERE objectKey IN (/* claves derivadas por collectMediaRefs + refsToKeys */);
```

Reglas: `files_without_hash` debe ser 0 en el conjunto empaquetado (el bundle ya filtra `sha256 NOT NULL`; `missingMediaKeys()` es el chequeo de coherencia y debe fallar el workflow si es no vacío). Sin acceso a la BD en esta investigación no hay cifras reales: la primera corrida del workflow debe **publicar las cifras como log** antes de convertir umbrales en gates duros.

**Umbrales propuestos** (pendientes de la primera medición; no son datos):

| Presupuesto | Propuesta | Qué queda fuera → on-demand |
|---|---|---|
| Zip total descargable | ≤ 100 MB | Lo que exceda: no entra al seed, se sirve por `media-cache` bajo red como hoy |
| `.db` sola (texto) | ≤ 10 MB | Si supera: paginar `examples`/`culturalContext` o diferir `content` de lecciones al seed de medios |
| Archivo individual | ≤ 5 MB | Audios largos → recompresión en backend o streaming on-demand, nunca seed |
| Cobertura del seed | 100 % de medios con `sha256` no nulo | Toda referencia sin hash queda fuera del zip (ya es el comportamiento de `/api/sync/full`) y se resuelve on-demand |
| Excluidos por diseño | — | `video`/`youtubeId` (no son R2), `text.html` con `<img>` (el sanitizador no lo permite), covers legacy `/api/media/<id>` (no derivan a objeto R2, `full-bundle.ts` E8) |

---

## Supuestos restantes (explícitos)

1. La rama `feat/fase-c-seed` del backend es la base de la propuesta (el árbol de trabajo está en `main`, sin `openspec/`).
2. El `contentVersion` remoto se lee de `/api/sync/version` (público, barato) y no de `/api/sync/full` (con secreto CI, pesado, `private, no-store`).
3. El objeto zip vivirá en el mismo bucket R2 público que los medios (lectura pública, escritura solo desde el workflow con credenciales).
4. El `assets/piiyaak.db` actual del repo es un artefacto generado de ejemplo, regenerado por el workflow, no versionado a mano.
5. `npx expo install react-native-zip-archive` resolverá v9 compatible con RN 0.76.9 (peers `>=0.70`); pendiente de compilación EAS real en SDK 52.

## Riesgos abiertos (sin conclusión concluyente)

- **R1. Skew `expo-asset` 58.0.18 sobre SDK 52.** Instalado 6 generaciones por encima del SDK (`11.0.5` era la contemporánea, 2025-03-20). El seam `Asset.fromModule(...).downloadAsync()` se usa hoy (`db-context.tsx`), pero `npx expo install --check/--fix` probablemente lo marque. Verificar antes de Fase C; si rompe, fijar `expo-asset@11.0.5`.
- **R2. `getRemoteVersion` contra backend real.** Con la web emitiendo número y la app exigiendo string, el gate falla hoy por `ZodError` (falla a rama "offline con datos" o lanza). Confirmar en `preview` y cerrar el tipo canónico (P3) como prerrequisito, no como parte opcional.
- **R3. Sin cifras reales de volumen.** Sin `DATABASE_URL` en este entorno no se corrió el `COUNT/SUM`; los umbrales de P5 son propuestas, no gates. La primera ejecución del workflow debe medir antes de endurecer.
- **R4. Backfill `sha256` incompleto.** `sha256` nullable hasta completar backfill (`prisma/backfill-media-sha256.ts` + `getObjectBytes` en la rama). Todo objeto sin hash queda fuera del seed y degrada a on-demand; el workflow debe reportar el conteo.
- **R5. Módulo nativo nuevo.** `react-native-zip-archive` añade código nativo: más tiempo de build EAS, validación en `development`/`preview` (apk) antes de tocar `production`, y prueba en dispositivo real de gama media (unzip de ~100 MB).
- **R6. Secreto CI en el workflow.** `CI_SYNC_SECRET` viajará como `X-CI-Secret` en el job de seed: nunca en query string (ya es la norma de `ci-auth.ts`), enmascarar en logs, y el artefacto publicado debe ser público sin rastros del secreto.
- **R7. ctx7 no disponible.** El CLI falló por red (`fetch failed`) y el índice MCP no cubre `react-native-zip-archive`; las citas vienen de npm registry, README oficial del repo y `docs.expo.dev` (las URLs versionadas `v52.0.0` redirigen a `latest`/v58: se citan junto al código instalado, que prevalece para SDK 52).
