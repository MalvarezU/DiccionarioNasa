import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { POST } from "./route"
import { storePreview, __resetPreviewStore } from "../preview/route"

const editorSession = { user: { id: "editor1", role: "editor" } } as never

function allow() {
  vi.mocked(requireRole).mockResolvedValue({ session: editorSession, error: null })
}

function confirmReq(token: unknown): Request {
  return new Request("http://localhost:3000/api/admin/import/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ previewToken: token }),
  })
}

const word = (spanish: string) => ({
  spanish,
  nasaYuwe: "ny",
  pronunciation: null,
  audioUrl: null,
  culturalContext: null,
  category: null,
  examples: null,
  status: "DRAFT" as const,
})

describe("POST /api/admin/import/confirm [B1.10]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetPreviewStore()
  })

  it("confirma lo validado con bitacora por ficha y reporte", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue(null)
    vi.mocked(db.dictionaryWord.create).mockImplementation(async ({ data }: never) => ({
      id: `n-${(data as { spanish: string }).spanish}`,
    }))
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const token = storePreview([word("casa"), word("agua")])
    const res = await POST(confirmReq(token))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.created).toBe(2)
    expect(body.report).toHaveLength(2)
    expect(body.report[0]).toEqual(
      expect.objectContaining({ spanish: "casa", resultado: expect.stringContaining("creada") })
    )
    const fichaLogs = vi
      .mocked(db.auditLog.create)
      .mock.calls.filter((c) => (c[0] as { data: { entityId?: string } }).data.entityId)
    expect(fichaLogs).toHaveLength(2)
  })

  it("token de un solo uso y 410 si expiro o no existe", async () => {
    allow()
    const token = storePreview([word("sol")])

    const first = await POST(confirmReq(token))
    expect(first.status).toBe(200)

    const second = await POST(confirmReq(token))
    expect(second.status).toBe(410)

    const bad = await POST(confirmReq("inexistente"))
    expect(bad.status).toBe(410)
  })

  it("omite duplicados nuevos al confirmar", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue({ id: "old" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const token = storePreview([word("casa")])
    const res = await POST(confirmReq(token))
    const body = await res.json()

    expect(body.created).toBe(0)
    expect(body.skipped).toBe(1)
    expect(db.dictionaryWord.create).not.toHaveBeenCalled()
  })
})
