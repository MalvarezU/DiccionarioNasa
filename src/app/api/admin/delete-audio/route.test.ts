import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}))

const mockDeleteObject = vi.fn()

vi.mock("@/lib/r2", () => ({
  putObject: vi.fn(),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}))

import { requireAdmin, requireRole } from "@/lib/auth"
import { POST } from "./route"

const R2_URL = "https://cdn.test/audios/temp/file.mp3"
const LEGACY_PUBLIC =
  "https://rjdukxvhmvzbiqliakyu.supabase.co/storage/v1/object/public/audios/temp/file.mp3"
const LEGACY_SIGNED =
  "https://xyz.supabase.co/storage/v1/object/sign/audios/temp/file.mp3?token=abc"

// Nota: la ruta usa el audioRefToKey REAL (@/lib/media/storage); solo R2 va mockeado.
process.env.R2_PUBLIC_BASE_URL = "https://cdn.test"

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
    mockDeleteObject.mockResolvedValue(undefined)
  })

  it("deletes audio from R2 by public URL", async () => {
    const res = await POST(makeReq({ audioUrl: R2_URL }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toContain("eliminado")
    expect(body.objectKey).toBe("audios/temp/file.mp3")
    expect(mockDeleteObject).toHaveBeenCalledWith("audios/temp/file.mp3")
  })

  it("accepts legacy Supabase public URL", async () => {
    const res = await POST(makeReq({ audioUrl: LEGACY_PUBLIC }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.objectKey).toBe("audios/temp/file.mp3")
  })

  it("accepts legacy Supabase signed URL", async () => {
    const res = await POST(makeReq({ audioUrl: LEGACY_SIGNED }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.objectKey).toBe("audios/temp/file.mp3")
  })

  it("accepts objectKey directly", async () => {
    const res = await POST(makeReq({ objectKey: "audios/temp/file.mp3" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.objectKey).toBe("audios/temp/file.mp3")
  })

  it("normalizes bare relative path with audios/ prefix", async () => {
    const res = await POST(makeReq({ objectPath: "temp/file.mp3" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.objectKey).toBe("audios/temp/file.mp3")
  })

  it("returns 400 when audioUrl is missing", async () => {
    expect((await POST(makeReq({}))).status).toBe(400)
  })

  it("returns 400 when audioUrl is not a string", async () => {
    expect((await POST(makeReq({ audioUrl: 123 }))).status).toBe(400)
  })

  it("returns 400 when reference cannot be resolved", async () => {
    expect((await POST(makeReq({ audioUrl: "/audio/test.mp3" }))).status).toBe(400)
    expect(mockDeleteObject).not.toHaveBeenCalled()
  })

  it("returns 500 when R2 delete fails", async () => {
    mockDeleteObject.mockRejectedValue(new Error("R2 caído"))
    expect((await POST(makeReq({ audioUrl: R2_URL }))).status).toBe(500)
  })

  it("returns 401 when not editor", async () => {
    deny()
    expect((await POST(makeReq({ audioUrl: R2_URL }))).status).toBe(401)
  })
})
