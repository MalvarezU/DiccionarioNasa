import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    $queryRawUnsafe: vi.fn(),
    userGameSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}))

import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { GET as wordsGET } from "./words/route"
import { GET as statsGET, POST as resultPOST } from "./result/route"

function authed() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: "u1", role: "user" },
  } as never)
}

describe("GET /api/games/words [B2.1]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("pide N aleatorias solo publicadas", async () => {
    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ id: "w1" }])
    const res = await wordsGET(
      new Request("http://x/api/games/words?count=8") as never
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    const [sql, count] = vi.mocked(db.$queryRawUnsafe).mock.calls[0] as unknown as [string, number]
    expect(count).toBe(8)
    expect(sql).toContain("PUBLISHED")
    expect(sql).toContain("RANDOM()")
  })

  it("limita count a 1..24 y excluye ids", async () => {
    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([])
    await wordsGET(new Request("http://x/api/games/words?count=99&exclude=a,b") as never)
    const [, count, ...rest] = vi.mocked(db.$queryRawUnsafe).mock.calls[0] as unknown as [string, number, ...string[]]
    expect(count).toBe(24)
    expect(rest).toEqual(["a", "b"])
  })
})

describe("POST /api/games/result [B2.1]", () => {
  beforeEach(() => vi.clearAllMocks())

  function req(body: unknown): Request {
    return new Request("http://x/api/games/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  it("rechaza juego inválido", async () => {
    const res = await resultPOST(req({ game: "ajedrez" }) as never)
    expect(res.status).toBe(400)
  })

  it("anónimo sin sessionKey valida sin persistir", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await resultPOST(
      req({ game: "flashcards", won: true, score: 10, streak: 3 }) as never
    )
    expect((await res.json()).saved).toBe(false)
    expect(db.userGameSession.create).not.toHaveBeenCalled()
  })

  it("autenticado crea y luego acumula máximos", async () => {
    authed()
    vi.mocked(db.userGameSession.findUnique).mockResolvedValue(null)
    vi.mocked(db.userGameSession.create).mockResolvedValue({} as never)
    const first = await resultPOST(
      req({ game: "memory", won: true, score: 100, streak: 2 }) as never
    )
    expect((await first.json()).saved).toBe(true)
    expect(db.userGameSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u1", game: "memory", bestScore: 100 }),
      })
    )

    vi.mocked(db.userGameSession.findUnique).mockResolvedValue({
      id: "s1",
      bestScore: 200,
      bestStreak: 5,
    } as never)
    vi.mocked(db.userGameSession.update).mockResolvedValue({} as never)
    await resultPOST(req({ game: "memory", won: false, score: 50, streak: 9 }) as never)
    expect(db.userGameSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bestScore: 200, bestStreak: 9 }),
      })
    )
  })
})

describe("GET /api/games/stats [B2.1]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("exige sesión y agrega por juego", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    // requireAuth usa getServerSession mockeado: sin sesión → 401
    const denied = await statsGET()
    expect(denied.status).toBe(401)

    authed()
    vi.mocked(db.userGameSession.findMany).mockResolvedValue([
      { game: "flashcards", played: 3, won: 2, bestScore: 80, bestStreak: 4 },
    ] as never)
    const res = await statsGET()
    const body = await res.json()
    expect(body.byGame.flashcards).toEqual(
      expect.objectContaining({ played: 3, bestStreak: 4 })
    )
  })
})
