import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

/**
 * GET /api/dictionary/favorites?wordId=xxx
 * Check if a word is favorited by the current user.
 * Also supports GET /api/dictionary/favorites (returns all favorites for the user)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ favorites: [], isFavorite: false })
    }

    const userId = (session.user as { id: string }).id
    const wordId = request.nextUrl.searchParams.get('wordId')

    if (wordId) {
      // Check if specific word is favorite
      const favorite = await db.favorite.findUnique({
        where: {
          userId_wordId: { userId, wordId },
        },
      })
      return NextResponse.json({ isFavorite: !!favorite })
    }

    // Return all favorites for the user
    const favorites = await db.favorite.findMany({
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

    return NextResponse.json({ favorites })
  } catch (error) {
    console.error('Get favorites error:', error)
    return NextResponse.json(
      { favorites: [], isFavorite: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dictionary/favorites
 * Toggle favorite status for a word.
 * Body: { wordId: string }
 * Returns: { isFavorite: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Debes iniciar sesión para guardar favoritos' },
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

    // Check if word exists
    const word = await db.dictionaryWord.findUnique({ where: { id: wordId } })
    if (!word) {
      return NextResponse.json(
        { message: 'Palabra no encontrada' },
        { status: 404 }
      )
    }

    // Check existing favorite
    const existing = await db.favorite.findUnique({
      where: {
        userId_wordId: { userId, wordId },
      },
    })

    if (existing) {
      // Remove from favorites
      await db.favorite.delete({
        where: { id: existing.id },
      })
      return NextResponse.json({ isFavorite: false })
    } else {
      // Add to favorites
      await db.favorite.create({
        data: { userId, wordId },
      })
      return NextResponse.json({ isFavorite: true })
    }
  } catch (error) {
    console.error('Toggle favorite error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
