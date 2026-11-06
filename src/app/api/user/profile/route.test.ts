import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: { update: vi.fn(), findUnique: vi.fn() },
  },
}))

import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET, PATCH } from "./route"
import { jsonRequest } from "@/test/factories/request"

const session = { user: { id: "u1" } }
const authed = { session: session as never, error: null }
const unauthed = {
  session: null,
  error: Response.json({ message: "Debes iniciar sesión" }, { status: 401 }),
}

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

  it("rechaza nombre no-string tratado como ausente sin completeOnboarding (400)", async () => {
    const res = await PATCH(makeRequest({ name: 42 }))

    expect(res.status).toBe(400)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it("marca onboardedAt al completar onboarding con nombre", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ onboardedAt: null } as never)
    vi.mocked(db.user.update).mockResolvedValue({
      id: "u1",
      email: "g@x.com",
      name: "María",
    } as never)

    const res = await PATCH(makeRequest({ name: "María", completeOnboarding: true }))

    expect(res.status).toBe(200)
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ name: "María", onboardedAt: expect.any(Date) }),
      })
    )
  })

  it("omisión del onboarding marca onboardedAt sin tocar el nombre", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ onboardedAt: null } as never)
    vi.mocked(db.user.update).mockResolvedValue({
      id: "u1",
      email: "g@x.com",
      name: "Previo",
    } as never)

    const res = await PATCH(makeRequest({ completeOnboarding: true }))

    expect(res.status).toBe(200)
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.not.objectContaining({ name: expect.anything() }),
      })
    )
    expect(vi.mocked(db.user.update).mock.calls[0][0].data).toHaveProperty("onboardedAt")
  })

  it("completeOnboarding es idempotente: no pisa un onboardedAt existente", async () => {
    const existing = new Date("2026-01-01T00:00:00.000Z")
    vi.mocked(db.user.findUnique).mockResolvedValue({ onboardedAt: existing } as never)
    vi.mocked(db.user.update).mockResolvedValue({
      id: "u1",
      email: "g@x.com",
      name: "María",
    } as never)

    const res = await PATCH(makeRequest({ name: "María", completeOnboarding: true }))

    expect(res.status).toBe(200)
    const data = vi.mocked(db.user.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data).not.toHaveProperty("onboardedAt")
    expect(data).toHaveProperty("name", "María")
  })

  it("rechaza sin sesión con 401", async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauthed as never)

    const res = await PATCH(makeRequest({ name: "Alguien" }))

    expect(res.status).toBe(401)
    expect(db.user.update).not.toHaveBeenCalled()
  })
})

describe("GET /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(authed)
  })

  it("devuelve perfil con hasPassword y onboardedAt, sin hash", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "g@x.com",
      name: "María",
      password: "hash-secreto",
      onboardedAt: new Date("2026-02-01T00:00:00.000Z"),
    } as never)

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      user: {
        id: "u1",
        email: "g@x.com",
        name: "María",
        hasPassword: true,
        onboardedAt: "2026-02-01T00:00:00.000Z",
      },
    })
  })

  it("hasPassword false y onboardedAt null para cuenta solo-Google nueva", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "g@x.com",
      name: null,
      password: null,
      onboardedAt: null,
    } as never)

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      user: { id: "u1", email: "g@x.com", name: null, hasPassword: false, onboardedAt: null },
    })
  })

  it("rechaza sin sesión con 401", async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauthed as never)

    const res = await GET()

    expect(res.status).toBe(401)
  })

  it("devuelve 404 si el usuario no existe", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(404)
  })
})
