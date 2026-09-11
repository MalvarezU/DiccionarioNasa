import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}))

import { getToken } from "next-auth/jwt"
import { proxy } from "./proxy"
import { urlRequest } from "@/test/factories/request"

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
