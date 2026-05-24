import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: { findMany: vi.fn(), count: vi.fn() },
  },
}))

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET } from "./route"

const mockLogs = [
  {
    id: "log1",
    action: "CREATE",
    entity: "DictionaryWord",
    entityId: "w1",
    changes: "{}",
    userId: "admin1",
    wordId: "w1",
    createdAt: new Date().toISOString(),
  },
]

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: { user: { id: "admin1", name: "Admin", email: "a@b.com", role: "admin" } } as never,
    error: null,
  })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

describe("GET /api/admin/audit-logs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns paginated audit logs", async () => {
    allow()
    vi.mocked(db.auditLog.findMany).mockResolvedValue(mockLogs)
    vi.mocked(db.auditLog.count).mockResolvedValue(1)

    const res = await GET(new Request("http://localhost:3000/api/admin/audit-logs"))
    const body = await res.json()

    expect(body.logs).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await GET(new Request("http://localhost:3000/api/admin/audit-logs"))
    expect(res.status).toBe(401)
  })

  it("accepts page and pageSize params", async () => {
    allow()
    vi.mocked(db.auditLog.findMany).mockResolvedValue([])
    vi.mocked(db.auditLog.count).mockResolvedValue(50)

    await GET(new Request("http://localhost:3000/api/admin/audit-logs?page=2&pageSize=10"))

    expect(vi.mocked(db.auditLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    )
  })

  it("accepts action and entity filters", async () => {
    allow()
    vi.mocked(db.auditLog.findMany).mockResolvedValue(mockLogs)
    vi.mocked(db.auditLog.count).mockResolvedValue(1)

    await GET(new Request("http://localhost:3000/api/admin/audit-logs?action=CREATE&entity=DictionaryWord"))

    expect(vi.mocked(db.auditLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { action: "CREATE", entity: "DictionaryWord" },
      })
    )
  })

  it("returns 500 on DB error", async () => {
    allow()
    vi.mocked(db.auditLog.findMany).mockRejectedValue(new Error("DB error"))

    const res = await GET(new Request("http://localhost:3000/api/admin/audit-logs"))
    expect(res.status).toBe(500)
  })
})
