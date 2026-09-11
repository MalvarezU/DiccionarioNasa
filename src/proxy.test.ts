import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}))

import { getToken } from "next-auth/jwt"
import { proxy } from "./proxy"
import { urlRequest } from "@/test/factories/request"
import { __resetRateLimitStore } from "@/lib/rate-limit"

function adminRequest(cookie?: string) {
  return new NextRequest("http://localhost:3000/admin", {
    headers: cookie ? { cookie } : {},
  })
}

describe("proxy /admin (B1.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret-b16")
  })

  it("deja pasar al admin", async () => {
    vi.mocked(getToken).mockResolvedValue({ role: "admin" } as never)
    const res = await proxy(adminRequest())
    // NextResponse.next() no es redirect
    expect(res.status).toBe(200)
    expect(res.headers.get("location")).toBeNull()
  })

  it("sin sesion y sin cookie pide login (auth=required)", async () => {
    vi.mocked(getToken).mockResolvedValue(null)
    const res = await proxy(adminRequest())
    expect(res.headers.get("location")).toContain("auth=required")
  })

  it("con cookie pero token invalido indica sesion expirada (auth=expired)", async () => {
    vi.mocked(getToken).mockResolvedValue(null)
    const res = await proxy(
      adminRequest("next-auth.session-token=stale-value")
    )
    expect(res.headers.get("location")).toContain("auth=expired")
  })

  it("no-admin es denegado (auth=denied)", async () => {
    vi.mocked(getToken).mockResolvedValue({ role: "user" } as never)
    const res = await proxy(adminRequest())
    expect(res.headers.get("location")).toContain("auth=denied")
  })

  it("editor entra al panel (B1.5)", async () => {
    vi.mocked(getToken).mockResolvedValue({ role: "editor" } as never)
    const res = await proxy(adminRequest())
    expect(res.status).toBe(200)
    expect(res.headers.get("location")).toBeNull()
  })

  it("rutas fuera de /admin pasan sin verificar", async () => {
    const res = await proxy(urlRequest("http://localhost:3000/juegos"))
    expect(vi.mocked(getToken)).not.toHaveBeenCalled()
    expect(res.headers.get("location")).toBeNull()
  })

  it("falla en voz alta sin NEXTAUTH_SECRET", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "")
    vi.mocked(getToken).mockResolvedValue(null)
    await expect(proxy(adminRequest())).rejects.toThrow("NEXTAUTH_SECRET")
  })
})

describe("proxy rate-limit login (B1.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret-b16")
    __resetRateLimitStore()
  })

  function loginPost() {
    return new NextRequest("http://localhost:3000/api/auth/callback/credentials", {
      method: "POST",
    })
  }

  it("permite 20 POST/min y frena el 21 con 429", async () => {
    for (let i = 0; i < 20; i++) {
      const res = await proxy(loginPost())
      expect(res.status).toBe(200)
    }
    const blocked = await proxy(loginPost())
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get("Retry-After")).not.toBeNull()
    expect(vi.mocked(getToken)).not.toHaveBeenCalled()
  })

  it("el polling GET /api/auth/session pasa sin verificar ni limitar", async () => {
    const res = await proxy(
      urlRequest("http://localhost:3000/api/auth/session")
    )
    expect(res.status).toBe(200)
    expect(vi.mocked(getToken)).not.toHaveBeenCalled()
  })
})
