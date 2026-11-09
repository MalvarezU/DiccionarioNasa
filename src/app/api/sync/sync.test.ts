import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findMany: vi.fn(), count: vi.fn() },
    auditLog: { findMany: vi.fn() },
    mediaAsset: { findMany: vi.fn() },
    // getContentVersion() lee db.contentVersion; undefined → versión 1.
    contentVersion: { findUnique: vi.fn() },
  },
}))

import { db } from "@/lib/db"
import { GET as syncGET } from "./route"
import { GET as seedGET } from "./seed/route"

const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300"

const T0 = new Date("2026-09-01T00:00:00Z")
const T1 = new Date("2026-09-02T00:00:00Z")

function word(id: string, status = "PUBLISHED", updatedAt = T1) {
  return {
    id, spanish: "a", nasaYuwe: "b", pronunciation: null, audioUrl: null,
    illustrationUrl: null, culturalContext: null, category: null, examples: null,
    status, updatedAt,
  }
}

describe("sync API pública [Fase B W2]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("GET /api/sync sin sesión → 200 con Cache-Control público (antes 401)", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([word("w1")] as never)
    vi.mocked(db.auditLog.findMany).mockResolvedValue([])

    // Sin sesión, sin headers: ruta pública.
    const res = await syncGET(new Request("http://x/api/sync") as never)

    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL)
  })

  it("GET /api/sync/seed sin sesión → 200 con Cache-Control público (antes 401)", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(1)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([word("w1")] as never)

    const res = await seedGET(new Request("http://x/api/sync/seed") as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL)
    expect(body.words.map((w: { id: string }) => w.id)).toEqual(["w1"])
  })

  it("sync filtra PUBLISHED-only en la consulta (F1): cero DRAFT/ARCHIVED por construcción", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([word("w1")] as never)
    vi.mocked(db.auditLog.findMany).mockResolvedValue([])

    const res = await syncGET(
      new Request(`http://x/api/sync?since=${T0.toISOString()}&limit=10`) as never
    )
    expect(res.status).toBe(200)

    // El enforcement es el `where` DB, no un post-filtro JS: la página ya
    // llega con solo PUBLISHED y el mapeo a la forma pública es directo.
    expect(db.dictionaryWord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ status: "PUBLISHED" }, { updatedAt: { gt: T0 } }] },
        take: 11,
      })
    )
  })

  it("seed mantiene where { status: PUBLISHED } compartido por count + findMany", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(5)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([word("w1")] as never)

    await seedGET(new Request("http://x/api/sync/seed?page=2&pageSize=1") as never)

    expect(db.dictionaryWord.count).toHaveBeenCalledWith({ where: { status: "PUBLISHED" } })
    expect(db.dictionaryWord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PUBLISHED" }, skip: 1, take: 1 })
    )
  })

  it("deltas con keyset: tombstones DELETE en removedIds, ventana y paginación intactas", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([word("w1")] as never)
    vi.mocked(db.auditLog.findMany).mockResolvedValue([{ entityId: "w9" }] as never)

    const res = await syncGET(
      new Request(`http://x/api/sync?since=${T0.toISOString()}&limit=10`) as never
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.words.map((w: { id: string }) => w.id)).toEqual(["w1"])
    expect(body.removedIds).toEqual(expect.arrayContaining(["w9"]))
    expect(body.serverTime).toEqual(expect.any(String))
    expect(body.nextCursor).toBeNull()
  })

  it("defensa: una fila ARCHIVED que llegara a `page` igual cae en removedIds (el filtro real es el where DB)", async () => {
    // Con el filtro en consulta `page` nunca trae ARCHIVED en producción
    // (vacío por construcción); esta línea es defensa contra regresión del
    // `where`. El mock simula el caso que la DB ya impide.
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([
      word("w1"),
      word("w2", "ARCHIVED"),
      word("w3", "archived"),
    ] as never)
    vi.mocked(db.auditLog.findMany).mockResolvedValue([])

    const res = await syncGET(new Request("http://x/api/sync?limit=10") as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.removedIds).toEqual(expect.arrayContaining(["w2", "w3"]))
  })

  it("contentVersion presente en ambas respuestas", async () => {
    vi.mocked(db.contentVersion.findUnique).mockResolvedValue({ version: 41 } as never)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([word("w1")] as never)
    vi.mocked(db.auditLog.findMany).mockResolvedValue([])
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(1)

    const syncBody = await (await syncGET(new Request("http://x/api/sync") as never)).json()
    const seedBody = await (await seedGET(new Request("http://x/api/sync/seed") as never)).json()

    expect(syncBody.contentVersion).toBe(41)
    expect(seedBody.contentVersion).toBe(41)
  })

  it("pagina con cursor opaco y filtra updatedAt inválido", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([word("w1"), word("w2"), word("w3")] as never)
    vi.mocked(db.auditLog.findMany).mockResolvedValue([])

    const first = await syncGET(new Request("http://x/api/sync?limit=2") as never)
    const b1 = await first.json()
    expect(b1.words).toHaveLength(2)
    expect(typeof b1.nextCursor).toBe("string")

    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([word("w3")] as never)
    const second = await syncGET(
      new Request(`http://x/api/sync?limit=2&cursor=${b1.nextCursor}`) as never
    )
    const b2 = await second.json()
    expect(b2.words.map((w: { id: string }) => w.id)).toEqual(["w3"])
    expect(b2.nextCursor).toBeNull()
  })

  it("seed pagina el snapshot publicado", async () => {
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

  it("F1-a sync: expone audioSha256 e illustrationSha256 desde MediaAsset (null sin asset ni hash)", async () => {
    const t1 = new Date("2026-09-02T00:00:00Z")
    const AA = "aa".repeat(32)
    const BB = "bb".repeat(32)
    const CC = "cc".repeat(32)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([
      { id: "w1", spanish: "a", nasaYuwe: "b", pronunciation: null, audioUrl: "audios/w1/a.mp3", illustrationUrl: "/api/media/m1", culturalContext: null, category: null, examples: null, status: "PUBLISHED", updatedAt: t1 },
      // Ruta local sin objeto R2 → null aunque haya filas en el inventario.
      { id: "w2", spanish: "c", nasaYuwe: "d", pronunciation: null, audioUrl: "/audio/local.wav", illustrationUrl: null, culturalContext: null, category: null, examples: null, status: "PUBLISHED", updatedAt: t1 },
      // Asset sin hash (backfill pendiente) → null, coherente con R3(b).
      { id: "w3", spanish: "e", nasaYuwe: "f", pronunciation: null, audioUrl: "audios/w3/c.mp3", illustrationUrl: null, culturalContext: null, category: null, examples: null, status: "PUBLISHED", updatedAt: t1 },
      // Ilustración por URL pública R2 → resuelve por objectKey.
      { id: "w4", spanish: "g", nasaYuwe: "h", pronunciation: null, audioUrl: null, illustrationUrl: "https://cdn.test/images/x.png", culturalContext: null, category: null, examples: null, status: "PUBLISHED", updatedAt: t1 },
    ] as never)
    vi.mocked(db.auditLog.findMany).mockResolvedValue([])
    vi.mocked(db.mediaAsset.findMany).mockResolvedValue([
      { id: "mx", objectKey: "audios/w1/a.mp3", sha256: AA },
      { id: "m1", objectKey: "images/other.png", sha256: BB },
      { id: "mz", objectKey: "audios/w3/c.mp3", sha256: null },
      { id: "mw", objectKey: "images/x.png", sha256: CC },
    ] as never)

    const prevBase = process.env.R2_PUBLIC_BASE_URL
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.test"
    let body: { words: Array<Record<string, unknown>> }
    try {
      const res = await syncGET(new Request("http://x/api/sync?limit=10") as never)
      expect(res.status).toBe(200)
      body = await res.json()
    } finally {
      if (prevBase === undefined) delete process.env.R2_PUBLIC_BASE_URL
      else process.env.R2_PUBLIC_BASE_URL = prevBase
    }
    const byId = Object.fromEntries(body.words.map((w) => [w.id, w]))
    expect(byId.w1.audioSha256).toBe(AA)
    expect(byId.w1.illustrationSha256).toBe(BB)
    expect(byId.w2.audioSha256).toBeNull()
    expect(byId.w2.illustrationSha256).toBeNull()
    expect(byId.w3.audioSha256).toBeNull()
    expect(byId.w4.audioSha256).toBeNull()
    expect(byId.w4.illustrationSha256).toBe(CC)
    // Regresión de forma: claves preexistentes intactas, solo +2 aditivas.
    expect(Object.keys(byId.w1).sort()).toEqual(
      ["id", "spanish", "nasaYuwe", "pronunciation", "audioUrl", "illustrationUrl",
       "culturalContext", "category", "examples", "status", "updatedAt",
       "audioSha256", "illustrationSha256"].sort()
    )
  })

  it("F1-a seed: expone audioSha256 e illustrationSha256 (null sin asset)", async () => {
    const t1 = new Date("2026-09-02T00:00:00Z")
    const AA = "aa".repeat(32)
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(2)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([
      { id: "w1", spanish: "a", nasaYuwe: "b", pronunciation: null, audioUrl: "audios/w1/a.mp3", illustrationUrl: "/api/media/m1", culturalContext: null, category: null, examples: null, status: "PUBLISHED", updatedAt: t1 },
      { id: "w2", spanish: "c", nasaYuwe: "d", pronunciation: null, audioUrl: null, illustrationUrl: null, culturalContext: null, category: null, examples: null, status: "PUBLISHED", updatedAt: t1 },
    ] as never)
    vi.mocked(db.mediaAsset.findMany).mockResolvedValue([
      { id: "mx", objectKey: "audios/w1/a.mp3", sha256: AA },
      { id: "m1", objectKey: "images/x.png", sha256: null },
    ] as never)
    const res = await seedGET(new Request("http://x/api/sync/seed") as never)
    const body = await res.json()
    const byId: Record<string, { audioSha256: unknown; illustrationSha256: unknown }> =
      Object.fromEntries(body.words.map((w: { id: string }) => [w.id, w]))
    expect(byId.w1.audioSha256).toBe(AA)
    // Asset sin hash → null.
    expect(byId.w1.illustrationSha256).toBeNull()
    expect(byId.w2.audioSha256).toBeNull()
    expect(byId.w2.illustrationSha256).toBeNull()
  })
})
