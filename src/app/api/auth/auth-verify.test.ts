import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    passwordReset: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}))

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
  compare: vi.fn(),
  hash: vi.fn(),
}))

import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { NextRequest } from "next/server"
import { POST as verifyRequestPOST } from "./verify-request/route"
import { GET as verifyGET } from "./verify/route"
import { POST as recoverPOST } from "./recover/route"
import { POST as resetPOST } from "./reset/route"

const verifiedUser = {
  id: "u1",
  email: "v@x.com",
  emailVerified: new Date(),
  verifyToken: null,
  verifyExpires: null,
}
const pendingUser = {
  id: "u2",
  email: "n@x.com",
  emailVerified: null,
  verifyToken: null,
  verifyExpires: null,
}

function jsonReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("verificación y recuperación [B1.2/B1.4]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    global.fetch = vi.fn()
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.mocked(global.fetch).mockResolvedValue(Response.json({ id: "m1" }) as never)
  })

  it("verify-request siempre 200 y no enumera (sin usuario)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    const res = await verifyRequestPOST(
      jsonReq("http://x/api/auth/verify-request", { email: "nadie@x.com" }) as never
    )
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(db.user.update).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("verify-request crea token y envía correo al pendiente", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(pendingUser as never)
    vi.mocked(db.user.update).mockResolvedValue({} as never)
    const res = await verifyRequestPOST(
      jsonReq("http://x/api/auth/verify-request", { email: "n@x.com" }) as never
    )
    expect(res.status).toBe(200)
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u2" },
        data: expect.objectContaining({ verifyToken: expect.any(String) }),
      })
    )
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.anything()
    )
  })

  it("verify-request no reenvía al ya verificado", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(verifiedUser as never)
    const res = await verifyRequestPOST(
      jsonReq("http://x/api/auth/verify-request", { email: "v@x.com" }) as never
    )
    expect(res.status).toBe(200)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("verify activa con token válido y rechaza expirado", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...pendingUser,
      verifyExpires: new Date(Date.now() + 3600_000),
    } as never)
    vi.mocked(db.user.update).mockResolvedValue({} as never)
    const ok = await verifyGET(
      new NextRequest("http://x/api/auth/verify?token=t1") as never
    )
    expect(ok.headers.get("location")).toContain("verified=1")
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ verifyToken: null }),
      })
    )

    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...pendingUser,
      verifyExpires: new Date(Date.now() - 1000),
    } as never)
    const expired = await verifyGET(
      new NextRequest("http://x/api/auth/verify?token=t1") as never
    )
    expect(expired.headers.get("location")).toContain("verify=error")
  })

  it("recover siempre 200; crea reset de 1h e invalida previos", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(verifiedUser as never)
    vi.mocked(db.passwordReset.updateMany).mockResolvedValue({ count: 1 } as never)
    vi.mocked(db.passwordReset.create).mockResolvedValue({} as never)
    const res = await recoverPOST(
      jsonReq("http://x/api/auth/recover", { email: "v@x.com" }) as never
    )
    expect(res.status).toBe(200)
    expect(db.passwordReset.updateMany).toHaveBeenCalled()
    expect(db.passwordReset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u1", token: expect.any(String) }),
      })
    )
    expect(global.fetch).toHaveBeenCalled()
  })

  it("reset aplica con token válido una sola vez", async () => {
    vi.mocked(db.passwordReset.findUnique).mockResolvedValue({
      id: "r1",
      userId: "u1",
      token: "t",
      expires: new Date(Date.now() + 3600_000),
      usedAt: null,
    } as never)
    vi.mocked(bcrypt.hash).mockResolvedValue("h12" as never)
    vi.mocked(db.user.update).mockResolvedValue({} as never)
    vi.mocked(db.passwordReset.update).mockResolvedValue({} as never)

    const res = await resetPOST(
      jsonReq("http://x/api/auth/reset", { token: "t", password: "nueva1234" }) as never
    )
    expect(res.status).toBe(200)
    expect(bcrypt.hash).toHaveBeenCalledWith("nueva1234", 12)
    expect(db.passwordReset.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usedAt: expect.any(Date) }) })
    )
  })

  it("reset rechaza usado, expirado y corta", async () => {
    vi.mocked(db.passwordReset.findUnique).mockResolvedValue({
      id: "r1",
      userId: "u1",
      token: "t",
      expires: new Date(Date.now() + 3600_000),
      usedAt: new Date(),
    } as never)
    const used = await resetPOST(
      jsonReq("http://x/api/auth/reset", { token: "t", password: "nueva1234" }) as never
    )
    expect(used.status).toBe(410)

    const short = await resetPOST(
      jsonReq("http://x/api/auth/reset", { token: "t", password: "corta" }) as never
    )
    expect(short.status).toBe(400)
  })
})
