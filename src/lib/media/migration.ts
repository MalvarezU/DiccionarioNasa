/**
 * Clasificación para la migración a R2 (Fase 4). Funciones puras y testeadas;
 * el script `prisma/migrate-media-to-r2.ts` solo orquesta E/S.
 *
 * - Imágenes legacy: filas MediaAsset con `data` (solo existen pre-migración
 *   de schema; clave determinista `images/<id>.<ext>`).
 * - Audios legacy: `DictionaryWord.audioUrl` con formato Supabase
 *   (`.../storage/v1/object/.../audios/<path>`) → clave R2 `audios/<path>`.
 */

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
}

/** Clave R2 determinista para una imagen legacy. null si el MIME es desconocido. */
export function imageKeyFor(id: string, mimeType: string): string | null {
  const ext = IMAGE_EXT_BY_MIME[mimeType]
  if (!ext) return null
  if (!/^[\w-]+$/.test(id)) return null
  return `images/${id}.${ext}`
}

export type AudioClass =
  | { kind: "r2-ok"; key: string }
  | { kind: "supabase-migrate"; key: string }
  | { kind: "unresolvable"; key: null }

/**
 * Clasifica un audioUrl guardado:
 * - URL pública R2 actual → nada que hacer (verificar con HEAD en apply).
 * - URL legacy Supabase (pública o firmada, bucket audios) → migrar.
 * - Todo lo demás (claves relativas viejas, externos, vacío) → reportar.
 */
export function classifyAudioUrl(
  url: string | null | undefined,
  r2Base: string | null,
): AudioClass {
  if (!url || typeof url !== "string") return { kind: "unresolvable", key: null }

  const base = (r2Base ?? "").replace(/\/$/, "")
  if (base && url.startsWith(`${base}/`)) {
    const key = url.slice(base.length + 1).split("?")[0]!
    return key && !key.includes("..")
      ? { kind: "r2-ok", key }
      : { kind: "unresolvable", key: null }
  }

  try {
    const parsed = new URL(url)
    for (const prefix of ["/storage/v1/object/sign/", "/storage/v1/object/public/"]) {
      const idx = parsed.pathname.indexOf(prefix)
      if (idx !== -1) {
        const after = parsed.pathname.substring(idx + prefix.length)
        const match = after.match(/^audios\/(.+)$/)
        if (match?.[1] && !match[1].includes("..")) {
          return { kind: "supabase-migrate", key: `audios/${match[1]}` }
        }
        return { kind: "unresolvable", key: null }
      }
    }
    return { kind: "unresolvable", key: null }
  } catch {
    return { kind: "unresolvable", key: null }
  }
}

export type MigrationSummary = {
  imagesToMigrate: number
  imagesSkipped: number
  audiosToMigrate: number
  audiosAlreadyR2: number
  audiosUnresolvable: number
}
