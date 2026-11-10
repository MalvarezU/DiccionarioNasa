import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { bumpContentVersion } from '@/lib/content-version'
import { audioRefToKey } from '@/lib/media/storage'
import { detectAudioMime } from '@/lib/media/audio'
import { sha256Hex } from '@/lib/media/hash'
import { getObjectBytes } from '@/lib/r2'

const DEFAULT_AUDIO_MAP: Record<string, string> = {
  'agua': '/audio/wala.wav',
  'persona': '/audio/nasa.wav',
  'sol': '/audio/mheka.wav',
  'luna': '/audio/ya.wav',
  'tierra': '/audio/cxaha.wav',
  'fuego': '/audio/te.wav',
  'lengua': '/audio/nasa-yuwe.wav',
  'corazón': '/audio/kasawa.wav',
  'montaña': '/audio/kxawa.wav',
}

/**
 * POST /api/dictionary/update-audio
 * One-time script to update audioUrl for demo words.
 * Requiere admin: antes era público y permitía sobrescribir audios.
 *
 * Acepta un cuerpo opcional `{ audioMap?: Record<spanish, audioUrl> }` para
 * pruebas y re-ejecuciones puntuales; sin cuerpo usa el mapa histórico.
 *
 * @deprecated Fase A T06: el path de escritura de medios con hash (sha256)
 * pertenece a T08 (Fase B lo elimina). Solo hace bump si tocó ≥1 fila.
 *
 * Fase A T08 (spec §4.3, HASH-01): por cada palabra tocada cuya `audioUrl`
 * resultante resuelva a un objeto R2 existente (`audioRefToKey`), crea o
 * actualiza la fila `MediaAsset` con `sha256` sobre los bytes descargados.
 * Las referencias locales `/audio/*.wav` sin objeto R2 se reportan en
 * `outOfInventory` sin crear fila y sin bloquear (E6). El registro de medios
 * es best-effort post-commit: nunca falla la petición ni genera bump extra
 * (el bump de la operación lógica ya aplicó en la transacción).
 */
export async function POST(request?: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  let audioMap: Record<string, string> = DEFAULT_AUDIO_MAP
  if (request) {
    const body = await request.json().catch(() => null) as { audioMap?: unknown } | null
    if (body && typeof body === "object" && body.audioMap && typeof body.audioMap === "object") {
      const entries = Object.entries(body.audioMap as Record<string, unknown>)
      if (entries.length > 0 && entries.every(([k, v]) => typeof k === "string" && typeof v === "string")) {
        audioMap = Object.fromEntries(entries) as Record<string, string>
      }
    }
  }

  const results: string[] = []

  // Fase A T06: un solo bump si la operación lógica tocó ≥1 fila.
  const touched = await db.$transaction(async (tx) => {
    let total = 0
    for (const [spanish, audioUrl] of Object.entries(audioMap)) {
      const updated = await tx.dictionaryWord.updateMany({
        where: { spanish },
        data: { audioUrl },
      })
      results.push(`${spanish}: ${updated.count} updated`)
      total += updated.count
    }
    if (total > 0) {
      await bumpContentVersion(tx)
    }
    return total
  })
  void touched

  // Fase A T08: registro de medios best-effort (fuera de la transacción: hay
  // I/O de red de por medio). Nunca lanza: cada fallo se reporta.
  const mediaUpserted: string[] = []
  const outOfInventory: string[] = []
  for (const audioUrl of Object.values(audioMap)) {
    const key = audioRefToKey(audioUrl)
    if (!key) {
      outOfInventory.push(audioUrl)
      continue
    }
    try {
      const bytes = await getObjectBytes(key)
      if (!bytes) {
        outOfInventory.push(audioUrl)
        continue
      }
      const filename = key.split("/").pop() || key
      await db.mediaAsset.upsert({
        where: { objectKey: key },
        update: {
          filename,
          mimeType: detectAudioMime(bytes) ?? "application/octet-stream",
          size: bytes.length,
          sha256: sha256Hex(bytes),
        },
        create: {
          objectKey: key,
          filename,
          mimeType: detectAudioMime(bytes) ?? "application/octet-stream",
          size: bytes.length,
          sha256: sha256Hex(bytes),
        },
      })
      mediaUpserted.push(key)
    } catch {
      outOfInventory.push(audioUrl)
    }
  }

  return NextResponse.json({ results, mediaUpserted, outOfInventory })
}
