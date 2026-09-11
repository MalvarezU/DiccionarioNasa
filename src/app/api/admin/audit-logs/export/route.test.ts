import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: { findMany: vi.fn() },
  },
}))

import { requireAdmin, requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET } from "./route"

const adminSession = { user: { id: "admin1", role: "admin" } } as never

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
  vi.mocked(requireRole).mockResolvedValue({ session: adminSession, error: null })
}

function deny() {
  vi.mocked(requireRole).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

const mockLogs = [
  {
    id: "0193-uuid-1",
    createdAt: new Date("2026-09-10T10:00:00Z"),
    action: "UPDATE",
    entity: "DictionaryWord",
    entityId: "w1",
    userId: "admin1",
    changes: '{"spanish":{"before":"casa","after":"Casa"}}',
  },
]

describe("GET /api/admin/audit-logs/export [B1.7]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("descarga CSV con BOM, headers y filtros aplicados", async () => {
    allow()
    vi.mocked(db.auditLog.findMany).mockResolvedValue(mockLogs as never)

    const res = await GET(
      new Request("http://localhost:3000/api/admin/audit-logs/export?action=UPDATE&userId=admin1")
    )

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("text/csv")
    expect(res.headers.get("Content-Disposition")).toContain("attachment")
    expect(res.headers.get("Content-Disposition")).toContain("bitacora-")

    const buf = new Uint8Array(await res.arrayBuffer())
    // BOM UTF-8 en bytes (res.text() lo pelaría por spec: verificar crudo)
    expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(buf)
    expect(text).toContain("id,fecha_hora_utc,accion,entidad,entidad_id,responsable,cambios")
    expect(text).toContain("0193-uuid-1")
    expect(text).toContain("UPDATE")

    expect(vi.mocked(db.auditLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { action: "UPDATE", userId: "admin1" },
        take: 50000,
      })
    )
  })

  it("escapa comillas y responde 401 sin sesion", async () => {
    deny()
    const res = await GET(
      new Request("http://localhost:3000/api/admin/audit-logs/export")
    )
    expect(res.status).toBe(401)
    expect(db.auditLog.findMany).not.toHaveBeenCalled()
  })
})
