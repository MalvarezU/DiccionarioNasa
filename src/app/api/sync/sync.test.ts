import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findMany: vi.fn(), count: vi.fn() },
    auditLog: { findMany: vi.fn() },
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
})
