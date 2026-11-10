/**
 * Generador del bundle seed offline — lógica pura y testeable (Fase C, W1).
 *
 * El envoltorio CLI vive en `scripts/build-content-bundle.ts`; este módulo
 * no toca red ni variables de entorno: la red (`fetchJson`, `getBytes`) y
 * la apertura de SQLite (`openDb`) se inyectan. Solo `node:fs`/`node:path`
 * se usan directo (funcionan igual en bun y en vitest).
 *
 * Fuentes reutilizadas sin duplicar (spec §2.1):
 * - `collectMediaRefs` / `refsToKeys` / `missingMediaKeys`
 *   (`../sync/full-bundle`), `parseLessonContent` (`../courses/blocks`).
 * - `getObjectBytes` se inyecta desde `@/lib/r2` en el CLI.
 *
 * DDL: copia verbatim del `SCHEMA` de la app
 * (`/home/mario/Escritorio/Proyectos/pyajte/piiyaak-app/src/db/sqlite-store.ts:13-89`).
 * Cualquier cambio de columnas en la app exige actualizar `SEED_SCHEMA_SQL`
 * y `APP_SCHEMA_TABLES` aquí; el test de paridad lo impone.
 *
 * Desviación documentada respecto del spec §2.4: el spec escribe
 * `kind: image` para `image/*`, pero el `CHECK` del SCHEMA de la app solo
 * admite `('audio','illustration')` y `MediaKind` es `"audio" |
 * "illustration"`. Mapear `image` rompería `PRAGMA integrity_check` y la
 * paridad; por eso `image/* → illustration`. La localización por stem
 * sha256 (§2.5, nota de compatibilidad) no depende de este valor.
 */

import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseLessonContent, type LessonBlock } from "../courses/blocks"
import { collectMediaRefs, missingMediaKeys, refsToKeys } from "../sync/full-bundle"
import { createStoredZip, readStoredZip } from "./seed-zip"

/** Códigos de salida del generador (spec §0): 0 ok · 2 divergencia de versión · 3 incoherencia de medios · 4 infraestructura. */
export type SeedExitCode = 2 | 3 | 4

export class SeedBuildError extends Error {
  readonly code: SeedExitCode
  constructor(code: SeedExitCode, message: string) {
    super(message)
    this.name = "SeedBuildError"
    this.code = code
  }
}

/** Adaptador mínimo de SQLite: el CLI inyecta `bun:sqlite`, los tests `node:sqlite`. */
export type SeedParam = string | number | bigint | null | Uint8Array

export interface SeedDb {
  exec(sql: string): void
  run(sql: string, params?: ReadonlyArray<SeedParam>): void
  all<T>(sql: string, params?: ReadonlyArray<SeedParam>): T[]
  close(): void
}

/** Versión de esquema del seed: idéntica a la app, sin bump (spec §2.3). */
export const SCHEMA_VERSION_SEED = "4"
/** Formato del manifiesto (spec §2.6). Un lector que vea otro major aborta. */
export const MANIFEST_FORMAT = "piiyaak-seed/1"
const VERSION_RE = /^\d+$/
const SHA256_RE = /^[0-9a-f]{64}$/

// ---------------------------------------------------------------------------
// Tabla cerrada de extensiones (spec §2.5). Nunca se deriva de la URL.
// ---------------------------------------------------------------------------

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
}

export function resolveExtension(mimeType: string, objectKey: string): string {
  const ext = EXTENSION_BY_MIME[String(mimeType).toLowerCase()]
  if (!ext) {
    throw new SeedBuildError(3, `[seed] mimeType desconocido para ${objectKey}: ${mimeType}`)
  }
  return ext
}

export function mediaKindFor(mimeType: string, objectKey: string): "audio" | "illustration" {
  const lower = String(mimeType).toLowerCase()
  if (lower.startsWith("audio/")) return "audio"
  if (lower.startsWith("image/")) return "illustration"
  throw new SeedBuildError(3, `[seed] mimeType sin kind conocido para ${objectKey}: ${mimeType}`)
}

/** Normalización idéntica a `export-db.py` (NFD, minúsculas, trim). */
export function normalizeSeedText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

// ---------------------------------------------------------------------------
// Tipos del bundle `/api/sync/full` (forma mínima que consume el generador).
// ---------------------------------------------------------------------------

export interface BundleWord {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  illustrationUrl: string | null
  culturalContext: string | null
  category: string | null
  examples: unknown
  status: string
  updatedAt: string
}

export interface BundleLesson {
  id: string
  moduleId: string
  title: string
  order: number
  lessonNumber: number | null
  content: unknown
  updatedAt: string
}

export interface BundleModule {
  id: string
  courseId: string
  title: string
  order: number
  lessons: BundleLesson[]
}

export interface BundleCourse {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  status: string
  sequential: boolean
  updatedAt: string
  modules: BundleModule[]
}

export interface BundleMediaItem {
  objectKey: string
  url: string
  sha256: string
  size: number
  mimeType: string
}

export interface FullBundle {
  contentVersion: string
  words: BundleWord[]
  courses: BundleCourse[]
  media: BundleMediaItem[]
}

export interface ManifestFile {
  objectKey: string
  sha256: string
  size: number
  mimeType: string
  localPath: string
}

export interface SeedCounts {
  words: number
  courses: number
  modules: number
  lessons: number
  mediaFiles: number
}

export interface SeedManifest {
  format: typeof MANIFEST_FORMAT
  contentVersion: string
  createdAt: string
  dbSha256: string
  dbBytes: number
  zipBytes: number
  files: ManifestFile[]
  counts: SeedCounts
  bytesTotal: number
  bytesAudio: number
  bytesImage: number
}

// ---------------------------------------------------------------------------
// DDL + paridad de esquema (spec §2.3).
// ---------------------------------------------------------------------------

/** Copia verbatim del SCHEMA de la app (tablas de contenido + usuario). */
export const SEED_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
  spanish TEXT NOT NULL,
  nasaYuwe TEXT NOT NULL,
  pronunciation TEXT,
  audioUrl TEXT,
  illustrationUrl TEXT,
  culturalContext TEXT,
  category TEXT,
  examples TEXT,
  status TEXT,
  updatedAt TEXT NOT NULL,
  spanish_norm TEXT NOT NULL DEFAULT '',
  nasaYuwe_norm TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_words_spanish ON words(spanish_norm);
CREATE INDEX IF NOT EXISTS idx_words_updated ON words(updatedAt);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'PUBLISHED',
  coverImage TEXT,
  sequential INTEGER NOT NULL DEFAULT 1,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  courseId TEXT NOT NULL,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  moduleId TEXT NOT NULL,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  lessonNumber TEXT,
  content TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (moduleId) REFERENCES modules(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS course_progress (
  lessonId TEXT PRIMARY KEY,
  completed INTEGER NOT NULL DEFAULT 0,
  score INTEGER,
  lastVisitedAt TEXT NOT NULL,
  completedAt TEXT
);
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  op TEXT NOT NULL,
  payload TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  syncedAt TEXT
);
CREATE TABLE IF NOT EXISTS history (
  wordId TEXT PRIMARY KEY,
  viewedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS media_manifest (
  word_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('audio','illustration')),
  url TEXT NOT NULL,
  sha256 TEXT,
  local_uri TEXT NOT NULL,
  PRIMARY KEY (word_id, kind)
);
`

interface ExpectedColumn {
  name: string
  type: string
  pk: number
}

/**
 * Columnas esperadas por tabla, transcriptas del SCHEMA de la app
 * (`sqlite-store.ts:13-89`). `pk` es el orden dentro de la clave (la PK
 * compuesta de `media_manifest` reporta `word_id → 1, kind → 2`).
 */
export const APP_SCHEMA_TABLES: Record<string, ExpectedColumn[]> = {
  words: [
    { name: "id", type: "TEXT", pk: 1 },
    { name: "spanish", type: "TEXT", pk: 0 },
    { name: "nasaYuwe", type: "TEXT", pk: 0 },
    { name: "pronunciation", type: "TEXT", pk: 0 },
    { name: "audioUrl", type: "TEXT", pk: 0 },
    { name: "illustrationUrl", type: "TEXT", pk: 0 },
    { name: "culturalContext", type: "TEXT", pk: 0 },
    { name: "category", type: "TEXT", pk: 0 },
    { name: "examples", type: "TEXT", pk: 0 },
    { name: "status", type: "TEXT", pk: 0 },
    { name: "updatedAt", type: "TEXT", pk: 0 },
    { name: "spanish_norm", type: "TEXT", pk: 0 },
    { name: "nasaYuwe_norm", type: "TEXT", pk: 0 },
  ],
  kv: [
    { name: "key", type: "TEXT", pk: 1 },
    { name: "value", type: "TEXT", pk: 0 },
  ],
  courses: [
    { name: "id", type: "TEXT", pk: 1 },
    { name: "title", type: "TEXT", pk: 0 },
    { name: "description", type: "TEXT", pk: 0 },
    { name: "status", type: "TEXT", pk: 0 },
    { name: "coverImage", type: "TEXT", pk: 0 },
    { name: "sequential", type: "INTEGER", pk: 0 },
    { name: "updatedAt", type: "TEXT", pk: 0 },
  ],
  modules: [
    { name: "id", type: "TEXT", pk: 1 },
    { name: "courseId", type: "TEXT", pk: 0 },
    { name: "title", type: "TEXT", pk: 0 },
    { name: "order", type: "INTEGER", pk: 0 },
  ],
  lessons: [
    { name: "id", type: "TEXT", pk: 1 },
    { name: "moduleId", type: "TEXT", pk: 0 },
    { name: "title", type: "TEXT", pk: 0 },
    { name: "order", type: "INTEGER", pk: 0 },
    { name: "lessonNumber", type: "TEXT", pk: 0 },
    { name: "content", type: "TEXT", pk: 0 },
  ],
  course_progress: [
    { name: "lessonId", type: "TEXT", pk: 1 },
    { name: "completed", type: "INTEGER", pk: 0 },
    { name: "score", type: "INTEGER", pk: 0 },
    { name: "lastVisitedAt", type: "TEXT", pk: 0 },
    { name: "completedAt", type: "TEXT", pk: 0 },
  ],
  outbox: [
    { name: "id", type: "INTEGER", pk: 1 },
    { name: "entity", type: "TEXT", pk: 0 },
    { name: "op", type: "TEXT", pk: 0 },
    { name: "payload", type: "TEXT", pk: 0 },
    { name: "createdAt", type: "TEXT", pk: 0 },
    { name: "syncedAt", type: "TEXT", pk: 0 },
  ],
  history: [
    { name: "wordId", type: "TEXT", pk: 1 },
    { name: "viewedAt", type: "TEXT", pk: 0 },
  ],
  media_manifest: [
    { name: "word_id", type: "TEXT", pk: 1 },
    { name: "kind", type: "TEXT", pk: 2 },
    { name: "url", type: "TEXT", pk: 0 },
    { name: "sha256", type: "TEXT", pk: 0 },
    { name: "local_uri", type: "TEXT", pk: 0 },
  ],
}

export function readTableInfo(
  db: SeedDb,
  table: string
): Array<{ name: string; type: string; pk: number }> {
  return db.all<{ name: string; type: string; pk: number }>(
    "SELECT name, type, pk FROM pragma_table_info(?) ORDER BY cid",
    [table]
  )
}

/** Falla si la db generada diverge del SCHEMA de la app (gate de paridad). */
export function assertSchemaParity(db: SeedDb): void {
  for (const [table, expected] of Object.entries(APP_SCHEMA_TABLES)) {
    const actual = readTableInfo(db, table)
    const same =
      actual.length === expected.length &&
      actual.every(
        (col, i) =>
          col.name === expected[i]!.name &&
          String(col.type).toUpperCase() === expected[i]!.type &&
          Number(col.pk) === expected[i]!.pk
      )
    if (!same) {
      throw new SeedBuildError(
        3,
        `[seed] paridad de esquema rota en ${table}: esperado ${JSON.stringify(expected)}, real ${JSON.stringify(actual)}`
      )
    }
  }
}

export function createSeedSchema(db: SeedDb): void {
  db.exec(SEED_SCHEMA_SQL)
}

// ---------------------------------------------------------------------------
// Mapeo bundle → sqlite (spec §2.4).
// ---------------------------------------------------------------------------

function serializeExamples(examples: unknown): string | null {
  if (examples == null) return null
  if (typeof examples === "string") return examples
  return JSON.stringify(examples)
}

function serializeContent(content: unknown): string {
  if (typeof content === "string") return content
  return JSON.stringify(content) ?? ""
}

export function mediaLocalPath(item: BundleMediaItem): string {
  const sha = String(item.sha256).toLowerCase()
  return `media/${sha}.${resolveExtension(item.mimeType, item.objectKey)}`
}

export function buildDatabase(db: SeedDb, bundle: FullBundle, contentVersion: string): SeedCounts {
  createSeedSchema(db)

  let modules = 0
  let lessons = 0
  for (const word of bundle.words) {
    db.run(
      `INSERT INTO words (id, spanish, nasaYuwe, pronunciation, audioUrl, illustrationUrl,
        culturalContext, category, examples, status, updatedAt, spanish_norm, nasaYuwe_norm)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        word.id,
        word.spanish,
        word.nasaYuwe,
        word.pronunciation,
        word.audioUrl,
        word.illustrationUrl,
        word.culturalContext,
        word.category,
        serializeExamples(word.examples),
        word.status,
        String(word.updatedAt),
        normalizeSeedText(word.spanish),
        normalizeSeedText(word.nasaYuwe),
      ]
    )
  }

  for (const course of bundle.courses) {
    db.run(
      `INSERT INTO courses (id, title, description, status, coverImage, sequential, updatedAt)
       VALUES (?,?,?,?,?,?,?)`,
      [
        course.id,
        course.title,
        course.description,
        course.status,
        course.coverImage,
        course.sequential ? 1 : 0,
        String(course.updatedAt),
      ]
    )
    for (const mod of course.modules) {
      modules += 1
      db.run(`INSERT INTO modules (id, courseId, title, "order") VALUES (?,?,?,?)`, [
        mod.id,
        mod.courseId,
        mod.title,
        mod.order,
      ])
      for (const lesson of mod.lessons) {
        lessons += 1
        db.run(
          `INSERT INTO lessons (id, moduleId, title, "order", lessonNumber, content)
           VALUES (?,?,?,?,?,?)`,
          [
            lesson.id,
            lesson.moduleId,
            lesson.title,
            lesson.order,
            lesson.lessonNumber == null ? null : String(lesson.lessonNumber),
            serializeContent(lesson.content),
          ]
        )
      }
    }
  }

  for (const item of bundle.media) {
    const sha = String(item.sha256).toLowerCase()
    db.run(
      `INSERT INTO media_manifest (word_id, kind, url, sha256, local_uri)
       VALUES (?,?,?,?,?)`,
      [`media:${item.objectKey}`, mediaKindFor(item.mimeType, item.objectKey), item.url, sha, mediaLocalPath(item)]
    )
  }

  db.run(`INSERT INTO kv (key, value) VALUES (?,?)`, ["piiyaak:contentVersion", contentVersion])
  db.run(`INSERT INTO kv (key, value) VALUES (?,?)`, ["schemaVersion", SCHEMA_VERSION_SEED])

  return {
    words: bundle.words.length,
    courses: bundle.courses.length,
    modules,
    lessons,
    mediaFiles: bundle.media.length,
  }
}

// ---------------------------------------------------------------------------
// Manifiesto (spec §2.6).
// ---------------------------------------------------------------------------

export function emitManifest(args: {
  contentVersion: string
  createdAt: string
  dbSha256: string
  dbBytes: number
  zipBytes: number
  files: ManifestFile[]
  counts: SeedCounts
}): SeedManifest {
  const files = [...args.files].sort((a, b) => (a.objectKey < b.objectKey ? -1 : 1))
  const bytesAudio = files
    .filter((f) => f.mimeType.toLowerCase().startsWith("audio/"))
    .reduce((acc, f) => acc + f.size, 0)
  const bytesImage = files
    .filter((f) => f.mimeType.toLowerCase().startsWith("image/"))
    .reduce((acc, f) => acc + f.size, 0)
  return {
    format: MANIFEST_FORMAT,
    contentVersion: args.contentVersion,
    createdAt: args.createdAt,
    dbSha256: args.dbSha256,
    dbBytes: args.dbBytes,
    zipBytes: args.zipBytes,
    files,
    counts: { ...args.counts },
    bytesTotal: args.dbBytes + files.reduce((acc, f) => acc + f.size, 0),
    bytesAudio,
    bytesImage,
  }
}

// ---------------------------------------------------------------------------
// Orquestación todo-o-nada (spec §2.2, pasos 1–7).
// ---------------------------------------------------------------------------

export interface BuildNetwork {
  fetchJson(url: string, headers?: Record<string, string>): Promise<{ status: number; body: unknown }>
  /** `null` = objeto ausente en R2 (NoSuchKey); otras fallas se propagan. */
  getBytes(objectKey: string): Promise<Buffer | null>
}

export interface RunBuildOptions {
  outDir: string
  apiBase: string
  ciSecret: string
  expectVersion?: string
  network: BuildNetwork
  openDb: (path: string) => SeedDb
  now?: () => Date
}

export interface BuildMetrics {
  words: number
  courses: number
  modules: number
  lessons: number
  mediaFiles: number
  bytes_total: number
  bytes_audio: number
  bytes_image: number
}

export interface BuildResult {
  manifest: SeedManifest
  metrics: BuildMetrics
  dbPath: string
  zipPath: string
}

function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex")
}

function removeOutDir(outDir: string): void {
  try {
    rmSync(outDir, { recursive: true, force: true })
  } catch {
    // Mejor esfuerzo: el gate es no dejar artefacto parcial visible.
  }
}

async function fetchVersionText(
  fetchJson: BuildNetwork["fetchJson"],
  apiBase: string
): Promise<string> {
  const base = apiBase.replace(/\/$/, "")
  let res
  try {
    res = await fetchJson(`${base}/api/sync/version`)
  } catch (err) {
    throw new SeedBuildError(4, `[seed] red al leer /api/sync/version: ${(err as Error).message}`)
  }
  if (res.status !== 200) throw new SeedBuildError(4, `[seed] /api/sync/version → ${res.status}`)
  const cv = (res.body as { contentVersion?: unknown } | null)?.contentVersion
  if (typeof cv !== "string" || !VERSION_RE.test(cv)) {
    throw new SeedBuildError(4, `[seed] contentVersion remota ilegible: ${JSON.stringify(cv)}`)
  }
  return cv
}

function lessonBlocksOf(bundle: FullBundle): LessonBlock[][] {
  const out: LessonBlock[][] = []
  for (const course of bundle.courses) {
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        let blocks: LessonBlock[] = []
        try {
          const parsed = parseLessonContent(lesson.content)
          blocks = parsed.ok ? parsed.content.blocks : []
        } catch {
          blocks = []
        }
        out.push(blocks)
      }
    }
  }
  return out
}

export async function runBuild(opts: RunBuildOptions): Promise<BuildResult> {
  const now = opts.now ?? (() => new Date())

  // Paso 1: foto inicial (pública, sin auth).
  const cvPre = await fetchVersionText(opts.network.fetchJson, opts.apiBase)

  // --expect-version: aborta antes de descargar (código 2).
  if (opts.expectVersion !== undefined && opts.expectVersion !== cvPre) {
    throw new SeedBuildError(
      2,
      `[seed] expect-version ${opts.expectVersion} difiere del remoto ${cvPre}; sin descarga`
    )
  }

  // Paso 2: bundle completo con X-CI-Secret (nunca en query ni en logs).
  const base = opts.apiBase.replace(/\/$/, "")
  let bundle: FullBundle
  try {
    const res = await opts.network.fetchJson(`${base}/api/sync/full`, {
      "X-CI-Secret": opts.ciSecret,
    })
    if (res.status !== 200) throw new SeedBuildError(4, `[seed] /api/sync/full → ${res.status}`)
    bundle = res.body as FullBundle
  } catch (err) {
    if (err instanceof SeedBuildError) throw err
    throw new SeedBuildError(4, `[seed] red al descargar /api/sync/full: ${(err as Error).message}`)
  }
  if (
    !bundle ||
    typeof bundle.contentVersion !== "string" ||
    !Array.isArray(bundle.words) ||
    !Array.isArray(bundle.courses) ||
    !Array.isArray(bundle.media)
  ) {
    throw new SeedBuildError(4, "[seed] bundle ilegible (forma inesperada)")
  }
  if (bundle.contentVersion !== cvPre) {
    throw new SeedBuildError(
      2,
      `[seed] bump durante el inicio: version ${cvPre} → bundle ${bundle.contentVersion}`
    )
  }

  // Paso 3: coherencia del manifiesto por referencias (nunca tabla completa).
  const keys = refsToKeys(
    collectMediaRefs({
      words: bundle.words.map((w) => ({ audioUrl: w.audioUrl, illustrationUrl: w.illustrationUrl })),
      courses: bundle.courses.map((c) => ({ coverImage: c.coverImage })),
      lessonBlocks: lessonBlocksOf(bundle),
    })
  )
  const missing = missingMediaKeys(
    keys,
    bundle.media.map((m) => ({ objectKey: m.objectKey, sha256: m.sha256 }))
  )
  if (missing.length > 0) {
    throw new SeedBuildError(3, `[seed] referencias sin fila con hash: ${missing.join(", ")}`)
  }

  // Validación previa de items de media (formato + duplicados → código 3).
  const seen = new Set<string>()
  const items = [...bundle.media].sort((a, b) => (a.objectKey < b.objectKey ? -1 : 1))
  for (const item of items) {
    if (seen.has(item.objectKey)) {
      throw new SeedBuildError(3, `[seed] objectKey duplicado en media[]: ${item.objectKey}`)
    }
    seen.add(item.objectKey)
    if (typeof item.size !== "number" || !Number.isInteger(item.size) || item.size < 0) {
      throw new SeedBuildError(3, `[seed] size inválido para ${item.objectKey}: ${JSON.stringify(item.size)}`)
    }
    const sha = String(item.sha256).toLowerCase()
    if (!SHA256_RE.test(sha)) {
      throw new SeedBuildError(3, `[seed] sha256 inválido para ${item.objectKey}`)
    }
    resolveExtension(item.mimeType, item.objectKey)
  }

  // Paso 4: construir la db extendida.
  mkdirSync(opts.outDir, { recursive: true })
  const dbPath = join(opts.outDir, "piiyaak.db")
  const db = opts.openDb(dbPath)
  let counts: SeedCounts
  try {
    counts = buildDatabase(db, bundle, cvPre)
  } finally {
    db.close()
  }

  // Paso 5: medios desde R2 con verificación de hash.
  const files: ManifestFile[] = []
  for (const item of items) {
    let bytes: Buffer | null
    try {
      bytes = await opts.network.getBytes(item.objectKey)
    } catch (err) {
      removeOutDir(opts.outDir)
      throw new SeedBuildError(4, `[seed] R2 al leer ${item.objectKey}: ${(err as Error).message}`)
    }
    if (bytes === null) {
      removeOutDir(opts.outDir)
      throw new SeedBuildError(3, `[seed] objeto ausente en R2: ${item.objectKey}`)
    }
    const sha = sha256Hex(bytes)
    if (sha !== String(item.sha256).toLowerCase()) {
      removeOutDir(opts.outDir)
      throw new SeedBuildError(3, `[seed] sha256 distinto para ${item.objectKey}`)
    }
    const localPath = mediaLocalPath(item)
    mkdirSync(join(opts.outDir, "media"), { recursive: true })
    writeFileSync(join(opts.outDir, localPath), bytes)
    files.push({
      objectKey: item.objectKey,
      sha256: sha,
      size: item.size,
      mimeType: item.mimeType,
      localPath,
    })
  }

  // Paso 6: foto atómica; divergencia → código 2 sin artefacto parcial.
  const cvPost = await fetchVersionText(opts.network.fetchJson, opts.apiBase)
  if (cvPost !== cvPre) {
    removeOutDir(opts.outDir)
    throw new SeedBuildError(2, `[seed] foto no atómica: ${cvPre} → ${cvPost}; <out> borrado`)
  }

  // Paso 7: manifiesto + zip determinista + auto-verificación.
  const dbBytesRaw = readFileSync(dbPath)
  const createdAt = now().toISOString()
  let manifest = emitManifest({
    contentVersion: cvPre,
    createdAt,
    dbSha256: sha256Hex(dbBytesRaw),
    dbBytes: dbBytesRaw.length,
    zipBytes: 0,
    files,
    counts,
  })
  const pack = (m: SeedManifest) =>
    createStoredZip([
      { name: "piiyaak.db", data: dbBytesRaw },
      { name: "manifest.json", data: Buffer.from(JSON.stringify(m, null, 2), "utf8") },
      ...files.map((f) => ({
        name: f.localPath,
        data: readFileSync(join(opts.outDir, f.localPath)),
      })),
    ])
  let zip = pack(manifest)
  for (let i = 0; i < 5 && zip.length !== manifest.zipBytes; i += 1) {
    manifest = { ...manifest, zipBytes: zip.length }
    zip = pack(manifest)
  }
  manifest = { ...manifest, zipBytes: zip.length }
  zip = pack(manifest)
  if (zip.length !== manifest.zipBytes) {
    removeOutDir(opts.outDir)
    throw new SeedBuildError(4, "[seed] zipBytes no converge; sin artefacto parcial")
  }

  autoVerify(zip, manifest, opts.openDb)

  writeFileSync(join(opts.outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  const zipPath = join(opts.outDir, "piiyaak-seed.zip")
  writeFileSync(zipPath, zip)

  const metrics: BuildMetrics = {
    words: counts.words,
    courses: counts.courses,
    modules: counts.modules,
    lessons: counts.lessons,
    mediaFiles: counts.mediaFiles,
    bytes_total: manifest.bytesTotal,
    bytes_audio: manifest.bytesAudio,
    bytes_image: manifest.bytesImage,
  }
  return { manifest, metrics, dbPath, zipPath }
}

/** Reabre el zip, verifica integridad, conteos y dbSha256 (spec §2.2 paso 7). */
function autoVerify(zip: Buffer, manifest: SeedManifest, openDb: (path: string) => SeedDb): void {
  const entries = readStoredZip(zip)
  const byName = new Map(entries.map((e) => [e.name, e.data]))
  const expected = new Set(["piiyaak.db", "manifest.json", ...manifest.files.map((f) => f.localPath)])
  if (byName.size !== expected.size || [...expected].some((n) => !byName.has(n))) {
    throw new SeedBuildError(4, "[seed] auto-verificación: layout del zip inesperado")
  }
  const embedded = JSON.parse(byName.get("manifest.json")!.toString("utf8"))
  if (JSON.stringify(embedded) !== JSON.stringify(manifest)) {
    throw new SeedBuildError(4, "[seed] auto-verificación: manifiesto del zip difiere")
  }
  const dbData = byName.get("piiyaak.db")!
  if (sha256Hex(dbData) !== manifest.dbSha256) {
    throw new SeedBuildError(4, "[seed] auto-verificación: dbSha256 del zip difiere")
  }
  const tmpPath = join(tmpdir(), `seed-verify-${process.pid}-${Date.now()}.db`)
  writeFileSync(tmpPath, dbData)
  const db = openDb(tmpPath)
  try {
    const integrity = db.all<{ integrity_check: string }>("SELECT integrity_check FROM pragma_integrity_check")
    if (integrity[0]?.integrity_check?.toLowerCase() !== "ok") {
      throw new SeedBuildError(4, "[seed] auto-verificación: integrity_check != ok")
    }
    const n = (table: string) =>
      (db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]?.n ?? -1)
    if (
      n("words") !== manifest.counts.words ||
      n("courses") !== manifest.counts.courses ||
      n("lessons") !== manifest.counts.lessons
    ) {
      throw new SeedBuildError(4, "[seed] auto-verificación: conteos del zip difieren")
    }
  } finally {
    db.close()
    try {
      rmSync(tmpPath, { force: true })
    } catch {
      // Mejor esfuerzo.
    }
  }
}
