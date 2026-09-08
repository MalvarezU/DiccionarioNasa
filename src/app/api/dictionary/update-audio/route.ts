import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

/**
 * POST /api/dictionary/update-audio
 * One-time script to update audioUrl for demo words.
 * Requiere admin: antes era público y permitía sobrescribir audios.
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

  for (const [spanish, audioUrl] of Object.entries(audioMap)) {
    const updated = await db.dictionaryWord.updateMany({
      where: { spanish },
      data: { audioUrl },
    })
    results.push(`${spanish}: ${updated.count} updated`)
  }

  return NextResponse.json({ results })
}
