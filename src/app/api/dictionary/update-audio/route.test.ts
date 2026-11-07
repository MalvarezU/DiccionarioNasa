import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    dictionaryWord: {
      updateMany: vi.fn(),
    },
  }
  // La ruta usa `db.$transaction(async (tx) => ...)`: el mock ejecuta el
  // callback con el propio db mockeado como `tx`.
  db.$transaction = vi.fn(async (fn: unknown) =>
    typeof fn === "function" ? (fn as (tx: unknown) => unknown)(db) : fn
  )
  return { db }
})

vi.mock("@/lib/content-version", () => ({
  bumpContentVersion: vi.fn(),
  getContentVersion: vi.fn(),
}))

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"
import { POST } from "./route"

const adminSession = { user: { id: "admin1", role: "admin" } } as never

describe("POST /api/dictionary/update-audio", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
  })

  it("returns 401 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      session: null,
      error: Response.json({ message: "No autorizado" }, { status: 401 }),
    })

    const res = await POST()
    expect(res.status).toBe(401)
  })

  it("updates audio URLs for all predefined words with a single bump", async () => {
    vi.mocked(db.dictionaryWord.updateMany).mockResolvedValue({ count: 1 } as never)

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results).toBeDefined()
    expect(body.results.length).toBe(9)
    // T06: N filas tocadas = exactamente un bump.
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("calls updateMany for each word in the audio map", async () => {
    vi.mocked(db.dictionaryWord.updateMany).mockResolvedValue({ count: 1 } as never)

    await POST()

    expect(db.dictionaryWord.updateMany).toHaveBeenCalledTimes(9)
  })

  it("includes the count of updated records in results without bump on zero rows", async () => {
    vi.mocked(db.dictionaryWord.updateMany).mockResolvedValue({ count: 0 } as never)

    const res = await POST()
    const body = await res.json()

    expect(body.results[0]).toContain(": 0 updated")
    // T06: 0 filas tocadas → sin bump.
    expect(bumpContentVersion).not.toHaveBeenCalled()
  })

  it("passes the correct spanish word and audioUrl to updateMany", async () => {
    vi.mocked(db.dictionaryWord.updateMany).mockResolvedValue({ count: 1 } as never)

    await POST()

    const firstCall = vi.mocked(db.dictionaryWord.updateMany).mock.calls[0][0]
    expect(firstCall.where).toHaveProperty("spanish")
    expect(firstCall.data).toHaveProperty("audioUrl")
  })
})