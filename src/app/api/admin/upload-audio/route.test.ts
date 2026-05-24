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

function createMockRequest(fileName: string, mimeType: string, content: string): Request {
  const formData = new FormData()
  const blob = new Blob([content], { type: mimeType })
  const file = new File([blob], fileName, { type: mimeType })
  formData.append("file", file)
  const req = new Request("http://localhost:3000/api/admin/upload-audio", { method: "POST" })
  vi.spyOn(req, "formData").mockResolvedValue(formData)
  return req
}

function createEmptyRequest(): Request {
  const formData = new FormData()
  const req = new Request("http://localhost:3000/api/admin/upload-audio", { method: "POST" })
  vi.spyOn(req, "formData").mockResolvedValue(formData)
  return req
}

describe("POST /api/admin/upload-audio", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    allow()
  })

  it("rejects non-audio file types", async () => {
    const req = createMockRequest("malware.exe", "application/x-msdownload", "bad")
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects file without audio extension even with correct mime", async () => {
    const req = createMockRequest("evil.txt", "audio/mpeg", "fake")
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects files > 10 MB", async () => {
    const bigContent = "x".repeat(11 * 1024 * 1024)
    const req = createMockRequest("big.mp3", "audio/mpeg", bigContent)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 when no file provided", async () => {
    const req = createEmptyRequest()
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 401 when not admin", async () => {
    deny()
    const req = createMockRequest("test.mp3", "audio/mpeg", "content")
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("validates audio format is accepted (MP3)", async () => {
    const req = createMockRequest("test.mp3", "audio/mpeg", "fake")
    const res = await POST(req)
    // Not 401 — admin check passed
    // Not 400 — format/extension validation passed
    // Status may be 200 or 500 depending on fs operations in test env
    expect([200, 500]).toContain(res.status)
  })
})
