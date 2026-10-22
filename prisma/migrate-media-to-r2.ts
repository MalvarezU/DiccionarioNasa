/**
 * Migración de media a Cloudflare R2 (Fase 4). Idempotente y seguro por defecto.
 *
 * - Imágenes legacy: filas MediaAsset con columna `data` (solo pre-migración
 *   de schema) → `images/<id>.<ext>` en R2 + `objectKey` en BD.
 * - Audios legacy: `DictionaryWord.audioUrl` formato Supabase →
 *   descarga y subida a R2 (`audios/<path>`) + reescritura a URL pública.
 * - Claves deterministas + HEAD previo: re-ejecutable sin duplicar.
 *
 * Uso:
 *   bun run prisma/migrate-media-to-r2.ts                  # dry-run (default)
 *   bun run prisma/migrate-media-to-r2.ts --apply --confirm <bucket>
 *
 * `--apply` exige que <bucket> coincida con R2_BUCKET (fusible anti-prod) y
 * un backup previo de la BD (mysqldump). Sin --apply no toca nada.
 */
import { PrismaClient } from "@prisma/client"
import { putObject, objectExists, publicUrl, r2Bucket } from "../src/lib/r2"
import { r2PublicBase } from "../src/lib/media/storage"
import { imageKeyFor, classifyAudioUrl, type MigrationSummary } from "../src/lib/media/migration"

const db = new PrismaClient()

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const confirmIdx = args.indexOf("--confirm")
const CONFIRM_BUCKET = confirmIdx === -1 ? null : args[confirmIdx + 1] ?? null

type LegacyImageRow = {
  id: string
  filename: string
  mimeType: string
  size: number
  data: Buffer
  objectKey: string | null
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column
  )) as Array<{ n: bigint }>
  return Number(rows[0]?.n ?? 0) > 0
}

async function legacyImages(): Promise<LegacyImageRow[] | null> {
  if (!(await columnExists("MediaAsset", "data"))) return null
  const hasKey = await columnExists("MediaAsset", "objectKey")
  return (await db.$queryRawUnsafe(
    `SELECT id, filename, mimeType, size, data${
      hasKey ? ", objectKey" : ", CAST(NULL AS CHAR) AS objectKey"
    } FROM MediaAsset WHERE data IS NOT NULL`
  )) as LegacyImageRow[]
}

async function fetchBuffer(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`GET ${res.status} ${url.slice(0, 80)}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length === 0) throw new Error(`vacío: ${url.slice(0, 80)}`)
  return { bytes, contentType: res.headers.get("content-type") ?? "application/octet-stream" }
}

async function main() {
  const bucket = r2Bucket()
  const base = r2PublicBase()
  console.log(`Bucket R2: ${bucket} | base pública: ${base ?? "(sin configurar)"}\n`)

  if (APPLY) {
    if (CONFIRM_BUCKET !== bucket) {
      console.error(
        `REHUSADO: --apply exige --confirm <bucket> igual a R2_BUCKET (${bucket}).`
      )
      process.exit(2)
    }
    console.log("⚠️  MODO APPLY: verifica tener backup (mysqldump) antes de continuar.\n")
  } else {
    console.log("DRY-RUN: no se toca R2 ni la BD. Usa --apply --confirm <bucket> para ejecutar.\n")
  }

  const summary: MigrationSummary = {
    imagesToMigrate: 0,
    imagesSkipped: 0,
    audiosToMigrate: 0,
    audiosAlreadyR2: 0,
    audiosUnresolvable: 0,
  }
  const errors: string[] = []
  let actions = 0

  // ---- 1. Imágenes legacy ----
  const rows = await legacyImages()
  if (rows === null) {
    console.log("Imágenes: columna `data` ya eliminada — nada que migrar.")
  } else {
    for (const row of rows) {
      const key = imageKeyFor(row.id, row.mimeType)
      if (!key) {
        errors.push(`imagen ${row.id}: MIME no mapeable (${row.mimeType})`)
        summary.imagesSkipped++
        continue
      }
      if (row.objectKey) {
        console.log(`  = imagen ${row.id}: ya tiene objectKey, se omite`)
        summary.imagesSkipped++
        continue
      }
      summary.imagesToMigrate++
      if (!APPLY) {
        console.log(`  · imagen ${row.id} (${row.filename}, ${row.size}B) → ${key}`)
        continue
      }
      try {
        if (!(await objectExists(key))) {
          await putObject(key, row.data, row.mimeType)
        }
        await db.$queryRawUnsafe(`UPDATE MediaAsset SET objectKey = ? WHERE id = ?`, key, row.id)
        actions++
        console.log(`  ✓ imagen ${row.id} → ${key}`)
      } catch (err) {
        errors.push(`imagen ${row.id}: ${(err as Error).message}`)
      }
    }
  }

  // ---- 2. Audios legacy ----
  const words = (await db.$queryRawUnsafe(
    `SELECT id, spanish, audioUrl FROM DictionaryWord WHERE audioUrl IS NOT NULL`
  )) as Array<{ id: string; spanish: string; audioUrl: string }>

  for (const w of words) {
    const cls = classifyAudioUrl(w.audioUrl, base)
    if (cls.kind === "r2-ok") {
      summary.audiosAlreadyR2++
      if (APPLY) {
        try {
          if (!(await objectExists(cls.key))) {
            errors.push(`audio ${w.id} (${w.spanish}): la BD apunta a R2 pero falta ${cls.key}`)
          }
        } catch (err) {
          errors.push(`audio ${w.id}: HEAD falló (${(err as Error).message})`)
        }
      }
      continue
    }
    if (cls.kind === "supabase-migrate") {
      summary.audiosToMigrate++
      if (!APPLY) {
        console.log(`  · audio ${w.id} (${w.spanish}) → ${cls.key}`)
        continue
      }
      try {
        const { bytes, contentType } = await fetchBuffer(w.audioUrl)
        await putObject(cls.key, bytes, contentType)
        await db.$queryRawUnsafe(`UPDATE DictionaryWord SET audioUrl = ? WHERE id = ?`, publicUrl(cls.key), w.id)
        actions++
        console.log(`  ✓ audio ${w.id} (${w.spanish}) → ${cls.key}`)
      } catch (err) {
        errors.push(`audio ${w.id} (${w.spanish}): ${(err as Error).message}`)
      }
      continue
    }
    summary.audiosUnresolvable++
    console.log(`  ? audio ${w.id} (${w.spanish}): referencia no migrable (${w.audioUrl.slice(0, 60)})`)
  }

  console.log(`\nResumen: imágenes a migrar=${summary.imagesToMigrate} omitidas=${summary.imagesSkipped} | audios a migrar=${summary.audiosToMigrate} ya-en-R2=${summary.audiosAlreadyR2} no-resolubles=${summary.audiosUnresolvable} | acciones=${actions} errores=${errors.length}`)
  for (const e of errors) console.error("  ✗", e)

  await db.$disconnect()
  process.exit(errors.length > 0 ? 1 : 0)
}

await main()
