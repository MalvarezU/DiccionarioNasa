import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    searchHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET, POST, DELETE } from "./route"

const session = { user: { id: "u1" } }
const authed = { session: session as never, error: null }
const unauthed = {
  session: null,
  error: Response.json({ message: "Debes iniciar sesión" }, { status: 401 }),
}

/**
 * Rate-limit real (módulo sin mockear): cada test usa una IP única para
 * aislar los buckets en memoria entre sí.
 */
let ipSeq = 0
function postReq(body: unknown, ip = `10.200.0.${++ipSeq}`): NextRequest {
  return new NextRequest("http://localhost:3000/api/dictionary/search-history", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/dictionary/search-history", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(authed)
  })

  it("rechaza sin sesión con 401 y no guarda nada", async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauthed as never)

    const res = await POST(postReq({ query: "nasa" }))

    expect(res.status).toBe(401)
    expect(db.searchHistory.create).not.toHaveBeenCalled()
  })

  it("guarda la búsqueda con trim y devuelve { success, id, query }", async () => {
    vi.mocked(db.searchHistory.create).mockResolvedValue({
      id: "s1",
      query: "nasa yuwe",
    } as never)

    const res = await POST(postReq({ query: "  nasa yuwe  " }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      id: "s1",
      query: "nasa yuwe",
    })
    expect(db.searchHistory.create).toHaveBeenCalledWith({
      data: { userId: "u1", query: "nasa yuwe" },
    })
  })

  it("rechaza query vacía o solo espacios (400)", async () => {
    for (const query of ["", "   "]) {
      const res = await POST(postReq({ query }))
      expect(res.status).toBe(400)
      expect((await res.json()).message).toContain("vacía")
    }
    expect(db.searchHistory.create).not.toHaveBeenCalled()
  })

  it("rechaza query no-string como vacía (400)", async () => {
    const res = await POST(postReq({ query: 42 }))

    expect(res.status).toBe(400)
    expect(db.searchHistory.create).not.toHaveBeenCalled()
  })

  it("rechaza query de más de 100 caracteres (400)", async () => {
    const res = await POST(postReq({ query: "a".repeat(101) }))

    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain("100")
    expect(db.searchHistory.create).not.toHaveBeenCalled()
  })

  it("acepta query de exactamente 100 caracteres (borde)", async () => {
    const full = "a".repeat(100)
    vi.mocked(db.searchHistory.create).mockResolvedValue({
      id: "s2",
      query: full,
    } as never)

    const res = await POST(postReq({ query: full }))

    expect(res.status).toBe(200)
    expect(db.searchHistory.create).toHaveBeenCalledWith({
      data: { userId: "u1", query: full },
    })
  })

  it("aplica rate-limit 5/min por IP: la sexta queda en 429", async () => {
    vi.mocked(db.searchHistory.create).mockResolvedValue({
      id: "s9",
      query: "kw",
    } as never)
    const ip = `10.201.0.${++ipSeq}`

    for (let i = 0; i < 5; i++) {
      const res = await POST(postReq({ query: `kw${i}` }, ip))
      expect(res.status).toBe(200)
    }

    const blocked = await POST(postReq({ query: "una más" }, ip))
    expect(blocked.status).toBe(429)
    expect(db.searchHistory.create).toHaveBeenCalledTimes(5)
  })
})

describe("GET /api/dictionary/search-history", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(authed)
  })

  it("rechaza sin sesión con 401", async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauthed as never)

    const res = await GET()

    expect(res.status).toBe(401)
    expect(db.searchHistory.findMany).not.toHaveBeenCalled()
  })

  it("devuelve las últimas 20 en orden desc", async () => {
    const rows = [
      { id: "s2", query: "yuwe", createdAt: new Date("2026-04-02T00:00:00Z") },
      { id: "s1", query: "nasa", createdAt: new Date("2026-04-01T00:00:00Z") },
    ]
    vi.mocked(db.searchHistory.findMany).mockResolvedValue(rows as never)

    const res = await GET()

    expect(res.status).toBe(200)
    expect(db.searchHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    )
    const body = await res.json()
    expect(body.history.map((h: { id: string }) => h.id)).toEqual(["s2", "s1"])
  })
})

describe("DELETE /api/dictionary/search-history", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(authed)
  })

  it("rechaza sin sesión con 401", async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauthed as never)

    const res = await DELETE()

    expect(res.status).toBe(401)
    expect(db.searchHistory.deleteMany).not.toHaveBeenCalled()
  })

  it("borra todas las del usuario", async () => {
    vi.mocked(db.searchHistory.deleteMany).mockResolvedValue({ count: 4 } as never)

    const res = await DELETE()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(db.searchHistory.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    })
  })
})
