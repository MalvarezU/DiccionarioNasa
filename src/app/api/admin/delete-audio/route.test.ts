import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

const mockRemove = vi.fn()

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServer: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        remove: mockRemove,
      })),
    },
  })),
  AUDIO_BUCKET: "audios",
  signedUrlToObjectPath: vi.fn((url: string) => {
    if (url === "https://supabase.co/storage/v1/object/sign/audios/temp/file.mp3?token=abc") {
      return "temp/file.mp3"
    }
    return null
  }),
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
    mockRemove.mockReset()
  })

  it("deletes audio from Supabase Storage", async () => {
    mockRemove.mockResolvedValue({ error: null })

    const res = await POST(makeReq({
      audioUrl: "https://supabase.co/storage/v1/object/sign/audios/temp/file.mp3?token=abc",
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toContain("eliminado")
    expect(body.objectPath).toBe("temp/file.mp3")
  })

  it("returns 400 when audioUrl is missing", async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it("returns 400 when audioUrl is not a string", async () => {
    const res = await POST(makeReq({ audioUrl: 123 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when audioUrl is not a valid Supabase signed URL", async () => {
    const res = await POST(makeReq({ audioUrl: "/audio/test.mp3" }))
    expect(res.status).toBe(400)
  })

  it("returns 500 when remove fails", async () => {
    mockRemove.mockResolvedValue({ error: new Error("Storage error") })

    const res = await POST(makeReq({
      audioUrl: "https://supabase.co/storage/v1/object/sign/audios/temp/file.mp3?token=abc",
    }))

    expect(res.status).toBe(500)
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await POST(makeReq({
      audioUrl: "https://supabase.co/storage/v1/object/sign/audios/temp/file.mp3?token=abc",
    }))
    expect(res.status).toBe(401)
  })
})
