/**
 * Migración de audioUrl: signed URLs (expiran en 1h) → URLs públicas permanentes.
 *
 * Contexto: upload-audio guardaba `createSignedUrl(..., 3600)` en BD. Esas URLs
 * mueren a la hora. Desde el fix, upload-audio guarda URLs públicas. Este script
 * convierte las filas legacy:
 *   1. Extrae el objectPath de cada audioUrl (firmada o pública vieja).
 *   2. Reconstruye la URL pública permanente.
 *   3. Actualiza la fila. Si no se puede extraer el path, la reporta y la salta.
 *
 * Uso:
 *   bun run prisma/migrate-audio-urls.ts          # dry-run (solo reporta)
 *   bun run prisma/migrate-audio-urls.ts --apply  # aplica cambios
 *
 * Requiere en .env: DATABASE_URL, SUPABASE_URL (+ DIRECT_URL si aplica).
 * Requisito previo: bucket `audios` en PÚBLICO (Storage → audios → Edit → Public).
 */
import { PrismaClient } from "@prisma/client"

const APPLY = process.argv.includes("--apply")

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL
  if (!url) throw new Error("Falta SUPABASE_URL en .env")
  return url.replace(/\/$/, "")
}

function bucket(): string {
  return process.env.SUPABASE_BUCKET_AUDIOS || "audios"
}

const SIGNED_PREFIX = "/storage/v1/object/sign/"
const PUBLIC_PREFIX = "/storage/v1/object/public/"

function toObjectPath(audioUrl: string): string | null {
  if (!audioUrl || typeof audioUrl !== "string") return null
  if (!audioUrl.includes("://")) {
    const cleaned = audioUrl.split("?")[0].replace(/^\/+/, "")
    if (cleaned && !cleaned.includes("..") && /^[\w.\-/]+$/.test(cleaned)) return cleaned
    return null
  }
  try {
    const { pathname } = new URL(audioUrl)
    for (const prefix of [SIGNED_PREFIX, PUBLIC_PREFIX]) {
      const idx = pathname.indexOf(prefix)
      if (idx !== -1) {
        const after = pathname.substring(idx + prefix.length)
        if (!after.startsWith(`${bucket()}/`)) return null
        const objectPath = after.substring(bucket().length + 1)
        if (!objectPath || objectPath.includes("..")) return null
        return objectPath
      }
    }
    return null
  } catch {
    return null
  }
}

function toPublicUrl(objectPath: string): string {
  return `${getSupabaseUrl()}/storage/v1/object/public/${bucket()}/${objectPath}`
}

const db = new PrismaClient()

async function main() {
  const words = await db.dictionaryWord.findMany({
    where: { audioUrl: { not: null } },
    select: { id: true, spanish: true, audioUrl: true },
  })

  console.log(`Fichas con audio: ${words.length} ${APPLY ? "(APLICANDO)" : "(dry-run)"}`)

  let migrated = 0
  let alreadyPublic = 0
  let skipped = 0

  for (const word of words) {
    const current = word.audioUrl as string
    if (current.includes("/object/public/")) {
      alreadyPublic++
      continue
    }
    const objectPath = toObjectPath(current)
    if (!objectPath) {
      skipped++
      console.log(`  SKIP ${word.id} (${word.spanish}): URL no reconocible: ${current.slice(0, 80)}`)
      continue
    }
    const publicUrl = toPublicUrl(objectPath)
    if (APPLY) {
      await db.dictionaryWord.update({
        where: { id: word.id },
        data: { audioUrl: publicUrl },
      })
    }
    migrated++
    console.log(`  OK ${word.id} (${word.spanish}): ${objectPath}`)
  }

  console.log(`\nResumen: ${migrated} por migrar, ${alreadyPublic} ya públicas, ${skipped} omitidas`)
  if (!APPLY) console.log("Dry-run: nada modificado. Re-ejecuta con --apply para aplicar.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
