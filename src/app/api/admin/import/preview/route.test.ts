import { vi, describe, it, expect, beforeEach } from "vitest"
import * as XLSX from "xlsx"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

// `read` real envuelto en spy: permite forzar un workbook sin hojas legibles
// en un solo caso sin perder el comportamiento real para el resto.
vi.mock("xlsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xlsx")>()
  return { ...actual, read: vi.fn(actual.read) }
})

import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { POST } from "./route"
import { __resetPreviewStore, storePreview, takePreview } from "./route"

const editorSession = { user: { id: "editor1", role: "editor" } } as never

function allow() {
  vi.mocked(requireRole).mockResolvedValue({ session: editorSession, error: null })
}

function xlsxFile(rows: Record<string, unknown>[], name = "corpus.xlsx"): File {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Hoja1")
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
  return new File([new Uint8Array(buf)], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

function formReq(file: File): Request {
  // OJO: se espía formData (patrón de upload-audio): el multipart real
  // jsdom↔undici no sobrevive al roundtrip en este entorno.
  const fd = new FormData()
  fd.append("file", file)
  const req = new Request("http://localhost:3000/api/admin/import/preview", {
    method: "POST",
  })
  vi.spyOn(req, "formData").mockResolvedValue(fd)
  return req
}

function xlsxRequest(rows: Record<string, unknown>[], name = "corpus.xlsx"): Request {
  return formReq(xlsxFile(rows, name))
}

describe("POST /api/admin/import/preview [B1.10]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetPreviewStore()
  })

  it("valida sin escribir y devuelve mapeo + token", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])

    const res = await POST(
      xlsxRequest([
        { Palabra_esp: "casa", Palabra_nyW: "ya:t", Estado: "PUBLICADA" },
        { Palabra_esp: "", Palabra_nyW: "" },
      ])
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(2)
    expect(body.valid).toBe(1)
    expect(body.invalid).toBe(1)
    expect(body.duplicates).toBe(0)
    expect(body.previewToken).toEqual(expect.any(String))
    expect(body.columns).toContainEqual({ header: "Palabra_esp", mapped: "spanish" })
    expect(db.dictionaryWord.create).toBeUndefined()
  })

  it("detecta duplicados por español", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([{ spanish: "Casa" }] as never)

    const res = await POST(xlsxRequest([{ Palabra_esp: "casa", Palabra_nyW: "ya:t" }]))
    const body = await res.json()

    expect(body.valid).toBe(0)
    expect(body.duplicates).toBe(1)
  })

  it("rechaza extension invalida y exige auth", async () => {
    allow()
    const bad = await POST(
      xlsxRequest([{ a: 1 }], "notas.txt")
    )
    expect(bad.status).toBe(400)

    vi.mocked(requireRole).mockResolvedValue({
      session: null,
      error: Response.json({ message: "No" }, { status: 401 }),
    })
    const denied = await POST(xlsxRequest([{ a: 1 }]))
    expect(denied.status).toBe(401)
  })

  it("rechaza archivo mayor a 5 MB antes de parsear", async () => {
    allow()
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.xlsx")
    const res = await POST(formReq(big))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe("El archivo no puede superar 5 MB")
    expect(XLSX.read).not.toHaveBeenCalled()
  })

  it("xlsx sin hojas legibles → 400", async () => {
    allow()
    vi.mocked(XLSX.read).mockReturnValueOnce({ SheetNames: [], Sheets: {} } as never)
    const res = await POST(xlsxRequest([{ Palabra_esp: "casa", Palabra_nyW: "ya:t" }]))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe("El archivo no tiene hojas legibles")
    expect(db.dictionaryWord.findMany).not.toHaveBeenCalled()
  })

  it("fallo que no es Error → mensaje genérico «Archivo ilegible»", async () => {
    allow()
    vi.mocked(XLSX.read).mockImplementationOnce(() => {
      throw "boom" // deliberadamente no-Error: cubre el fallback del catch
    })
    const res = await POST(xlsxRequest([{ Palabra_esp: "casa", Palabra_nyW: "ya:t" }]))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe("Archivo ilegible")
  })

  it("xlsx sin filas de datos → 400", async () => {
    allow()
    const res = await POST(xlsxRequest([]))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe("El archivo no tiene filas de datos")
  })

  it("máximo 2000 filas por importación → 400", async () => {
    allow()
    const filas = Array.from({ length: 2001 }, (_, i) => ({
      Palabra_esp: `palabra ${i}`,
      Palabra_nyW: "ya:t",
    }))
    const res = await POST(xlsxRequest(filas))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe("Máximo 2000 filas por importación")
  })

  it("formData roto o sin archivo usable → 400 pidiendo el archivo", async () => {
    allow()
    const url = "http://localhost:3000/api/admin/import/preview"
    // formData() rechaza → formData null
    const reqBad = new Request(url, { method: "POST" })
    vi.spyOn(reqBad, "formData").mockRejectedValue(new Error("boom"))
    const bad = await POST(reqBad)
    expect(bad.status).toBe(400)
    expect((await bad.json()).message).toBe("Sube un archivo .xlsx o .csv")

    // FormData sin campo `file` (raw === null)
    const reqEmpty = new Request(url, { method: "POST" })
    vi.spyOn(reqEmpty, "formData").mockResolvedValue(new FormData())
    const empty = await POST(reqEmpty)
    expect(empty.status).toBe(400)

    // campo `file` con valor no-archivo (string)
    const fd = new FormData()
    fd.append("file", "texto-plano")
    const reqStr = new Request(url, { method: "POST" })
    vi.spyOn(reqStr, "formData").mockResolvedValue(fd)
    const str = await POST(reqStr)
    expect(str.status).toBe(400)
  })

  it("todas las filas inválidas: sin consulta de duplicados", async () => {
    allow()
    const res = await POST(xlsxRequest([{ Palabra_esp: "", Palabra_nyW: "" }]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.valid).toBe(0)
    expect(body.invalid).toBe(1)
    expect(body.duplicates).toBe(0)
    expect(db.dictionaryWord.findMany).not.toHaveBeenCalled()
  })

  it("error inesperado → 500 genérico con log", async () => {
    allow()
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(db.dictionaryWord.findMany).mockRejectedValue(new Error("db down"))
    const res = await POST(xlsxRequest([{ Palabra_esp: "casa", Palabra_nyW: "ya:t" }]))
    expect(res.status).toBe(500)
    expect((await res.json()).message).toBe("Error interno del servidor")
    expect(errSpy).toHaveBeenCalledWith("Import preview error:", expect.any(Error))
    errSpy.mockRestore()
  })

  it("previews vencidos: purga al guardar y takePreview devuelve null", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    try {
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))
      const t1 = storePreview([{ spanish: "casa", nasaYuwe: "ya:t" }] as never)
      const t2 = storePreview([{ spanish: "perro", nasaYuwe: "wa:ka" }] as never)

      // 16 min después (TTL 15 min): el lookup borra y devuelve null por vencido
      vi.setSystemTime(new Date("2025-01-01T00:16:00Z"))
      expect(takePreview(t1)).toBeNull()

      // Guardar de nuevo purga las entradas vencidas restantes (t2)
      const t3 = storePreview([{ spanish: "gato", nasaYuwe: "mi:w" }] as never)
      expect(takePreview(t2)).toBeNull()

      // Entrada vigente y token desconocido
      expect(takePreview(t3)).toEqual([{ spanish: "gato", nasaYuwe: "mi:w" }])
      expect(takePreview("no-existe")).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
