/**
 * Claves y URLs del storage de media (Cloudflare R2).
 *
 * Funciones puras: sin SDK ni variables en el import (R2_PUBLIC_BASE_URL se
 * lee de forma perezosa). El SDK vive en `@/lib/r2`.
 *
 * Layout de claves en el bucket:
 * - Imágenes: `images/<uuid>.<ext>`
 * - Audios:   `audios/<wordId>/<timestamp>-<archivo>` (wordId = "temp" si la
 *   ficha aún no existe; no hay paso de "move", igual que en Supabase)
 */

const SAFE_KEY = /^[\w.\-/]+$/

function isSafeKey(key: string): boolean {
  return key.length > 0 && !key.includes("..") && SAFE_KEY.test(key)
}

/** Base pública configurada (dominio custom o r2.dev), o null si falta. */
export function r2PublicBase(): string | null {
  const base = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "")
  return base || null
}

function sanitizeFileName(fileName: string): string {
  return (
    fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.{2,}/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 100) || "audio"
  )
}

/** Clave completa para un audio nuevo: `audios/<wordId>/<ts>-<archivo>`. */
export function audioKey(wordId: string, fileName: string): string {
  return `audios/${wordId}/${Date.now()}-${sanitizeFileName(fileName)}`
}

/**
 * Resuelve cualquier referencia de audio guardada a su clave R2:
 * - URL pública R2 actual → se recorta la base
 * - URL legacy de Supabase (`.../storage/v1/object/.../audios/<path>`)
 *   → `audios/<path>` (la migración F4 reubica con ese prefijo)
 * - clave relativa (`audios/...` o `temp/...`) → se normaliza con prefijo
 *
 * Devuelve null si no se puede determinar una clave segura.
 */
export function audioRefToKey(ref: string | null | undefined): string | null {
  if (!ref || typeof ref !== "string") return null

  const base = r2PublicBase()
  if (base && ref.startsWith(`${base}/`)) {
    const key = ref.slice(base.length + 1).split("?")[0]!
    return isSafeKey(key) ? key : null
  }

  if (!ref.includes("://") && !ref.startsWith("/audio/")) {
    const cleaned = ref.split("?")[0]!.replace(/^\/+/, "")
    if (!isSafeKey(cleaned)) return null
    return cleaned.startsWith("audios/") ? cleaned : `audios/${cleaned}`
  }

  try {
    const url = new URL(ref)
    for (const prefix of ["/storage/v1/object/sign/", "/storage/v1/object/public/"]) {
      const idx = url.pathname.indexOf(prefix)
      if (idx !== -1) {
        const after = url.pathname.substring(idx + prefix.length)
        const match = after.match(/^audios\/(.+)$/)
        if (!match?.[1] || match[1].includes("..")) return null
        return `audios/${match[1]}`
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Portadas de curso: solo URLs de media propia.
 * Acepta el redirect legacy `/api/media/<id>` (302 a R2) y la base pública R2.
 */
export function isAllowedCoverImageUrl(url: string): boolean {
  if (typeof url !== "string" || /\s/.test(url)) return false
  if (url.startsWith("/api/media/")) return true
  const base = r2PublicBase()
  return !!base && url.startsWith(`${base}/`)
}
