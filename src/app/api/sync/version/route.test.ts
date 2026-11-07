import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    contentVersion: { findUnique: vi.fn() },
  },
}))

import { db } from "@/lib/db"
import { GET } from "./route"

const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300"

describe("GET /api/sync/version [Fase B W1]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sin sesión → 200, forma exacta y Cache-Control público", async () => {
    vi.mocked(db.contentVersion.findUnique).mockResolvedValue({ version: 41 } as never)

    const res = await GET(new Request("http://x/api/sync/version") as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ contentVersion: 41 })
    expect(typeof body.contentVersion).toBe("number")
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL)
  })

  it("lectura fresca por request: tras un bump la segunda lectura devuelve N+1", async () => {
    vi.mocked(db.contentVersion.findUnique)
      .mockResolvedValueOnce({ version: 41 } as never)
      .mockResolvedValueOnce({ version: 42 } as never)

    const first = await GET(new Request("http://x/api/sync/version") as never)
    const second = await GET(new Request("http://x/api/sync/version") as never)

    expect((await first.json()).contentVersion).toBe(41)
    expect((await second.json()).contentVersion).toBe(42)
    expect(db.contentVersion.findUnique).toHaveBeenCalledTimes(2)
  })

  it("ante excepción interna → 500 con cuerpo exacto y sin Cache-Control", async () => {
    vi.mocked(db.contentVersion.findUnique).mockRejectedValue(new Error("db caída"))

    const res = await GET(new Request("http://x/api/sync/version") as never)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ message: "Error interno del servidor" })
    expect(res.headers.get("Cache-Control")).toBeNull()
  })
})
