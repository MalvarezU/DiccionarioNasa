# Proposal: apk-offline-fase-c-seed — Robot de semilla + APK auto-actualizable

- **Change ID:** `apk-offline-fase-c-seed`
- **Branch web:** `feat/fase-c-seed` (este repo; aquí vive el change: `openspec/changes/apk-offline-fase-c-seed/`)
- **Rama app:** `feat/mobile-fase-c` en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app` (trabajo móvil referenciado por paths absolutos; este proposal lo especifica, no lo implementa)
- **Repo scope:** web + especificación del trabajo móvil. Sin cambios en Admin UI. Sin cambios en workflows existentes (solo se agrega `seed-content.yml`).
- **Estado:** propuesta (sin spec/tasks todavía — siguiente paso recomendado: `spec`)
- **artifact_store.mode:** hybrid (file-based en `openspec/`; engram pendiente)
- **delivery_strategy:** auto-chain (F0 → W1 → W2 → W3; cada work unit con gate TDD antes de avanzar)
- **chain_strategy:** stacked-to-main
- **Research vinculante:** `openspec/changes/apk-offline-fase-c-seed/research.md` (zip con react-native-zip-archive v9 + config plugin + EAS dev build; formato zip con db extendida + `media/<sha256>.<ext>` + `manifest.json`; transporte por descarga R2 en primer arranque con `createDownloadResumable`; presupuesto vía COUNT/SUM)

## 1. Problema

La APK actual no es instalable offline de forma completa y el contenido nace desactualizado:

1. **Semilla incompleta.** `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/scripts/export-db.py` genera `assets/piiyaak.db` solo con `words` + `kv` (sin `courses`/`modules`/`lessons`/`media_manifest`; `SCHEMA` en `export-db.py:22-44` frente a `SCHEMA` real en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db/sqlite-store.ts:14-90`). Los cursos y los medios dependen de red post-instalación.
2. **Sin pipeline reproducible.** No existe workflow que convierta el backend en un artefacto versionado. Cada actualización de contenido exige rebuild + nueva versión + revisión de tienda (`production = aab` en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/eas.json`), aunque el contenido podría viajar como dato.
3. **Gate de versión roto.** La web emite `contentVersion` como número (`getContentVersion(): Promise<number>`, `src/lib/content-version.ts:41-44`; serializado tal cual en `/api/sync/version`, `/api/sync/seed:74`, `/api/sync:162` y `/api/sync/full`) mientras la app exige string (`VersionResponseSchema` con `z.string().min(1)` en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db/version-gate.ts:14-18`) y compara con igualdad exacta (`sync.ts:165`). Resultado observable: `getRemoteVersion` lanza `ZodError` contra el backend real y `export-db.py:110` deja el bundle sin `piiyaak:contentVersion`. No es un detalle de Fase C: es un bug de contrato que Fase C debe cerrar (fork F0, §5).
4. **Primer arranque sin protocolo.** El seam existe (`Asset.fromModule` + copia en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db-context.tsx:63-84`) pero no hay pantalla de progreso, ni descarga versionada, ni verificación, ni swap que preserve datos de usuario (`course_progress`, `outbox`, `history`). El texto "Preparando diccionario offline..." en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/app/index.tsx:83` es estático y no informa estado.

Sin este change, cada release de contenido paga costo de tienda y el primer arranque nunca es completamente offline.

## 2. Objetivo medible

Al cerrar el change:

- **Instalación nueva 100 % offline al primer arranque.** Un dispositivo con la APK instalada y red disponible solo durante el flujo guiado termina en estado totalmente offline: diccionario + cursos + medios servidos desde disco, cero dependencia de red posterior. Si la descarga de medios falla o se pospone, el diccionario de texto (db empaquetada) queda utilizable de inmediato; los medios degradan a on-demand por `media-cache` como hoy.
- **Semilla reproducible desde CI.** El workflow `seed-content.yml` convierte `GET /api/sync/full` en un artefacto inmutable `seed/<contentVersion>/` en R2 (zip + `manifest.json` + puntero `latest.json`), con métricas publicadas (conteos y bytes por clase). Dos corridas sobre el mismo `contentVersion` producen el mismo artefacto.
- **Usuarios existentes se actualizan por sync sin reinstalar.** Con `remote == local` no hay red adicional (SKIP); con `remote > local` el seed remoto se aplica por swap atómico preservando `course_progress`, `outbox` e `history`; con `remote < local` no hay re-seed (decisión cerrada, §4).

## 3. Alcance / No-alcance

### En alcance

- **F0 (fork, §5):** tipo canónico de `contentVersion` en el cable y en `kv`, con coerción tolerante en el borde de lectura de la app.
- **W1 — Generador bundle (web):** extender `export-db.py` (o sucesor documentado) para emitir db extendida (`words` + `courses`/`modules`/`lessons` + `media_manifest` + `kv`) + `media/<sha256>.<ext>` + `manifest.json`; consumir `GET /api/sync/full` con `X-CI-Secret`.
- **W2 — Workflow `seed-content.yml` (web, `.github/workflows/`):** `workflow_dispatch` + `schedule` básico; baja el bundle, mide COUNT/SUM desde el bundle, publica `seed/<contentVersion>/` en R2 y actualiza el puntero de última versión. Incluye `DEPLOY.md` del change (secrets, rotación, verificación manual).
- **W3 — App (`feat/mobile-fase-c`):** pantalla "Preparando contenido" con progreso; descarga reanudable (`createDownloadResumable`); descompresión con `react-native-zip-archive` v9 + config plugin; verificación contra `manifest.json`; swap con preservación de tablas de usuario; comparación solo-adelante en el gate.
- Tests TDD por cada work unit + regresión de Fases A/B.

### Fuera de alcance (explícito)

- **Fase D (automatización):** queda fuera. El workflow es manual (`workflow_dispatch`) + programado básico (`schedule`); no incluye botón admin, ni SKIP-BUILD por diff, ni publicación automática por push. Esos pertenecen a Fase D.
- **Sin upgrade de SDK:** Expo 52 / RN 0.76.9 / old arch se mantienen. La validación de `react-native-zip-archive` v9 se hace en build EAS real, sin migrar arquitectura.
- **Sin Expo Go:** el flujo seed requiere módulo nativo; Expo Go no es escenario soportado (ya es el caso hoy: el proyecto distribuye solo vía dev builds EAS).
- **Sin `eas-update`:** descartado como transporte (decisión cerrada, §4).
- **Sin cambios en Admin UI, PWA, paginación de `/api/sync/full`, limpieza física de R2 huérfano ni purga de ARCHIVED.** Sin migración `sha256` a NOT NULL (sigue filtro + test de coherencia, decisión R3(b) de Fase B).

## 4. Decisiones cerradas (no reabrir)

Resueltas por el research vinculante. Se documentan con tradeoffs para trazabilidad; la spec no debe replantearlas.

### D1 — Paquete zip (no archivos sueltos)

**Decisión:** `piiyaak-seed.zip` con `piiyaak.db` + `media/<sha256>.<ext>` + `manifest.json`.

| Alternativa | Por qué se descarta |
|---|---|
| `.db` pregenerada suelta | No permite decisión SKIP antes de descargar; media sin empaquetar verificable |
| JSON + inserción local | Miles de `upsert` en el hilo JS en primer arranque; compite con el presupuesto de búsqueda (< 150 ms) |
| Zip (elegido) | `manifest.json` legible antes de descomprimir (SKIP barato); verificación archivo por archivo; cero INSERTs; reutiliza `export-db.py`, `Asset.fromModule` y `fileNameFor` |

### D2 — Descarga R2 en primer arranque (no bundle EAS, no eas-update)

**Decisión:** el workflow versiona el artefacto inmutable; la app descarga con `createDownloadResumable` y conserva la db de texto empaquetada para apertura instantánea.

| Alternativa | Por qué se descarta |
|---|---|
| Recurso EAS (`assetBundlePatterns`) | `contentVersion` congelado en el build; cada cambio de contenido exige rebuild + tienda; el gate forzaría sync completa en primer arranque |
| `eas-update` (OTA) | `expo-updates` ausente (nueva dependencia + runtime versions); aplica al reiniciar, no antes del primer render; assets grandes frágiles en redes pobres |

### D3 — Sin downgrade automático

**Decisión:** con `remote < local`, no hay re-seed. Se mantiene local, se registra y se alerta. Causas típicas: fila `ContentVersion(id=1)` recreada, restore de BD, reloj. Requiere intervención (bump manual o reseteo dirigido), nunca automática. Un downgrade destruiría `course_progress`/`outbox` más nuevos que el seed remoto.

## 5. Fork nuevo F0 — Tipo canónico de `contentVersion`

**Contexto:** la web emite número; la app exige string y falla con `ZodError` contra el backend real; `export-db.py:110` deja el bundle sin gate inicial. Fase C lo cierra como prerrequisito (bloquea W1/W2/W3: sin contrato de versión no hay SKIP, ni `manifest.json` comparable, ni seed reproducible).

- **(a) String canónico con coerción en el borde (recomendada).** La web serializa `String(version)` en toda ruta que emita `contentVersion` (`/api/sync/version`, `/api/sync/seed`, `/api/sync`, `/api/sync/full`). La app acepta tolerante (`z.union([z.string().min(1), z.number().int().nonnegative()]).transform(String)`) y escribe canónico string en `kv`. `export-db.py:110` funciona sin cambios.
- **(b) Number en ambos.** Requiere tocar validación de la app + tests + migración de `kv` existentes (string → number) en dispositivos ya instalados; `kv.value` es `TEXT`, por lo que cada lectura del gate pagaría conversión. Mayor blast radius sin beneficio funcional.

**Recomendación: opción (a).** Justificación: (1) `kv.value` es `TEXT`: el string evita conversiones en cada lectura/escritura del gate; (2) `export-db.py` ya espera string y opera sin modificación; (3) robusto frente a límites de precisión JSON si el contador crece; (4) la lectura tolerante no rompe contra backends viejos que aún emitan número. Costo de (a): cambio de forma en 4 rutas web (aditivo en la práctica: ningún consumidor válido parseaba el entero como número para aritmética; la app lo rechazaba). La comparación solo-adelante (W3) se define sobre el entero parseado con validación `/^\d+$/`; igualdad para SKIP sobre el string canónico.

## 6. Diseño a alto nivel

### W1 — Generador bundle (web, `scripts/`)

- Entrada: `GET /api/sync/full` con `X-CI-Secret` (bundle único, decisión F2 de Fase B; `Cache-Control: private, no-store`; media ya filtrada por `sha256 NOT NULL`).
- Extender `export-db.py` (Python stdlib, sin dependencias nuevas): además de `words` + `kv`, poblar `courses` / `modules` / `lessons` (mapeo 1:1 del `courses[]` del bundle, que ya excluye `stats`, `deletedAt` y no-PUBLISHED) y `media_manifest` (una fila por `media[]`: `objectKey`, `sha256`, `size`, `mimeType`; `local_uri` = `media/<sha256>.<ext>` en minúsculas, idéntico a `fileNameFor`).
- Descargar cada objeto R2 (`getObjectBytes` ya existe en `src/lib/r2.ts:105-118`) a `media/<sha256>.<ext>`; derivar extensión por `mimeType` (audio → ext de audio, imagen → ext de imagen; tabla cerrada en spec).
- Emitir `manifest.json` en la raíz:
  ```json
  {
    "contentVersion": "<string canónico>",
    "createdAt": "<ISO>",
    "dbSha256": "<hex>",
    "dbBytes": 12345,
    "files": [{ "objectKey": "...", "sha256": "<hex>", "size": 123, "mimeType": "audio/mpeg" }],
    "counts": { "words": 0, "courses": 0, "lessons": 0 },
    "bytesTotal": 0, "bytesAudio": 0, "bytesImage": 0
  }
  ```
- `contentVersion` del bundle: comparar contra el del `manifest`; ante divergencia intra-bundle (bump concurrente durante la descarga), abortar y fallar cerrado (foto no atómica → reintentar, nunca publicar mezcla).
- Patrones (`api-design-patterns`): error mínimo y todo-o-nada (heredado de `/api/sync/full`: cualquier fallo → sin artefacto parcial); idempotencia por `contentVersion` (misma versión, mismo artefacto).
- TDD: tests del generador sobre fixture de bundle (mapeo courses/lessons, `media_manifest` con naming `<sha256>.<ext>`, `manifest.json` con conteos/bytes, aborto ante divergencia de versión, extensión por `mimeType` desconocido → fallo explícito, nunca adivinanza silenciosa).

### W2 — Workflow `seed-content.yml` (web, `.github/workflows/`)

- Disparadores: `workflow_dispatch` (con input opcional `content_version` para re-publicar) + `schedule` básico (p. ej. semanal; la cadencia exacta se fija en spec). Sin botón admin, sin auto-publicación por push (Fase D).
- Precedentes: `ci-unit.yml` (mariadb service, node 24, `npm ci` → `prisma generate` → `migrate deploy` → `typecheck` → `test:run`) y `ci-e2e.yml` (`workflow_dispatch` como precedente; node 24).
- Pasos: checkout → setup node 24 + Python stdlib → `GET /api/sync/full` contra producción con `X-CI-Secret` (secret de Actions; nunca en query string, enmascarado en logs; misma norma que `ci-auth.ts`) → correr generador W1 → **medir desde el bundle** (COUNT/SUM derivados del JSON: `files`, `bytes_total`, `bytes_audio`/`bytes_image` por prefijo de `mimeType`; más `words`/`courses`/`lessons`): publicar las cifras como log y artifact antes de convertir umbrales en gates duros (research P5: sin cifras reales no hay gates; la primera corrida mide, no bloquea salvo incoherencia) → coherencia: fallar si `missingMediaKeys()` es no vacío sobre el conjunto empaquetado (reutilizar `src/lib/sync/full-bundle.ts:116-124`) → publicar en R2: `seed/<contentVersion>/piiyaak-seed.zip` + `seed/<contentVersion>/manifest.json` (inmutables; `putObject` + verificación `objectExists`) → actualizar `seed/latest.json` (`{ contentVersion, manifestUrl, zipUrl, bytesTotal, files, updatedAt }`; único objeto mutable).
- Presupuesto inicial (propuestas, no gates hasta la primera medición): zip ≤ 100 MB; db sola ≤ 10 MB; archivo individual ≤ 5 MB; cobertura 100 % de medios con `sha256` (ya garantizado por el filtro del bundle; el resto degrada a on-demand).
- TDD/entorno: el workflow se prueba sin dispositivo (dry-run contra staging o con bundle fixture + `R2_ENDPOINT_OVERRIDE` hacia MinIO local); la publicación real a R2 solo ocurre con `workflow_dispatch`/`schedule` en `main`.
- `DEPLOY.md` del change: secrets requeridos (`CI_SYNC_SECRET`, credenciales R2 de escritura, `R2_PUBLIC_BASE_URL`), rotación, verificación manual (`curl` del `manifest.json` público + `jq` de conteos; `GET /api/sync/version` vs `latest.json`).

### W3 — App (`feat/mobile-fase-c`, paths absolutos)

- **Dependencia:** `npx expo install react-native-zip-archive` (v9; peers `react>=18`, `react-native>=0.70` cubren RN 0.76.9) + plugin en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/app.json` (`plugins: ["expo-router", "react-native-zip-archive"]`). Solo dev builds EAS; validación en `development`/`preview` (apk) antes de tocar `production`. `unzipit` JS puro queda como plan B documentado (research P1).
- **Pantalla "Preparando contenido":** reemplaza el texto estático de `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/app/index.tsx:83` por estados explícitos — comprobando versión → descargando (%, bytes, reanudable) → verificando → activando → listo; error con reintento + "continuar solo con texto". La db de texto empaquetada sigue abriendo instantáneo (`db-context.tsx:63-84` intacto como fallback); el seed de medios no bloquea el diccionario.
- **Descarga:** `FileSystem.createDownloadResumable` (API clásico, por defecto en SDK 52) contra `seed/<remote>/manifest.json` primero (ligero; decide SKIP tardío y obtiene hashes), luego el zip con callback de progreso. Base URL: `EXPO_PUBLIC_SEED_BASE_URL` (build-time; mismo valor que `R2_PUBLIC_BASE_URL`) + layout well-known `seed/<contentVersion>/`. Semántica de reanudación entre reinicios: reutilizar parcial si el servidor soporta rango; si no, descarga fresca (detalle a fijar en spec con test de interrupción simulada).
- **Descompresión:** `unzip` nativo con `subscribe` de progreso (ponderado por bytes); `getUncompressedSize` como guarda de espacio libre previa; protección ZipSlip integrada del módulo.
- **Verificación (suficiente, sin sobrediseño):** HTTPS (integridad de transporte) + CRC32 del zip (integridad de descompresión) + `dbSha256` del `manifest.json` sobre la db extraída + conteo/tamaños de `files[]`. Re-chequeo sha256 por archivo: best-effort (la frontera actual de lectura de bytes en `media-cache.ts:125-142` no lo soporta sin costo de memoria; spec decide si se extiende o se declara fuera).
- **Swap atómico con preservación:** `PRAGMA integrity_check` sobre la db nueva → `ATTACH` de la db viva → copiar `course_progress`, `outbox`, `history` a la db nueva → cerrar conexiones → reemplazo del fichero `SQLite/piiyaak.db` → reapertura (`openDatabaseSync`) → adopción conjunta vía `setLocalVersion` (escritura conjunta existente en `version-gate.ts:48-53`). Medios: mover `media/<sha256>.<ext>` al directorio de `media-cache` (mismo naming; el cache los reconoce sin re-descarga).
- **Comparación solo-adelante** (extiende el gate de `sync.ts:149-177`): `remote == local` → SKIP total; `remote > local` (o `local` ausente) → flujo seed; `remote < local` → no-op + registro/alerta. Orden numérico sobre el canónico validado `/^\d+$/`; igualdad sobre el string.
- Patrones (`react-native-patterns`): seam existente antes que invención (Asset/copy/open, `fileNameFor`, gate); estados de carga/error/vacío explícitos; I/O nativo y progreso fuera del hilo JS; sin secretos en el bundle (solo URLs públicas + base pública build-time).
- TDD: tests en la suite de la app (`vitest`, `test:run` en `piiyaak-app/package.json`) para comparación tri-estado con fixture string/number (F0), parseo de `manifest.json` inválido, swap con preservación sobre db en memoria (ATTACH + copia de las 3 tablas de usuario), y no-op ante `remote < local`. Lo nativo (unzip real, descarga reanudable, EAS build) se declara no cubierto por tests unitarios (§9).

## 7. Riesgos

Hereda R1–R7 del research (se resumen con mitigación en este change) y agrega R8–R12.

| # | Riesgo | Impacto | Mitigación en este change |
|---|---|---|---|
| R1 | Skew `expo-asset` 58.0.18 sobre SDK 52 | El seam de copia rompe tras `expo install --check` | Verificar antes de W3; si rompe, fijar `expo-asset@11.0.5`; el seam no se toca salvo necesidad |
| R2 | `getRemoteVersion` falla hoy por `ZodError` | Gate inoperante contra backend real | F0 como prerrequisito (no opcional); confirmar en `preview` antes de W3 |
| R3 | Sin cifras reales de volumen | Umbrales P5 sin fundamento | Primera corrida de W2 publica métricas como log; gates duros solo después |
| R4 | Backfill `sha256` incompleto | Medios fuera del seed, degradación silenciosa | Bundle filtra + `missingMediaKeys()` falla el workflow; reporte de conteo |
| R5 | Módulo nativo nuevo (build EAS, ~100 MB en gama media/baja) | Builds más largos; OOM o ANR en unzip | Validar en `development`/`preview` apk antes de `production`; `getUncompressedSize` como guarda; prueba en dispositivo real de gama media |
| R6 | `CI_SYNC_SECRET` en el workflow | Filtración de la semilla completa | Solo encabezado, 401 genérico, enmascarado en logs, artefacto público sin rastros |
| R7 | `ctx7` no disponible para `react-native-zip-archive` | API inferida de README/npm, no de docs versionadas | Citar código instalado + README del paquete; validar en build EAS real |
| R8 | Bump concurrente durante la generación (foto no atómica) | Artefacto mezcla dos versiones | W1 compara `contentVersion` pre/post; divergencia → aborto + reintento, nunca publicación parcial |
| R9 | Descarga interrumpida / almacenamiento lleno a mitad de seed | Zip corrupto adoptado o app bloqueada en "Preparando" | Descarga a temporal + verificación previa al swap; guarda de espacio libre; error con reintento + fallback texto |
| R10 | Divergencia de esquema entre db generada y `SCHEMA` de la app | Swap adopta db ilegible | W1 y W3 comparten versión de esquema (`schemaVersion` en `kv` + chequeo en apertura; bump documentado si el generador agrega tablas); test de apertura del artefacto generado |
| R11 | `seed/latest.json` vs `/api/sync/version` divergen | La app descarga versión distinta a la anunciada | Fuente de verdad para SKIP: `/api/sync/version`; `latest.json` es conveniencia/observabilidad; W3 construye la URL desde `<remote>` + base, no desde `latest` |
| R12 | `remote < local` por fila `ContentVersion` recreada en prod | Falso "atraso" permanente; seed nunca se aplica | No-op + alerta visible en logs del workflow y en la app; runbook en `DEPLOY.md` (bump manual o reseteo dirigido) |

## 8. Plan por fases (F0 → W3, ~20-24h, TDD obligatorio)

> Cada work unit sigue RED → GREEN → refactor. Sin test failing previo no hay código de producción. Orden secuencial: F0 desbloquea el contrato; W1 produce el artefacto; W2 lo publica; W3 lo consume. W3 vive en `feat/mobile-fase-c`; F0/W1/W2 en `feat/fase-c-seed`.

1. **F0 — Tipo canónico string (~2h).** Tests RED (web: las 4 rutas emiten string; app: schema tolerante number→string + `export-db.py` sin cambios) → serializar `String(version)` en web + `z.union(...).transform(String)` en `/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db/version-gate.ts` → refactor. Gate: `export-db.py` produce `piiyaak:contentVersion` contra backend real; `getRemoteVersion` deja de lanzar `ZodError`.
2. **W1 — Generador bundle (~6h, bloque web mayor).** Suborden: (i) extensión de esquema + `media_manifest` + tests de mapeo; (ii) descarga R2 + layout `media/` + tests de naming/extensiones; (iii) `manifest.json` + aborto ante divergencia + tests de foto atómica. Gate: artefacto local completo verificable (`PRAGMA integrity_check` + conteos del bundle).
3. **W2 — Workflow + publicación (~5h).** `seed-content.yml` (`workflow_dispatch` + `schedule`) → medición bundle-derivada + `missingMediaKeys()` como gate → publicación `seed/<N>/` + `latest.json` → `DEPLOY.md`. Gate: dry-run con fixture/MinIO en verde; primera corrida real publica métricas como log.
4. **W3 — App seed auto-actualizable (~10h, bloque móvil mayor).** Suborden: (i) comparación tri-estado + tests; (ii) pantalla "Preparando contenido" + descarga reanudable + progreso; (iii) integración `react-native-zip-archive` v9 + plugin + build EAS `development` (apk); (iv) verificación + swap con preservación + tests en memoria; (v) validación en `preview` + dispositivo real de gama media. Gate: instalación nueva llega a offline total por el flujo guiado; existente con `remote == local` no toca red; `remote < local` no-op.

**Esfuerzo total estimado: ~20-24h** (F0 ~2h + W1 ~6h + W2 ~5h + W3 ~10h). Presupuesto de líneas: web ~400-600 + tests; app ~500-800 + tests; más iteraciones de build EAS (no estimables en líneas). Supone R2 y EAS accesibles; sin cambios de SDK ni Expo Go.

## 9. Criterios de aceptación (verificables)

Verificable sin dispositivo real (CI / máquina de desarrollo):

- [ ] Las 4 rutas web emiten `contentVersion` como string; la app parsea string y number (coerción) y escribe canónico string; `export-db.py` deja de advertir "bundle sin gate inicial".
- [ ] Generador: sobre bundle fixture, `manifest.json` con conteos/bytes exactos, `media/` con naming `<sha256>.<ext>` en minúsculas, `media_manifest` poblada, `PRAGMA integrity_check` en verde, y aborto ante `contentVersion` divergente.
- [ ] Workflow: dry-run con fixture (o `R2_ENDPOINT_OVERRIDE` a MinIO) publica layout `seed/<N>/` + `latest.json` y reporta COUNT/SUM; `missingMediaKeys()` no vacío falla el job.
- [ ] App (tests `vitest` en memoria/simulada): tri-estado (`==` SKIP sin red, `>` seed, `<` no-op); swap preserva `course_progress`/`outbox`/`history` y adopta versión conjunta; `manifest.json` corrupto o `dbSha256` distinto → sin swap.
- [ ] `tsc --noEmit` (ambos repos) → 0 errores; `lint` en archivos tocados → sin pelea de estilo; Delivery Gate antislop (cuando aplique a UI) → PASS.
- [ ] `DEPLOY.md` del change: secrets, rotación, verificación manual reproducible, runbook R12.

Requiere build EAS + dispositivo físico (se declara explícito, no simulable en CI):

- [ ] Unzip v9 sobre old arch SDK 52 en `development`/`preview` (apk); `subscribe` reporta progreso real.
- [ ] Zip de tamaño real (~medición W2) en gama media/baja sin ANR/OOM; guarda de espacio libre efectiva.
- [ ] Interrupción de descarga (modo avión a mitad) → reanudación o reinicio limpio con progreso correcto.
- [ ] Instalación nueva completa el flujo "Preparando contenido" y queda 100 % offline (modo avión post-seed: diccionario + cursos + medios sin red).

## 10. Trazabilidad de skills

- `api-design-patterns` (inyectada, `/home/mario/.agents/skills/api-design-patterns/SKILL.md`): contrato aditivo y error mínimo en F0 (serialización string, 401 genérico heredado), caché HTTP nativa como precedente de SKIP (`/api/sync/version` con `s-maxage=60`), todo-o-nada e idempotencia por versión en W1/W2, 401/500 con formato existente. Aplicada en §5, §6 (W1/W2) y R6/R8.
- `react-native-patterns` (inyectada, `/home/mario/.pi/agent/skills/react-native-patterns/SKILL.md`): reutilizar seams antes de inventar (Asset/copy/open, `fileNameFor`, gate con Zod en el borde), estados explícitos de pantalla, I/O nativo fuera del hilo JS, listas/etiquetas accesibles en la pantalla de progreso, sin secretos en el bundle. Aplicada en §6 (W3) y R5/R9.
- `test-driven-development-tdd` (inyectada, `/home/mario/.pi/agent/skills/test-driven-development-tdd/SKILL.md`): ciclo RED → GREEN → refactor por cada comparador, mapeo, extractor, manifiesto y swap; verificación RED antes de implementar; criterio "sin test failing previo no hay código". Aplicada en §8 y §9.
- Evidencia base: research vinculante del change (P1–P5, R1–R7) + lectura directa en esta sesión de `src/lib/r2.ts`, `src/lib/content-version.ts`, `src/lib/sync/full-bundle.ts`, `/api/sync/full|version|seed`, `package.json` (convención `bun run`, node 24), workflows `ci-unit`/`ci-e2e`, y en la app (`/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/...`): `db-context.tsx:61-109`, `db/sync.ts:149-177`, `db/version-gate.ts`, `db/media-cache.ts:117-142`, `db/sqlite-store.ts:14-90`, `app/index.tsx:83`, `scripts/export-db.py`, `eas.json`, `app.json`.

## 11. Pendientes para `spec.md` (next_recommended)

1. Generar `openspec/changes/apk-offline-fase-c-seed/spec.md`: firma del generador (mapeo campo por campo bundle→sqlite, tabla de extensiones por `mimeType`, formato exacto de `manifest.json`), del workflow (cron definitivo, permisos R2 mínimos, layout de objetos) y del flujo app (máquina de estados de la pantalla, semántica exacta de reanudación, pasos del swap con `ATTACH`).
2. Fijar en spec: re-chequeo sha256 por archivo en dispositivo (extender frontera de lectura vs. declarar fuera con justificación HTTPS+CRC+sizes), y bump de `schemaVersion` si el generador diverge del `SCHEMA` de la app.
3. Definir `tasks.md` con los tests TDD por work unit en el orden del plan §8 y registrar F0/D1/D2/D3 en engram cuando el runtime lo exponga.
