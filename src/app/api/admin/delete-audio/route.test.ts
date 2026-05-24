import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

import { requireAdmin } from "@/lib/auth"
import { POST } from "./route"

const adminSession = { user: { id: "admin1", role: "admin" } } as never

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

function makeReq(body: object): Request {
  return new Request("http://localhost:3000/api/admin/delete-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/admin/delete-audio", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    allow()
  })

  // Note: fs/promises unlink is the real function (not mocked).
  // In the test environment the file won't exist, so unlink throws ENOENT,
  // hitting the "no encontrado" branch.

  it("handles file-not-found gracefully (no-op)", async () => {
    const res = await POST(makeReq({ audioUrl: "/audio/test.mp3" }))
    const body = await res.json()

    expect(body.message).toContain("no encontrado")
  })

  it("returns 400 when audioUrl is missing", async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it("returns 400 when audioUrl is not a string", async () => {
    const res = await POST(makeReq({ audioUrl: 123 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when audioUrl is outside /audio/", async () => {
    const res = await POST(makeReq({ audioUrl: "/config/passwords.txt" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when audioUrl tries path traversal", async () => {
    const res = await POST(makeReq({ audioUrl: "/audio/../../.env" }))
    expect(res.status).toBe(400)
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await POST(makeReq({ audioUrl: "/audio/test.mp3" }))
    expect(res.status).toBe(401)
  })
})
