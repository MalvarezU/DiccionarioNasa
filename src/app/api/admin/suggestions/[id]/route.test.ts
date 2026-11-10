import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}))

import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"
import { PATCH } from "./route"

function patchRequest(body: unknown) {
  return {
    json: async () => body,
  } as unknown as Request
}

const params = { params: Promise.resolve({ id: "log1" }) }

function mockEditor() {
  vi.mocked(requireRole).mockResolvedValue({
    session: { user: { email: "admin@test.local" } },
    error: null,
  } as never)
}

const baseChanges = JSON.stringify({ term: "yat", comment: "x", source: "community", status: "PENDING" })

describe("PATCH /api/admin/suggestions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEditor()
  })

  it("marca DONE y registra quién/cuándo", async () => {
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "log1", action: "SUGGEST", entity: "DictionaryWord", changes: baseChanges,
    } as never)
    vi.mocked(db.auditLog.update).mockResolvedValue({} as never)

    const res = await PATCH(patchRequest({ action: "DONE" }), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("DONE")

    const written = JSON.parse(vi.mocked(db.auditLog.update).mock.calls[0][0].data.changes as string)
    expect(written.status).toBe("DONE")
    expect(written.term).toBe("yat")
    expect(written.decidedBy).toBe("admin@test.local")
    expect(typeof written.decidedAt).toBe("string")
  })

  it("ARCHIVE y REOPEN cambian el estado", async () => {
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "log1", action: "SUGGEST", entity: "DictionaryWord", changes: baseChanges,
    } as never)
    vi.mocked(db.auditLog.update).mockResolvedValue({} as never)

    const archived = await PATCH(patchRequest({ action: "ARCHIVE" }), params)
    expect((await archived.json()).status).toBe("ARCHIVED")

    const reopened = await PATCH(patchRequest({ action: "REOPEN" }), params)
    expect((await reopened.json()).status).toBe("PENDING")
  })

  it("404 si el log no es SUGGEST", async () => {
    vi.mocked(db.auditLog.findUnique).mockResolvedValue({
      id: "log1", action: "CREATE", entity: "DictionaryWord", changes: "{}",
    } as never)

    const res = await PATCH(patchRequest({ action: "DONE" }), params)
    expect(res.status).toBe(404)
    expect(vi.mocked(db.auditLog.update)).not.toHaveBeenCalled()
  })

  it("400 con acción inválida", async () => {
    const res = await PATCH(patchRequest({ action: "BORRAR" }), params)
    expect(res.status).toBe(400)
  })

  it("respeta el gate de rol (403 sin editor)", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      session: null,
      error: Response.json({ message: "denegado" }, { status: 403 }),
    } as never)

    const res = await PATCH(patchRequest({ action: "DONE" }), params)
    expect(res.status).toBe(403)
  })
})
