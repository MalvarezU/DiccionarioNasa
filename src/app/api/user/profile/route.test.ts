import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: { update: vi.fn() },
  },
}))

import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import { PATCH } from "./route"
import { jsonRequest } from "@/test/factories/request"

const session = { user: { id: "u1" } }
const authed = { session: session as never, error: null }

function makeRequest(body: unknown) {
  return jsonRequest("http://localhost:3000/api/user/profile", body, "PATCH")
}

describe("PATCH /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(authed)
  })

  it("actualiza el nombre y devuelve { id, email, name }", async () => {
    vi.mocked(db.user.update).mockResolvedValue({
      id: "u1",
      email: "g@x.com",
      name: "Nuevo Nombre",
    } as never)

    const res = await PATCH(makeRequest({ name: "  Nuevo Nombre  " }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      user: { id: "u1", email: "g@x.com", name: "Nuevo Nombre" },
    })
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ name: "Nuevo Nombre" }),
      })
    )
  })

  it("rechaza vacío o solo espacios (400)", async () => {
    for (const name of ["", "   "]) {
      const res = await PATCH(makeRequest({ name }))
      expect(res.status).toBe(400)
      expect((await res.json()).message).toContain("1 y 100")
    }
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it("rechaza nombre de más de 100 caracteres (400)", async () => {
    const res = await PATCH(makeRequest({ name: "a".repeat(101) }))

    expect(res.status).toBe(400)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it("acepta nombre de exactamente 100 caracteres (borde)", async () => {
    const full = "a".repeat(100)
    vi.mocked(db.user.update).mockResolvedValue({
      id: "u1",
      email: "g@x.com",
      name: full,
    } as never)

    const res = await PATCH(makeRequest({ name: full }))

    expect(res.status).toBe(200)
  })

  it("rechaza nombre no-string (400)", async () => {
    const res = await PATCH(makeRequest({ name: 42 }))

    expect(res.status).toBe(400)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it("rechaza sin sesión con 401", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: null,
      error: Response.json({ message: "Debes iniciar sesión" }, { status: 401 }),
    })

    const res = await PATCH(makeRequest({ name: "Alguien" }))

    expect(res.status).toBe(401)
    expect(db.user.update).not.toHaveBeenCalled()
  })
})
