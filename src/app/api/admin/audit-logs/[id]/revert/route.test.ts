import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
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
    module: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    lesson: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }
  // La ruta usa `db.$transaction(async (tx) => ...)` en los paths de
  // DictionaryWord: el mock ejecuta el callback con el propio db como `tx`.
  // El path de User usa forma array (evaluación ansiosa): se devuelve tal cual.
  db.$transaction = vi.fn(async (ops: unknown) =>
    typeof ops === "function" ? (ops as (tx: unknown) => unknown)(db) : ops
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

  it("404 si el log no existe sin bump", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(null)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "nope" }) })
    expect(res.status).toBe(404)
    expect(bumpContentVersion).not.toHaveBeenCalled()
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
    // Revert aplicado = +1.
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
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
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
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


  // ---------- huecos cerrados (variedad) ----------

  it("200 restaura rol de usuario y crea log REVERT", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "logR", action: "UPDATE", entity: "User", entityId: "u1",
      changes: JSON.stringify({ field: "role", from: "user", to: "editor", responsable: "admin" }),
      userId: "admin1", wordId: null, createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", role: "editor" } as never)
    vi.mocked(db.user.update).mockResolvedValue({} as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: "rv" } as never)

    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logR" }) })
    expect(res.status).toBe(200)
    expect(vi.mocked(db.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "user" } })
    )
    const createCall = vi.mocked(db.auditLog.create).mock.calls[0][0] as { data: { action: string; changes: string } }
    expect(createCall.data.action).toBe("REVERT")
    expect(createCall.data.changes).toContain('"originalLogId":"logR"')
  })

  it("409 si el rol del usuario cambió después (concurrencia)", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "logR2", action: "UPDATE", entity: "User", entityId: "u1",
      changes: JSON.stringify({ field: "role", from: "user", to: "editor", responsable: "admin" }),
      userId: "admin1", wordId: null, createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", role: "admin" } as never) // ya no es "editor"
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logR2" }) })
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.message).toMatch(/cambi/i)
  })

  it("409 si el log de rol está malformado", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "logR3", action: "UPDATE", entity: "User", entityId: "u1",
      changes: JSON.stringify({ field: "name", from: "a", to: "b" }),
      userId: "admin1", wordId: null, createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", role: "editor" } as never)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logR3" }) })
    expect(res.status).toBe(409)
  })

  it("409 si la ficha ya no existe (UPDATE)", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(makeLog() as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(null)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "log1" }) })
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.message).toMatch(/ya no existe/i)
  })

  it("200 restaura varios campos a la vez", async () => {
    allow()
    const multi = {
      id: "logM", action: "UPDATE", entity: "DictionaryWord", entityId: "w1",
      changes: JSON.stringify({
        category: { before: "sustantivo", after: "verbo" },
        culturalContext: { before: "Construcción", after: "Cultura" },
        responsable: "admin",
      }),
      userId: "admin1", wordId: "w1", createdAt: new Date(),
    }
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(multi as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({ id: "w1", category: "verbo", culturalContext: "Cultura" } as never)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({} as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: "rv" } as never)

    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logM" }) })
    expect(res.status).toBe(200)
    expect(vi.mocked(db.dictionaryWord.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { category: "sustantivo", culturalContext: "Construcción" } })
    )
    const createCall = vi.mocked(db.auditLog.create).mock.calls[0][0] as { data: { changes: string } }
    expect(createCall.data.changes).toContain('"originalLogId":"logM"')
  })

  it("409 si el UPDATE no describe campos (solo responsable)", async () => {
    allow()
    const onlyResp = {
      id: "logO", action: "UPDATE", entity: "DictionaryWord", entityId: "w1",
      changes: JSON.stringify({ responsable: "admin" }),
      userId: "admin1", wordId: "w1", createdAt: new Date(),
    }
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(onlyResp as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({ id: "w1" } as never)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logO" }) })
    expect(res.status).toBe(409)
  })

  it("422 si el DELETE no tiene snapshot completo (histórico) sin bump", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "logH", action: "DELETE", entity: "DictionaryWord", entityId: "old-h",
      changes: JSON.stringify({ responsable: "admin" }),
      userId: "admin1", wordId: null, createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logH" }) })
    expect(res.status).toBe(422)
    expect(bumpContentVersion).not.toHaveBeenCalled()
    expect(db.dictionaryWord.create).not.toHaveBeenCalled()
  })

  it("200 DELETE recrea la ficha con snapshot completo", async () => {
    allow()
    const snap = { spanish: "Sol", nasaYuwe: "Sek", pronunciation: "sek", category: "sustantivo", status: "PUBLISHED", audioUrl: null, illustrationUrl: null, culturalContext: "Constelación", examples: null }
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "logD", action: "DELETE", entity: "DictionaryWord", entityId: "old1",
      changes: JSON.stringify({ deleted: snap, responsable: "admin" }),
      userId: "admin1", wordId: null, createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue(null) // no duplicado
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "new1" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: "rv" } as never)

    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logD" }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.newId).toBe("new1")
    const createArg = vi.mocked(db.dictionaryWord.create).mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createArg.data.spanish).toBe("Sol")
    expect(createArg.data.nasaYuwe).toBe("Sek")
    expect(createArg.data.status).toBe("PUBLISHED")
  })

  it("409 DELETE recrea si ya existe otra ficha con el mismo español", async () => {
    allow()
    const snap = { spanish: "Sol", nasaYuwe: "Sek", status: "PUBLISHED" }
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "logD2", action: "DELETE", entity: "DictionaryWord", entityId: "old2",
      changes: JSON.stringify({ deleted: { ...snap, category: "sustantivo", pronunciation: null, audioUrl: null, illustrationUrl: null, culturalContext: null, examples: null } }),
      userId: "admin1", wordId: null, createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue({ id: "existing" } as never)
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logD2" }) })
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.message).toMatch(/Ya existe/i)
  })

  it("200 DELETE recrea con status default DRAFT si falta", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "logD3", action: "DELETE", entity: "DictionaryWord", entityId: "old3",
      changes: JSON.stringify({ deleted: { spanish: "X", nasaYuwe: "Y", pronunciation: null, audioUrl: null, illustrationUrl: null, culturalContext: null, examples: null } }),
      userId: "admin1", wordId: null, createdAt: new Date(),
    } as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.create).mockResolvedValue({ id: "new3" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: "rv" } as never)

    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logD3" }) })
    expect(res.status).toBe(200)
    const createArg = vi.mocked(db.dictionaryWord.create).mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createArg.data.status).toBe("DRAFT")
  })

describe("POST revert borrado lógico Module/Lesson [fase-a T07]", () => {
  beforeEach(() => vi.clearAllMocks())

  function moduleLog(overrides: Record<string, unknown> = {}) {
    return {
      id: "logM1",
      action: "DELETE",
      entity: "Module",
      entityId: "m1",
      changes: JSON.stringify({ deleted: { id: "m1" }, responsable: "admin" }),
      userId: "admin1",
      wordId: null,
      createdAt: new Date(),
      ...overrides,
    }
  }

  it("200 restaura deletedAt = null con bump", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(moduleLog() as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.module.findUnique).mockResolvedValue({ id: "m1", deletedAt: new Date() } as never)
    vi.mocked(db.module.update).mockResolvedValue({ id: "m1", deletedAt: null } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: "rv" } as never)

    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logM1" }) })
    expect(res.status).toBe(200)
    expect(vi.mocked(db.module.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" }, data: { deletedAt: null } })
    )
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("409 si el módulo ya está restaurado sin bump", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(moduleLog() as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.module.findUnique).mockResolvedValue({ id: "m1", deletedAt: null } as never)

    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logM1" }) })
    expect(res.status).toBe(409)
    expect(bumpContentVersion).not.toHaveBeenCalled()
    expect(db.module.update).not.toHaveBeenCalled()
  })

  it("409 si la entidad ya no existe sin bump", async () => {
    allow()
    vi.mocked(db.auditLog.findUnique).mockResolvedValue(moduleLog() as never)
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null)
    vi.mocked(db.module.findUnique).mockResolvedValue(null)

    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "logM1" }) })
    expect(res.status).toBe(409)
    expect(bumpContentVersion).not.toHaveBeenCalled()
  })
})
