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

function makeRequest(body: unknown) {
  return jsonRequest("http://localhost:3000/api/auth/password/change", body)
}

describe("POST /api/auth/password/change", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitStore()
    vi.mocked(requireAuth).mockResolvedValue(authed)
  })

  it("cambia la contraseña con la actual correcta (hash cost 12)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      password: "vieja-hash",
    } as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    vi.mocked(bcrypt.hash).mockResolvedValue("nueva-hash" as never)
    vi.mocked(db.user.update).mockResolvedValue({} as never)

    const res = await POST(
      makeRequest({ currentPassword: "vieja1234", newPassword: "nueva1234" })
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(bcrypt.compare).toHaveBeenCalledWith("vieja1234", "vieja-hash")
    expect(bcrypt.hash).toHaveBeenCalledWith("nueva1234", 12)
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ password: "nueva-hash" }),
      })
    )
  })

  it("rechaza 400 con password null (primero debe crearla)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      password: null,
    } as never)

    const res = await POST(
      makeRequest({ currentPassword: "cualquiera", newPassword: "nueva1234" })
    )

    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain("Crea una primero")
    expect(bcrypt.hash).not.toHaveBeenCalled()
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it("rechaza 401 con la actual incorrecta", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      password: "vieja-hash",
    } as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

    const res = await POST(
      makeRequest({ currentPassword: "mal12345", newPassword: "nueva1234" })
    )

    expect(res.status).toBe(401)
    expect((await res.json()).message).toContain("actual es incorrecta")
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it("rechaza nueva corta (< 8) sin tocar la BD", async () => {
    const res = await POST(
      makeRequest({ currentPassword: "vieja1234", newPassword: "corta" })
    )

    expect(res.status).toBe(400)
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })

  it("rechaza sin sesión con 401", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: null,
      error: Response.json({ message: "Debes iniciar sesión" }, { status: 401 }),
    })

    const res = await POST(
      makeRequest({ currentPassword: "vieja1234", newPassword: "nueva1234" })
    )

    expect(res.status).toBe(401)
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })

  it("devuelve 404 si el usuario de la sesión ya no existe", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)

    const res = await POST(
      makeRequest({ currentPassword: "vieja1234", newPassword: "nueva1234" })
    )

    expect(res.status).toBe(404)
  })

  it("aplica rate-limit 5/min por IP", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      password: "vieja-hash",
    } as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    vi.mocked(bcrypt.hash).mockResolvedValue("h" as never)
    vi.mocked(db.user.update).mockResolvedValue({} as never)

    for (let i = 0; i < 5; i++) {
      await POST(
        makeRequest({ currentPassword: "vieja1234", newPassword: "nueva1234" })
      )
    }
    const limited = await POST(
      makeRequest({ currentPassword: "vieja1234", newPassword: "nueva1234" })
    )
    expect(limited.status).toBe(429)
  })
})
