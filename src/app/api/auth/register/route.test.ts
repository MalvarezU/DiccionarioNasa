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

function makeRequest(body: unknown) {
  return {
    json: async () => body,
  } as never
}

describe("POST /api/auth/register", () => {
  beforeEach(() => vi.clearAllMocks())

  it("registers a new user successfully", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-pw" as never)
    vi.mocked(db.user.create).mockResolvedValue({
      id: "u1",
      email: "test@example.com",
      name: "Test User",
      password: "hashed-pw",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)

    const res = await POST(
      makeRequest({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.user.email).toBe("test@example.com")
    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10)
  })

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({ password: "password123" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toContain("Email")
  })

  it("returns 400 when password is missing", async () => {
    const res = await POST(makeRequest({ email: "test@example.com" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toContain("contraseña")
  })

  it("returns 400 when password is too short (< 6 chars)", async () => {
    const res = await POST(
      makeRequest({ email: "test@example.com", password: "12345" })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toContain("6 caracteres")
  })

  it("returns 409 when email already exists", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "existing",
      email: "test@example.com",
    } as never)

    const res = await POST(
      makeRequest({ email: "test@example.com", password: "password123" })
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.message).toContain("existe")
  })

  it("sets name to null when not provided", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-pw" as never)
    vi.mocked(db.user.create).mockResolvedValue({
      id: "u1",
      email: "test@example.com",
      name: null,
      password: "hashed-pw",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)

    await POST(
      makeRequest({ email: "test@example.com", password: "password123" })
    )

    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: null }),
      })
    )
  })

  it("assigns role 'user' by default", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-pw" as never)
    vi.mocked(db.user.create).mockResolvedValue({
      id: "u1",
      email: "test@example.com",
      name: null,
      password: "hashed-pw",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)

    await POST(
      makeRequest({
        email: "test@example.com",
        password: "password123",
        name: "Test",
      })
    )

    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "user" }),
      })
    )
  })

  it("returns 500 on database error", async () => {
    vi.mocked(db.user.findUnique).mockRejectedValue(new Error("DB error"))

    const res = await POST(
      makeRequest({ email: "test@example.com", password: "password123" })
    )
    expect(res.status).toBe(500)
  })

  it("does not hash password when validation fails", async () => {
    const res = await POST(makeRequest({ email: "", password: "" }))
    expect(res.status).toBe(400)
    expect(bcrypt.hash).not.toHaveBeenCalled()
  })
})