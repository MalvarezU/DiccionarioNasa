import { vi, describe, it, expect, beforeEach } from "vitest"
import { z } from "zod"

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
    vi.mocked(db.contentVersion.findUnique).mockResolvedValue({
      version: 41,
      updatedAt: new Date("2026-11-09T03:00:12.345Z"),
    } as never)

    const res = await GET(new Request("http://x/api/sync/version") as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    // Cambio aditivo intencional (Fase D W0): se agrega `serverTime`;
    // `contentVersion` conserva la forma canónica heredada de Fase C.
    expect(body).toEqual({
      contentVersion: "41",
      serverTime: "2026-11-09T03:00:12.345Z",
    })
    expect(typeof body.contentVersion).toBe("string")
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL)
  })

  it("lectura fresca por request: tras un bump la segunda lectura devuelve N+1", async () => {
    vi.mocked(db.contentVersion.findUnique)
      .mockResolvedValueOnce({
        version: 41,
        updatedAt: new Date("2026-11-09T03:00:12.345Z"),
      } as never)
      .mockResolvedValueOnce({
        version: 42,
        updatedAt: new Date("2026-11-09T03:05:00.000Z"),
      } as never)

    const first = await GET(new Request("http://x/api/sync/version") as never)
    const second = await GET(new Request("http://x/api/sync/version") as never)

    expect((await first.json()).contentVersion).toBe("41")
    expect((await second.json()).contentVersion).toBe("42")
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

describe("GET /api/sync/version — contrato Fase D W0", () => {
  beforeEach(() => vi.clearAllMocks())

  // Replica exacta del contrato que exige la app
  // (piiyaak-app/src/db/version-gate.ts:14-23, VersionResponseSchema).
  // Importar el schema real es imposible desde web (repos separados).
  const Contract = z.object({
    contentVersion: z.string().regex(/^\d+$/),
    serverTime: z.string().datetime(),
  })

  it("contrato: la respuesta real es aceptada por el contrato de la app", async () => {
    vi.mocked(db.contentVersion.findUnique).mockResolvedValue({
      version: 41,
      updatedAt: new Date("2026-11-09T03:00:12.345Z"),
    } as never)

    const res = await GET(new Request("http://x/api/sync/version") as never)
    const body = await res.json()

    Contract.parse(body)
  })

  it("serverTime es datetime ISO-8601 UTC válido con Z", async () => {
    vi.mocked(db.contentVersion.findUnique).mockResolvedValue({
      version: 41,
      updatedAt: new Date("2026-11-09T03:00:12.345Z"),
    } as never)

    const res = await GET(new Request("http://x/api/sync/version") as never)
    const body = await res.json()

    expect(body.serverTime).toBe("2026-11-09T03:00:12.345Z")
    expect(body.serverTime.endsWith("Z")).toBe(true)
    Contract.parse(body)
  })

  it("fila ContentVersion ausente → { contentVersion: 1, serverTime: ahora } válido contra el contrato", async () => {
    vi.mocked(db.contentVersion.findUnique).mockResolvedValue(null)

    const before = Date.now()
    const res = await GET(new Request("http://x/api/sync/version") as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.contentVersion).toBe("1")
    Contract.parse(body)
    const serverTimeMs = new Date(body.serverTime).getTime()
    expect(serverTimeMs).toBeGreaterThanOrEqual(before)
    expect(serverTimeMs).toBeLessThanOrEqual(Date.now())
    // Sin efecto lateral: un GET no crea la fila.
    expect(db.contentVersion.findUnique).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
