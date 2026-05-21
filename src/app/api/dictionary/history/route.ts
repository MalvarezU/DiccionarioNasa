import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

/**
 * GET /api/dictionary/history
 * Returns the authenticated user's word view history, grouped by date.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ history: [] })
    }

    const userId = (session.user as { id: string }).id

    const history = await db.viewHistory.findMany({
      where: { userId },
      select: {
        id: true,
        wordId: true,
        createdAt: true,
        word: {
          select: {
            id: true,
            spanish: true,
            nasaYuwe: true,
            pronunciation: true,
            category: true,
            audioUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Get history error:', error)
    return NextResponse.json(
      { history: [], message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dictionary/history
 * Record a word view for the authenticated user.
 * Body: { wordId: string }
 * Uses upsert since we have @@unique([userId, wordId]) — updates the timestamp on re-view.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Debes iniciar sesión para registrar historial' },
        { status: 401 }
      )
    }

    const userId = (session.user as { id: string }).id
    const body = await request.json()
    const { wordId } = body

    if (!wordId) {
      return NextResponse.json(
        { message: 'wordId es requerido' },
        { status: 400 }
      )
    }

    // Verify word exists
    const word = await db.dictionaryWord.findUnique({ where: { id: wordId } })
    if (!word) {
      return NextResponse.json(
        { message: 'Palabra no encontrada' },
        { status: 404 }
      )
    }

    // Upsert: create or update timestamp
    const entry = await db.viewHistory.upsert({
      where: {
        userId_wordId: { userId, wordId },
      },
      create: {
        userId,
        wordId,
      },
      update: {
        createdAt: new Date(), // bump to latest view time
      },
    })

    return NextResponse.json({ success: true, id: entry.id })
  } catch (error) {
    console.error('Record history error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dictionary/history
 * Clear all view history for the authenticated user.
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Debes iniciar sesión' },
        { status: 401 }
      )
    }

    const userId = (session.user as { id: string }).id

    await db.viewHistory.deleteMany({
      where: { userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clear history error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
