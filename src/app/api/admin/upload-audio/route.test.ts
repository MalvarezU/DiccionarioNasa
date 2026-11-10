import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}))

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    mediaAsset: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  }
  // La ruta usa `db.$transaction(async (tx) => ...)`: el mock ejecuta el
  // callback con el propio db mockeado como `tx`.
  db.$transaction = vi.fn(async (fn: unknown) =>
    typeof fn === "function" ? (fn as (tx: unknown) => unknown)(db) : fn
  )
  return { db }
})

vi.mock("@/lib/content-version", () => ({
  bumpContentVersion: vi.fn(),
  getContentVersion: vi.fn(),
}))

const mockPutObject = vi.fn()
const mockDeleteObject = vi.fn()

vi.mock("@/lib/r2", () => ({
  putObject: (...args: unknown[]) => mockPutObject(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}))

import { requireAdmin, requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"
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

const MP3_BYTES = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 1, 2, 3])
const WAV_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45,
])
const OGG_BYTES = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0])

function createMockRequest(fileName: string, mimeType: string, content: string | Uint8Array<ArrayBuffer>): Request {
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
    mockDeleteObject.mockResolvedValue(undefined)
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

  it("uploads audio to R2, crea la fila MediaAsset y hace bump", async () => {
    vi.mocked(db.mediaAsset.create).mockResolvedValue({ id: "a1" } as never)
    const req = createMockRequest("test.mp3", "audio/mpeg", MP3_BYTES)
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
    // T06: cierra la brecha de inventario.
    expect(vi.mocked(db.mediaAsset.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ objectKey: key, filename: "test.mp3", mimeType: "audio/mpeg" }),
      })
    )
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("si la base falla compensa (borra R2), responde 500 y no hace bump", async () => {
    vi.mocked(db.mediaAsset.create).mockRejectedValueOnce(new Error("BD caída"))
    const req = createMockRequest("test.mp3", "audio/mpeg", MP3_BYTES)
    const res = await POST(req)
    expect(res.status).toBe(500)
    expect(mockDeleteObject).toHaveBeenCalledTimes(1)
    expect(bumpContentVersion).not.toHaveBeenCalled()
  })

  it("rejects valid extension with spoofed mime", async () => {
    const req = createMockRequest("test.mp3", "application/x-msdownload", "fake")
    expect((await POST(req)).status).toBe(400)
  })

  it("accepts generic octet-stream mime with valid extension", async () => {
    const req = createMockRequest("test.mp3", "application/octet-stream", MP3_BYTES)
    expect((await POST(req)).status).toBe(200)
  })

  it("rejects binary garbage even with valid extension and mime", async () => {
    const req = createMockRequest("test.mp3", "audio/mpeg", "esto no es audio ni de lejos")
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/no es un audio/)
    expect(mockPutObject).not.toHaveBeenCalled()
  })

  it("rejects extension that does not match the detected content", async () => {
    const req = createMockRequest("test.wav", "audio/wav", MP3_BYTES)
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/no coincide/)
    expect(mockPutObject).not.toHaveBeenCalled()
  })

  it("returns 500 when R2 upload fails", async () => {
    mockPutObject.mockRejectedValue(new Error("R2 caído"))

    const req = createMockRequest("test.mp3", "audio/mpeg", MP3_BYTES)
    expect((await POST(req)).status).toBe(500)
  })
})
