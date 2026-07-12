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

export const AUDIO_BUCKET = "audios"

export function audioObjectPath(wordId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${wordId}/${Date.now()}-${safeName}`
}

const SUPABASE_SIGNED_URL_PREFIX = "/storage/v1/object/sign/"

export function signedUrlToObjectPath(signedUrl: string): string | null {
  try {
    const url = new URL(signedUrl)
    const pathname = url.pathname

    const signIndex = pathname.indexOf(SUPABASE_SIGNED_URL_PREFIX)
    if (signIndex === -1) return null

    const afterSign = pathname.substring(signIndex + SUPABASE_SIGNED_URL_PREFIX.length)
    const bucketPath = afterSign.substring(AUDIO_BUCKET.length + 1)
    const questionIndex = bucketPath.indexOf("?")
    return questionIndex === -1 ? bucketPath : bucketPath.substring(0, questionIndex)
  } catch {
    return null
  }
}
