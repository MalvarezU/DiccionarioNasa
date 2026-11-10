import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { bumpContentVersion } from '@/lib/content-version'

/**
 * POST /api/dictionary/update-audio
 * One-time script to update audioUrl for demo words.
 * Requiere admin: antes era público y permitía sobrescribir audios.
 *
 * @deprecated Fase A T06: el path de escritura de medios con hash (sha256)
 * pertenece a T08 (Fase B lo elimina). Solo hace bump si tocó ≥1 fila.
 */
export async function POST() {
  const { error } = await requireAdmin()
  if (error) return error

  const audioMap: Record<string, string> = {
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

  return NextResponse.json({ results })
}
