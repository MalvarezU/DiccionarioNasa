import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { IllustrationsManager } from "./illustrations-manager"

vi.mock("@/lib/media/compress-image", () => ({
  compressToIllustration: vi.fn(async (f: File) => f),
  IMAGE_MAX_DIMENSION: 1600,
  ILLUSTRATION_SIZE: 512,
}))


function bodyHas(pattern: string | RegExp): boolean {
  const text = document.body.textContent ?? ""
  return typeof pattern === "string" ? text.includes(pattern) : pattern.test(text)
}

const WORDS = [
  { id: "w1", spanish: "Casa", nasaYuwe: "Yat", category: "sustantivo", illustrationUrl: null },
  { id: "w2", spanish: "Agua", nasaYuwe: "Yu'", category: "sustantivo", illustrationUrl: "https://cdn.test/exist.png" },
]

function setupFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    if (url.includes("/api/admin/upload-image")) {
      return Response.json({ url: "https://cdn.test/images/new.png", objectKey: "images/new.png" })
    }
    if (url.includes("/api/admin/words") && method === "GET") {
      return Response.json({ words: WORDS, total: WORDS.length, totalPages: 1 })
    }
    if (method === "PUT") return Response.json({ word: { id: "x" } })
    return Response.json({})
  }) as never
}

function selectFiles(names: string[]) {
  const input = document.querySelector('input[aria-label="Elegir imágenes para el lote"]') as HTMLInputElement
  const files = names.map((n) => new File(["x"], n, { type: "image/png" }))
  const fileList = files as unknown as FileList
  fireEvent.change(input, { target: { files: fileList } })
}

describe("IllustrationsManager — lote", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupFetch()
  })

  it("prepareBulk muestra sin coincidencia", async () => {
    render(<IllustrationsManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      selectFiles(["SinMatch.png"])
      await new Promise((r) => setTimeout(r, 500))
    })

    await waitFor(() => expect(document.body.textContent).toContain("sin coincidencia"), { timeout: 5000 })
  })

  it("runBulk feliz", async () => {
    render(<IllustrationsManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      selectFiles(["Casa.png"])
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => expect(bodyHas(/Casa \/ Yat/)).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 500))
    })

    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 0 omitidas, 0 errores/)).toBeTruthy(), { timeout: 10000 })
  })

  it("error parcial: un archivo falla y el lote sigue", { timeout: 30000 }, async () => {
    let uploadCount = 0
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (url.includes("/api/admin/upload-image")) {
        uploadCount++
        if (uploadCount === 2) return Response.json({ message: "Falló" }, { status: 400 })
        return Response.json({ url: "https://cdn.test/images/new.png", objectKey: "images/new.png" })
      }
      if (url.includes("/api/admin/words") && method === "GET") {
        const noIll = WORDS.map((w) => ({ ...w, illustrationUrl: null }))
        return Response.json({ words: noIll, total: 2, totalPages: 1 })
      }
      if (method === "PUT") return Response.json({ word: { id: "x" } })
      return Response.json({})
    }) as never

    render(<IllustrationsManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir imágenes para el lote"]') as HTMLInputElement
      const files = [
        new File(["x"], "Casa.png", { type: "image/png" }),
        new File(["x"], "Agua.png", { type: "image/png" }),
      ]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => expect(bodyHas(/Casa \/ Yat/)).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 500))
    })

    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 0 omitidas, 1 errores/)).toBeTruthy(), { timeout: 15000 })
  })

  it("reintento: solo la fila error se reprocesa", { timeout: 30000 }, async () => {
    let uploadCount = 0
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (url.includes("/api/admin/upload-image")) {
        uploadCount++
        if (uploadCount === 1) return Response.json({ message: "Falló" }, { status: 400 })
        return Response.json({ url: "https://cdn.test/images/new.png", objectKey: "images/new.png" })
      }
      if (url.includes("/api/admin/words") && method === "GET") {
        return Response.json({ words: WORDS, total: 2, totalPages: 1 })
      }
      if (method === "PUT") return Response.json({ word: { id: "x" } })
      return Response.json({})
    }) as never

    render(<IllustrationsManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir imágenes para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "Casa.png", { type: "image/png" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => expect(bodyHas(/Casa \/ Yat/)).toBeTruthy(), { timeout: 5000 })

    // Primer run: falla
    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 0 subidas, 0 omitidas, 1 errores/)).toBeTruthy(), { timeout: 10000 })

    const uploadsAntes = uploadCount

    // Reintento
    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 0 omitidas, 0 errores/)).toBeTruthy(), { timeout: 10000 })

    expect(uploadCount).toBe(uploadsAntes + 1)
  })

  it("deshabilita input y botón mientras corre", async () => {
    let resolveUpload: (v: Response) => void = () => {}
    const pending = new Promise<Response>((r) => { resolveUpload = r })

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/admin/upload-image")) return pending
      if (url.includes("/api/admin/words") && (init?.method ?? "GET") === "GET") {
        return Response.json({ words: WORDS, total: 2, totalPages: 1 })
      }
      if (init?.method === "PUT") return Response.json({ word: { id: "x" } })
      return Response.json({})
    }) as never

    render(<IllustrationsManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir imágenes para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "Casa.png", { type: "image/png" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => expect(bodyHas(/Casa \/ Yat/)).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 100))
    })

    await waitFor(() => {
      const input = document.querySelector('input[aria-label="Elegir imágenes para el lote"]') as HTMLInputElement
      const btn = screen.getByRole("button", { name: /subir lote/i }) as HTMLButtonElement
      expect(input.disabled).toBe(true)
      expect(btn.disabled).toBe(true)
    })

    resolveUpload(Response.json({ url: "https://cdn.test/images/new.png", objectKey: "images/new.png" }))
    await waitFor(() => expect(bodyHas(/Lote terminado/)).toBeTruthy(), { timeout: 10000 })
  })

  it("skip-existing: fila con imagen no dispara upload", async () => {
    const fetch = global.fetch as ReturnType<typeof vi.fn>
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/admin/upload-image")) {
        return Response.json({ url: "https://cdn.test/images/new.png", objectKey: "images/new.png" })
      }
      if (url.includes("/api/admin/words") && (init?.method ?? "GET") === "GET") {
        const wordsWith = WORDS.map((w) => (w.id === "w2" ? { ...w, illustrationUrl: "https://cdn.test/exist.png" } : w))
        return Response.json({ words: wordsWith, total: 2, totalPages: 1 })
      }
      if (init?.method === "PUT") return Response.json({ word: { id: "x" } })
      return Response.json({})
    }) as never

    render(<IllustrationsManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir imágenes para el lote"]') as HTMLInputElement
      const files = [
        new File(["x"], "Casa.png", { type: "image/png" }),
        new File(["x"], "Agua.png", { type: "image/png" }),
      ]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => expect(bodyHas(/Casa \/ Yat/)).toBeTruthy(), { timeout: 5000 })

    expect(bodyHas("⊘ ya tiene")).toBeTruthy()

    const uploadsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes("/api/admin/upload-image")).length

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 1 omitidas, 0 errores/)).toBeTruthy(), { timeout: 10000 })

    const uploadsAfter = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes("/api/admin/upload-image")).length
    expect(uploadsAfter - uploadsBefore).toBe(1)
  })

  it("per-row: elegir Reemplazar sube lo que estaba marcado omitir", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/admin/upload-image")) {
        return Response.json({ url: "https://cdn.test/images/new.png", objectKey: "images/new.png" })
      }
      if (url.includes("/api/admin/words") && (init?.method ?? "GET") === "GET") {
        const wordsWith = WORDS.map((w) => (w.id === "w2" ? { ...w, illustrationUrl: "https://cdn.test/exist.png" } : w))
        return Response.json({ words: wordsWith, total: 2, totalPages: 1 })
      }
      if (init?.method === "PUT") return Response.json({ word: { id: "x" } })
      return Response.json({})
    }) as never

    render(<IllustrationsManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir imágenes para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "Agua.png", { type: "image/png" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => expect(bodyHas(/Agua \/ Yu/)).toBeTruthy(), { timeout: 5000 })

    fireEvent.change(screen.getByLabelText("Si la ficha ya tiene imagen:"), { target: { value: "per-row" } })

    await waitFor(() => {
      const btns = screen.getAllByRole("button", { name: "Reemplazar" })
      expect(btns.length).toBeGreaterThanOrEqual(1)
    })

    const btns = screen.getAllByRole("button", { name: "Reemplazar" })
    fireEvent.click(btns[btns.length - 1])

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 0 omitidas, 0 errores/)).toBeTruthy(), { timeout: 10000 })
  })

  it("sin coincidencia: se omite sin fetch de upload", async () => {
    render(<IllustrationsManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir imágenes para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "SinMatch.png", { type: "image/png" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    // Debug: check what's rendered
    await waitFor(() => expect(document.body.textContent).toContain("sin coincidencia"), { timeout: 5000 })

    const uploadsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes("/api/admin/upload-image")).length

    const btn = screen.getByRole("button", { name: /subir lote/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes("/api/admin/upload-image")).length).toBe(uploadsBefore)
  })
})
