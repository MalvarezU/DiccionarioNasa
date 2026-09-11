import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
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
  getPublicAudioUrl: vi.fn(
    (p: string) => `https://rjdukxvhmvzbiqliakyu.supabase.co/storage/v1/object/public/audios/${p}`
  ),
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

  it("uploads audio and returns permanent public URL", async () => {
    mockUpload.mockResolvedValue({ error: null })

    const req = createMockRequest("test.mp3", "audio/mpeg", "fake")
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.audioUrl).toContain("/storage/v1/object/public/audios/temp/test.mp3")
    expect(body.audioUrl).not.toContain("/object/sign/")
    expect(body.objectPath).toBe("temp/test.mp3")
  })

  it("rejects valid extension with spoofed mime", async () => {
    const req = createMockRequest("test.mp3", "application/x-msdownload", "fake")
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("accepts generic octet-stream mime with valid extension", async () => {
    mockUpload.mockResolvedValue({ error: null })

    const req = createMockRequest("test.mp3", "application/octet-stream", "fake")
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it("returns 500 when upload fails", async () => {
    mockUpload.mockResolvedValue({ error: new Error("Storage quota exceeded") })

    const req = createMockRequest("test.mp3", "audio/mpeg", "fake")
    const res = await POST(req)

    expect(res.status).toBe(500)
  })
})
