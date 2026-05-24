import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: vi.fn(),
    },
  },
}))

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET } from "./route"

const mockUsers = [
  {
    id: "u1",
    email: "user@test.com",
    name: "User",
    role: "user",
    createdAt: new Date().toISOString(),
    _count: { favorites: 3, viewHistory: 5 },
  },
  {
    id: "u2",
    email: "admin@test.com",
    name: "Admin",
    role: "admin",
    createdAt: new Date().toISOString(),
    _count: { favorites: 0, viewHistory: 0 },
  },
]

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: { user: { id: "admin1", role: "admin" } } as never,
    error: null,
  })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

describe("GET /api/admin/users", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns all users with counts", async () => {
    allow()
    vi.mocked(db.user.findMany).mockResolvedValue(mockUsers)

    const res = await GET(new Request("http://localhost:3000/api/admin/users"))
    const body = await res.json()

    expect(body.users).toHaveLength(2)
    expect(body.users[0]._count.favorites).toBe(3)
  })

  it("filters by search query", async () => {
    allow()
    vi.mocked(db.user.findMany).mockResolvedValue([mockUsers[0]])

    await GET(new Request("http://localhost:3000/api/admin/users?search=user"))

    expect(vi.mocked(db.user.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ email: { contains: "user" } }, { name: { contains: "user" } }] },
      })
    )
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await GET(new Request("http://localhost:3000/api/admin/users"))
    expect(res.status).toBe(401)
  })

  it("returns 500 on DB error", async () => {
    allow()
    vi.mocked(db.user.findMany).mockRejectedValue(new Error("DB error"))

    const res = await GET(new Request("http://localhost:3000/api/admin/users"))
    expect(res.status).toBe(500)
  })
})
