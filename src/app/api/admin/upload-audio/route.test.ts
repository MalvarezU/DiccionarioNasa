import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

const mockUpload = vi.fn()
const mockCreateSignedUrl = vi.fn()

const mockSupabaseClient = {
  storage: {
    from: vi.fn(() => ({
      upload: mockUpload,
      createSignedUrl: mockCreateSignedUrl,
      remove: vi.fn(),
    })),
  },
  auth: { admin: {} },
}

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServer: vi.fn(() => mockSupabaseClient),
  AUDIO_BUCKET: "audios",
  audioObjectPath: vi.fn(() => "temp/test.mp3"),
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
    mockUpload.mockReset()
    mockCreateSignedUrl.mockReset()
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

  it("uploads audio and returns signed URL", async () => {
    mockUpload.mockResolvedValue({ error: null })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://supabase.co/storage/v1/object/sign/audios/temp/test.mp3?token=abc" },
      error: null,
    })

    const req = createMockRequest("test.mp3", "audio/mpeg", "fake")
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.audioUrl).toContain("supabase.co")
    expect(body.objectPath).toBe("temp/test.mp3")
  })

  it("returns 500 when upload fails", async () => {
    mockUpload.mockResolvedValue({ error: new Error("Storage quota exceeded") })

    const req = createMockRequest("test.mp3", "audio/mpeg", "fake")
    const res = await POST(req)

    expect(res.status).toBe(500)
  })

  it("returns 500 when signed URL generation fails", async () => {
    mockUpload.mockResolvedValue({ error: null })
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error("Invalid URL") })

    const req = createMockRequest("test.mp3", "audio/mpeg", "fake")
    const res = await POST(req)

    expect(res.status).toBe(500)
  })
})
