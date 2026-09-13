import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

export const GAMES = ["flashcards", "memory", "complete"] as const
export type GameId = (typeof GAMES)[number]

function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && (GAMES as readonly string[]).includes(value)
}

/**
 * POST /api/games/result
 * Body { game, won, score, streak, sessionKey? }.
 * Con sesión persiste racha/puntaje (upsert por usuario+juego); con
 * sessionKey persiste anónimo; sin nada valida y responde saved:false.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const game = body?.game
    const won = body?.won === true
    const score = Number.isFinite(Number(body?.score)) ? Math.max(0, Math.floor(Number(body.score))) : 0
    const streak = Number.isFinite(Number(body?.streak)) ? Math.max(0, Math.floor(Number(body.streak))) : 0
    const sessionKey = typeof body?.sessionKey === "string" && body.sessionKey ? body.sessionKey.slice(0, 64) : null

    if (!isGameId(game)) {
      return NextResponse.json({ message: "Juego inválido" }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null

    if (!userId && !sessionKey) {
      return NextResponse.json({ saved: false })
    }

    const where = userId
      ? { userId_game: { userId, game } }
      : { sessionKey_game: { sessionKey: sessionKey as string, game } }

    const existing = await db.userGameSession.findUnique({ where })

    if (!existing) {
      await db.userGameSession.create({
        data: {
          userId,
          sessionKey,
          game,
          played: 1,
          won: won ? 1 : 0,
          bestScore: score,
          bestStreak: streak,
        },
      })
    } else {
      await db.userGameSession.update({
        where: { id: existing.id },
        data: {
          played: { increment: 1 },
          won: { increment: won ? 1 : 0 },
          bestScore: Math.max(existing.bestScore, score),
          bestStreak: Math.max(existing.bestStreak, streak),
        },
      })
    }

    return NextResponse.json({ saved: true })
  } catch (error) {
    console.error("Game result error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/**
 * GET /api/games/stats — mis marcas por juego (requiere sesión;
 * anónimos usan localStorage).
 */
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const userId = (session!.user as { id: string }).id
    const sessions = await db.userGameSession.findMany({ where: { userId } })
    const byGame: Record<string, { played: number; won: number; bestScore: number; bestStreak: number }> = {}
    for (const s of sessions) {
      byGame[s.game] = {
        played: s.played,
        won: s.won,
        bestScore: s.bestScore,
        bestStreak: s.bestStreak,
      }
    }
    return NextResponse.json({ byGame })
  } catch (error) {
    console.error("Game stats error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
