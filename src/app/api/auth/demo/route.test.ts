import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
}))

import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { POST } from "./route"

describe("POST /api/auth/demo", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates demo user when it does not exist", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed" as never)
    vi.mocked(db.user.create).mockResolvedValue({} as never)

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toBe("Demo user created")
    expect(body.email).toBe("demo@nasayuwe.com")
    expect(body.password).toBe("demo123")
    expect(bcrypt.hash).toHaveBeenCalledWith("demo123", 10)
  })

  it("returns existing demo user info when already exists", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "demo",
      email: "demo@nasayuwe.com",
    } as never)

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toBe("Demo user already exists")
    expect(body.email).toBe("demo@nasayuwe.com")
    expect(body.password).toBe("demo123")
    expect(bcrypt.hash).not.toHaveBeenCalled()
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it("creates demo user with correct data", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed" as never)
    vi.mocked(db.user.create).mockResolvedValue({} as never)

    await POST()

    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "demo@nasayuwe.com",
          name: "Usuario Demo",
          role: "user",
        }),
      })
    )
  })

  it("returns 500 on database error", async () => {
    vi.mocked(db.user.findUnique).mockRejectedValue(new Error("DB error"))

    const res = await POST()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.message).toContain("Error creating demo user")
  })
})