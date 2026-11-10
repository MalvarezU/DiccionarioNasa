import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"
import { __resetRateLimitStore } from "@/lib/rate-limit"
import { POST } from "./route"
import { jsonRequest } from "@/test/factories/request"

function makeRequest(body: unknown) {
  return jsonRequest("http://localhost:3000/api/auth/register", body)
}

describe("POST /api/auth/register (Google-first: registro con correo deshabilitado)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitStore()
  })

  it("responde 410 con mensaje en español", async () => {
    const res = await POST(
      makeRequest({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      })
    )
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.message).toContain("deshabilitado")
    expect(body.message).toContain("Google")
  })

  it("no crea usuarios (no toca la BD salvo rate-limit)", async () => {
    const res = await POST(
      makeRequest({ email: "nuevo@example.com", password: "password123" })
    )
    expect(res.status).toBe(410)
    expect(db.user.findUnique).not.toHaveBeenCalled()
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it("responde 410 para cualquier cuerpo (sin email, sin password, vacío)", async () => {
    for (const body of [{}, { password: "x" }, { email: "a@b.com" }]) {
      __resetRateLimitStore()
      const res = await POST(makeRequest(body))
      expect(res.status).toBe(410)
    }
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it("mantiene el rate-limit: 429 tras 10 intentos por minuto", async () => {
    for (let i = 0; i < 10; i++) {
      await POST(
        makeRequest({ email: `u${i}@example.com`, password: "password123" })
      )
    }

    const limited = await POST(
      makeRequest({ email: "otro@example.com", password: "password123" })
    )
    expect(limited.status).toBe(429)
  })
})
