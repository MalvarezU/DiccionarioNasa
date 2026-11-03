import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    dictionaryWord: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}))

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { POST } from "./route"

const adminSession = {
  session: { user: { id: "admin1", name: "Admin", email: "a@b.com", role: "admin" } },
  error: null,
}

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  } as never)
}

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log1",
    action: "UPDATE",
    entity: "DictionaryWord",
    entityId: "w1",
    changes: JSON.stringify({
      category: { before: "sustantivo", after: "verbo" },
      responsable: "admin",
    }),
    userId: "admin1",
    wordId: "w1",
    createdAt: new Date(),
    ...overrides,
  }
}

describe("POST /api/admin/audit-logs/[id]/revert", () => {
  beforeEach(() => vi.clearAllMocks())

  it("401 si no es admin", async () => {
    deny()
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "log1" }) })
    expect(res.status).toBe(401)
  })

  it("404 si el log no existe", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(null)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "nope" }) })
    expect(res.status).toBe(404)
  })

  it("409 si ya fue revertido", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(makeLog() as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue({ id: "rv1" } as never)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "log1" }) })
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.message).toMatch(/ya.*revert/i)
  })

  it("409 si el log es malformado", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(makeLog({ changes: "{bad" }) as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "log1" }) })
    expect(res.status).toBe(409)
  })

  it("409 si la entidad cambió después (concurrencia)", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(makeLog() as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({ id: "w1", category: "otro" } as never)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "log1" }) })
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.message).toMatch(/cambi/i)
  })

  it("200 restaura los campos y crea el log REVERT", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(makeLog() as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({ id: "w1", category: "verbo" } as never)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({} as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: "rv" } as never)

    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "log1" }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(vi.mocked(db.dictionaryWord.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { category: "sustantivo" } })
    )
    expect(vi.mocked(db.auditLog.create)).toHaveBeenCalled()
  })

  it("409 para User DELETE (no reversible)", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "log2", action: "DELETE", entity: "User", entityId: "u1",
      changes: JSON.stringify({ email: "x@y.com", role: "user" }),
      userId: "admin1", wordId: null, createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "log2" }) })
    expect(res.status).toBe(409)
  })

  it("409 para entidad desconocida", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "log3", action: "UPDATE", entity: "Foo", entityId: "x",
      changes: "{}", userId: "admin1", wordId: null, createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "log3" }) })
    expect(res.status).toBe(409)
  })

  it("CREATE borra la ficha y crea el log REVERT", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "log4", action: "CREATE", entity: "DictionaryWord", entityId: "w2",
      changes: JSON.stringify({ spanish: "Sol", nasaYuwe: "Sek", status: "DRAFT" }),
      userId: "admin1", wordId: "w2", createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({ id: "w2", audioUrl: null, illustrationUrl: null } as never)
    vi.mocked(db.dictionaryWord.delete).mockResolvedValue({} as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: "rv" } as never)

    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "log4" }) })
    expect(res.status).toBe(200)
    expect(vi.mocked(db.dictionaryWord.delete)).toHaveBeenCalledWith({ where: { id: "w2" } })
  })

  it("CREATE sobre ficha inexistente devuelve 409", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "log5", action: "CREATE", entity: "DictionaryWord", entityId: "wX",
      changes: JSON.stringify({ spanish: "X", nasaYuwe: "Y" }),
      userId: "admin1", wordId: "wX", createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(null)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "log5" }) })
    expect(res.status).toBe(409)
  })
})

