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

import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { POST } from "./route"
import { __resetPreviewStore } from "./route"

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
})
