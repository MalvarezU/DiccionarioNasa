import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findMany: vi.fn(), count: vi.fn() },
    mediaAsset: { findMany: vi.fn() },
    // getContentVersion() lee db.contentVersion; undefined → versión 1.
    contentVersion: { findUnique: vi.fn() },
  },
}))

import { db } from "@/lib/db"
import { GET } from "./route"

/**
 * F0 — contrato canónico: `contentVersion` viaja como string de entero
 * decimal (`/^\d+$/`). Cobertura dedicada de la cuarta ruta del borde.
 */
describe("GET /api/sync/seed — contentVersion canónico string (F0)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("emite contentVersion como string, nunca como número", async () => {
    vi.mocked(db.contentVersion.findUnique).mockResolvedValue({ version: 41 } as never)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(1)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([] as never)

    const res = await GET(new Request("http://x/api/sync/seed") as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.contentVersion).toBe("41")
    expect(typeof body.contentVersion).toBe("string")
  })
})
