import { createClient } from "@supabase/supabase-js"

export function getSupabaseServer() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Faltan variables de entorno SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export const AUDIO_BUCKET =
  process.env.SUPABASE_BUCKET_AUDIOS || "audios"

export function audioObjectPath(wordId: string, fileName: string): string {
  const safeName =
    fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.{2,}/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 100) || "audio"
  return `${wordId}/${Date.now()}-${safeName}`
}

/**
 * URL pública permanente para un objeto del bucket de audios.
 * Requiere que el bucket sea público. A diferencia de las signed URLs
 * (TTL 1h), esta URL no expira y es apta para guardar en BD y cachear offline.
 */
export function getPublicAudioUrl(objectPath: string): string {
  const url = process.env.SUPABASE_URL
  if (!url) {
    throw new Error("Falta variable de entorno SUPABASE_URL")
  }
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${AUDIO_BUCKET}/${objectPath}`
}

const SUPABASE_SIGNED_URL_PREFIX = "/storage/v1/object/sign/"
const SUPABASE_PUBLIC_URL_PREFIX = "/storage/v1/object/public/"

/**
 * Extrae el objectPath de una URL de audio de Supabase (pública o firmada)
 * o devuelve el propio valor si ya es un objectPath relativo.
 * Retorna null si no se puede determinar.
 */
export function audioUrlToObjectPath(audioUrl: string): string | null {
  if (!audioUrl || typeof audioUrl !== "string") return null

  // Ya es un objectPath relativo (sin protocolo ni prefijo /audio/ legacy)
  if (!audioUrl.includes("://") && !audioUrl.startsWith("/audio/")) {
    const cleaned = audioUrl.split("?")[0].replace(/^\/+/, "")
    // Debe tener forma wordId/archivo (al menos un segmento con extensión)
    if (cleaned && !cleaned.includes("..") && /^[\w.\-/]+$/.test(cleaned)) {
      return cleaned
    }
    return null
  }

  try {
    const url = new URL(audioUrl)
    const pathname = url.pathname

    for (const prefix of [SUPABASE_SIGNED_URL_PREFIX, SUPABASE_PUBLIC_URL_PREFIX]) {
      const idx = pathname.indexOf(prefix)
      if (idx !== -1) {
        const after = pathname.substring(idx + prefix.length)
        if (!after.startsWith(`${AUDIO_BUCKET}/`)) return null
        const objectPath = after.substring(AUDIO_BUCKET.length + 1)
        if (!objectPath || objectPath.includes("..")) return null
        return objectPath
      }
    }
    return null
  } catch {
    return null
  }
}

/** @deprecated Usar audioUrlToObjectPath (acepta URLs públicas y firmadas). */
export function signedUrlToObjectPath(signedUrl: string): string | null {
  return audioUrlToObjectPath(signedUrl)
}
