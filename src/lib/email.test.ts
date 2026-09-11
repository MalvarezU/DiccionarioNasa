import { describe, it, expect, vi, beforeEach } from "vitest"
import { appBaseUrl, sendEmail } from "./email"

describe("email [B1.2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    global.fetch = vi.fn()
  })

  it("sin key no envía y avisa (desarrollo)", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    const out = await sendEmail({ to: "a@x.com", subject: "H", html: "<p>x</p>" })
    expect(out.sent).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("envía vía Resend con remitente Piiyaak", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ id: "mail1" }) as never
    )
    const out = await sendEmail({ to: "a@x.com", subject: "Verifica", html: "<p>x</p>" })
    expect(out).toEqual({ sent: true, id: "mail1" })
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_test" }),
      })
    )
  })

  it("reporta fallo del proveedor sin lanzar", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.mocked(global.fetch).mockResolvedValue(
      new Response("rate limited", { status: 429 })
    )
    const out = await sendEmail({ to: "a@x.com", subject: "H", html: "x" })
    expect(out.sent).toBe(false)
  })

  it("base URL prefiere NEXTAUTH_URL", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://piiyaak.com/")
    expect(appBaseUrl("http://localhost:3000/x")).toBe("https://piiyaak.com")
  })
})
