import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const word = await db.dictionaryWord.findUnique({
      where: { id },
      select: {
        id: true,
        spanish: true,
        nasaYuwe: true,
        pronunciation: true,
        audioUrl: true,
        culturalContext: true,
        category: true,
        examples: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!word) {
      return NextResponse.json(
        { message: 'Word not found' },
        { status: 404 }
      )
    }

    // Parse examples JSON if it exists
    const parsedWord = {
      ...word,
      examples: word.examples ? JSON.parse(word.examples) : null,
    }

    return NextResponse.json(parsedWord)
  } catch (error) {
    console.error('Get word error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
