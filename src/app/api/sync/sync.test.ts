import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findMany: vi.fn(), count: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}))

import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET as syncGET } from "./route"
import { GET as seedGET } from "./seed/route"

const authed = { user: { id: "u1", role: "user" } }

function allow() {
  vi.mocked(requireAuth).mockResolvedValue({ session: authed, error: null } as never)
}

function deny() {
  vi.mocked(requireAuth).mockResolvedValue({
    session: null,
    error: Response.json({}, { status: 401 }),
  })
}

describe("sync API [B3.1]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("exige sesión", async () => {
    deny()
    const res = await syncGET(new Request("http://x/api/sync") as never)
    expect(res.status).toBe(401)
  })

  it("deltas con keyset, archivadas y tombstones como removedIds", async () => {
    allow()
    const t0 = new Date("2026-09-01T00:00:00Z")
    const t1 = new Date("2026-09-02T00:00:00Z")
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([
      { id: "w1", spanish: "a", nasaYuwe: "b", pronunciation: null, audioUrl: null, culturalContext: null, category: null, examples: null, status: "PUBLISHED", updatedAt: t1 },
      { id: "w2", spanish: "c", nasaYuwe: "d", pronunciation: null, audioUrl: null, culturalContext: null, category: null, examples: null, status: "ARCHIVED", updatedAt: t1 },
    ] as never)
    vi.mocked(db.auditLog.findMany).mockResolvedValue([{ entityId: "w9" }] as never)

    const res = await syncGET(
      new Request(`http://x/api/sync?since=${t0.toISOString()}&limit=10`) as never
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.words.map((w: { id: string }) => w.id)).toEqual(["w1"])
    expect(body.removedIds).toEqual(expect.arrayContaining(["w2", "w9"]))
    expect(body.serverTime).toEqual(expect.any(String))
    expect(body.nextCursor).toBeNull()
    expect(db.dictionaryWord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { updatedAt: { gt: t0 } },
        take: 11,
      })
    )
  })

  it("pagina con cursor opaco y filtra updatedAt inválido", async () => {
    allow()
    const t1 = new Date("2026-09-02T00:00:00Z")
    const mk = (id: string) => ({
      id, spanish: "a", nasaYuwe: "b", pronunciation: null, audioUrl: null,
      culturalContext: null, category: null, examples: null, status: "PUBLISHED", updatedAt: t1,
    })
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([mk("w1"), mk("w2"), mk("w3")] as never)
    vi.mocked(db.auditLog.findMany).mockResolvedValue([])

    const first = await syncGET(new Request("http://x/api/sync?limit=2") as never)
    const b1 = await first.json()
    expect(b1.words).toHaveLength(2)
    expect(typeof b1.nextCursor).toBe("string")

    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([mk("w3")] as never)
    const second = await syncGET(
      new Request(`http://x/api/sync?limit=2&cursor=${b1.nextCursor}`) as never
    )
    const b2 = await second.json()
    expect(b2.words.map((w: { id: string }) => w.id)).toEqual(["w3"])
    expect(b2.nextCursor).toBeNull()
  })

  it("seed pagina el snapshot publicado", async () => {
    allow()
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(5)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([{ id: "w1" }] as never)
    const res = await seedGET(new Request("http://x/api/sync/seed?page=2&pageSize=1") as never)
    const body = await res.json()
    expect(body.total).toBe(5)
    expect(body.totalPages).toBe(5)
    expect(db.dictionaryWord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PUBLISHED" }, skip: 1, take: 1 })
    )
  })
})
