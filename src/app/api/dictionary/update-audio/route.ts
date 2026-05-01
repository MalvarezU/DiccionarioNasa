import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/dictionary/update-audio
 * One-time script to update audioUrl for demo words.
 * In production, this would be done via the admin panel.
 */
export async function POST() {
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
