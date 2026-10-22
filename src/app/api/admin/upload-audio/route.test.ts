import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}))

const mockPutObject = vi.fn()

vi.mock("@/lib/r2", () => ({
  putObject: (...args: unknown[]) => mockPutObject(...args),
  deleteObject: vi.fn(),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}))

import { requireAdmin, requireRole } from "@/lib/auth"
import { POST } from "./route"

const adminSession = { user: { id: "admin1", role: "admin" } } as never
const editorSession = { user: { id: "editor1", role: "editor" } } as never

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
  vi.mocked(requireRole).mockResolvedValue({ session: editorSession, error: null })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
  vi.mocked(requireRole).mockResolvedValue({
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
    mockPutObject.mockResolvedValue(undefined)
  })

  it("rejects non-audio file types", async () => {
    const req = createMockRequest("malware.exe", "application/x-msdownload", "bad")
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(mockPutObject).not.toHaveBeenCalled()
  })

  it("rejects file without audio extension even with correct mime", async () => {
    const req = createMockRequest("evil.txt", "audio/mpeg", "fake")
    expect((await POST(req)).status).toBe(400)
  })

  it("rejects files > 10 MB", async () => {
    const bigContent = "x".repeat(11 * 1024 * 1024)
    const req = createMockRequest("big.mp3", "audio/mpeg", bigContent)
    expect((await POST(req)).status).toBe(400)
  })

  it("returns 400 when no file provided", async () => {
    expect((await POST(createEmptyRequest())).status).toBe(400)
  })

  it("returns 401 when not editor", async () => {
    deny()
    const req = createMockRequest("test.mp3", "audio/mpeg", "content")
    expect((await POST(req)).status).toBe(401)
  })

  it("uploads audio to R2 and returns permanent public URL", async () => {
    const req = createMockRequest("test.mp3", "audio/mpeg", "fake")
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockPutObject).toHaveBeenCalledTimes(1)
    const [key, , contentType] = mockPutObject.mock.calls[0] as [string, unknown, string]
    expect(key).toMatch(/^audios\/temp\/\d+-test\.mp3$/)
    expect(contentType).toBe("audio/mpeg")
    expect(body.audioUrl).toBe(`https://cdn.test/${key}`)
    expect(body.audioUrl).not.toContain("/object/sign/")
    expect(body.objectKey).toBe(key)
  })

  it("rejects valid extension with spoofed mime", async () => {
    const req = createMockRequest("test.mp3", "application/x-msdownload", "fake")
    expect((await POST(req)).status).toBe(400)
  })

  it("accepts generic octet-stream mime with valid extension", async () => {
    const req = createMockRequest("test.mp3", "application/octet-stream", "fake")
    expect((await POST(req)).status).toBe(200)
  })

  it("returns 500 when R2 upload fails", async () => {
    mockPutObject.mockRejectedValue(new Error("R2 caído"))

    const req = createMockRequest("test.mp3", "audio/mpeg", "fake")
    expect((await POST(req)).status).toBe(500)
  })
})
