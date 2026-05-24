import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { PATCH, DELETE } from "./route"

const adminSession = {
  user: { id: "admin1", name: "Admin", email: "a@b.com", role: "admin" },
} as never

const mockUser = {
  id: "u1",
  email: "user@test.com",
  name: "User",
  role: "user",
}

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

function req(body: object): Request {
  return new Request("http://localhost:3000/api/admin/users/u1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates user role", async () => {
    allow()
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser)
    vi.mocked(db.user.update).mockResolvedValue({ ...mockUser, role: "admin" })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await PATCH(req({ role: "admin" }), {
      params: Promise.resolve({ id: "u1" }),
    })
    const body = await res.json()

    expect(body.user.role).toBe("admin")
  })

  it("returns 400 for invalid role", async () => {
    allow()
    const res = await PATCH(req({ role: "superadmin" }), {
      params: Promise.resolve({ id: "u1" }),
    })
    expect(res.status).toBe(400)
  })

  it("prevents self-demotion", async () => {
    allow()
    const res = await PATCH(req({ role: "user" }), {
      params: Promise.resolve({ id: "admin1" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 404 when user not found", async () => {
    allow()
    vi.mocked(db.user.findUnique).mockResolvedValue(null)

    const res = await PATCH(req({ role: "user" }), {
      params: Promise.resolve({ id: "nonexistent" }),
    })
    expect(res.status).toBe(404)
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await PATCH(req({ role: "user" }), {
      params: Promise.resolve({ id: "u1" }),
    })
    expect(res.status).toBe(401)
  })
})

describe("DELETE /api/admin/users/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes a user", async () => {
    allow()
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser)
    vi.mocked(db.user.delete).mockResolvedValue({} as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await DELETE(new Request("http://localhost:3000/api/admin/users/u1"), {
      params: Promise.resolve({ id: "u1" }),
    })
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it("prevents self-deletion", async () => {
    allow()
    const res = await DELETE(new Request("http://localhost:3000/api/admin/users/admin1"), {
      params: Promise.resolve({ id: "admin1" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 404 when user not found", async () => {
    allow()
    vi.mocked(db.user.findUnique).mockResolvedValue(null)

    const res = await DELETE(new Request("http://localhost:3000/api/admin/users/nonexistent"), {
      params: Promise.resolve({ id: "nonexistent" }),
    })
    expect(res.status).toBe(404)
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await DELETE(new Request("http://localhost:3000/api/admin/users/u1"), {
      params: Promise.resolve({ id: "u1" }),
    })
    expect(res.status).toBe(401)
  })
})
