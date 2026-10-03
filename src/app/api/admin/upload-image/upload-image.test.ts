import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/db", () => ({
  db: { mediaAsset: { create: vi.fn(), findUnique: vi.fn() } },
}))

import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { POST } from "./route"

const pngBytes = () =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

function archivo(nombre: string, bytes: Uint8Array, type = "image/png"): File {
  return new File([bytes as unknown as BlobPart], nombre, { type })
}

/** La ruta solo usa `request.formData()`; alcanza con eso. */
function peticion(file: File | null): Request {
  const fd = new FormData()
  if (file) fd.append("file", file)
  return { formData: async () => fd } as unknown as Request
}

const editorOk = {
  session: { user: { id: "e1", role: "editor" }, expires: "2099-01-01T00:00:00Z" },
  error: null,
}

describe("POST /api/admin/upload-image", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue(editorOk as never)
  })

  it("exige rol editor", async () => {
    const denegado = Response.json({ message: "Acceso denegado" }, { status: 403 })
    vi.mocked(requireRole).mockResolvedValue({ session: null, error: denegado } as never)

    const res = await POST(peticion(archivo("x.png", pngBytes())))
    expect(res.status).toBe(403)
    expect(db.mediaAsset.create).not.toHaveBeenCalled()
  })

  it("rechaza si no hay archivo", async () => {
    const res = await POST(peticion(null))
    expect(res.status).toBe(400)
    expect(db.mediaAsset.create).not.toHaveBeenCalled()
  })

  it("rechaza SVG disfrazado y no guarda nada", async () => {
    const svg = new TextEncoder().encode("<svg><script>alert(1)</script></svg>")
    const res = await POST(peticion(archivo("inocente.png", svg)))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.message).toMatch(/SVG/)
    expect(db.mediaAsset.create).not.toHaveBeenCalled()
  })

  it("rechaza contenido que no es imagen", async () => {
    const res = await POST(peticion(archivo("x.png", new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))))
    expect(res.status).toBe(400)
    expect(db.mediaAsset.create).not.toHaveBeenCalled()
  })

  it("guarda la imagen con el MIME detectado y devuelve la URL de /api/media", async () => {
    vi.mocked(db.mediaAsset.create).mockResolvedValue({
      id: "m1",
      filename: "foto.png",
      mimeType: "image/png",
      size: 12,
    } as never)

    const res = await POST(peticion(archivo("foto.png", pngBytes())))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toBe("/api/media/m1")
    expect(db.mediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          filename: "foto.png",
          mimeType: "image/png",
          size: 12,
          uploadedBy: "e1",
        }),
      })
    )
  })

  it("no confía en el MIME declarado: guarda el detectado", async () => {
    vi.mocked(db.mediaAsset.create).mockResolvedValue({
      id: "m2",
      filename: "x.bin",
      mimeType: "image/png",
      size: 12,
    } as never)

    // El cliente declara text/html pero el contenido es un PNG real.
    await POST(peticion(archivo("x.png", pngBytes(), "text/html")))

    const arg = vi.mocked(db.mediaAsset.create).mock.calls[0]![0] as {
      data: { mimeType: string }
    }
    expect(arg.data.mimeType).toBe("image/png")
  })

  it("devuelve 500 si la base falla", async () => {
    vi.mocked(db.mediaAsset.create).mockRejectedValue(new Error("boom"))
    const res = await POST(peticion(archivo("foto.png", pngBytes())))
    expect(res.status).toBe(500)
  })
})
