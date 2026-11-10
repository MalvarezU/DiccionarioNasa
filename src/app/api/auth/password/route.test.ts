import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
  compare: vi.fn(),
  hash: vi.fn(),
}))

import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { __resetRateLimitStore } from "@/lib/rate-limit"
import { POST } from "./route"
import { jsonRequest } from "@/test/factories/request"

const session = { user: { id: "u1" } }
const authed = { session: session as never, error: null }
const unauthedMessage = "Debes iniciar sesión para acceder a este recurso"

function makeRequest(body: unknown) {
  return jsonRequest("http://localhost:3000/api/auth/password", body)
}

describe("POST /api/auth/password", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitStore()
    vi.mocked(requireAuth).mockResolvedValue(authed)
  })

  it("crea la contraseña cuando el usuario no tiene (hash cost 12)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      password: null,
    } as never)
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-12" as never)
    vi.mocked(db.user.update).mockResolvedValue({} as never)

    const res = await POST(makeRequest({ password: "nueva1234" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(bcrypt.hash).toHaveBeenCalledWith("nueva1234", 12)
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ password: "hashed-12" }),
      })
    )
  })

  it("rechaza con 400 si el usuario ya tiene contraseña", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      password: "vieja-hash",
    } as never)

    const res = await POST(makeRequest({ password: "nueva1234" }))

    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain("Ya tienes una contraseña")
    expect(bcrypt.hash).not.toHaveBeenCalled()
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it("rechaza sin sesión con el error de requireAuth (401)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: null,
      error: Response.json({ message: unauthedMessage }, { status: 401 }),
    })

    const res = await POST(makeRequest({ password: "nueva1234" }))

    expect(res.status).toBe(401)
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })

  it("rechaza contraseña corta (< 8)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      password: null,
    } as never)

    const res = await POST(makeRequest({ password: "corta" }))

    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain("8 caracteres")
    expect(bcrypt.hash).not.toHaveBeenCalled()
  })

  it("devuelve 404 si el usuario de la sesión ya no existe", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)

    const res = await POST(makeRequest({ password: "nueva1234" }))

    expect(res.status).toBe(404)
  })

  it("aplica rate-limit 5/min por IP", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      password: null,
    } as never)
    vi.mocked(bcrypt.hash).mockResolvedValue("h" as never)
    vi.mocked(db.user.update).mockResolvedValue({} as never)

    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ password: "nueva1234" }))
    }
    const limited = await POST(makeRequest({ password: "nueva1234" }))
    expect(limited.status).toBe(429)
  })
})
