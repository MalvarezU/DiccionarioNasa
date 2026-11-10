import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import type { ReactNode } from "react"
import { AudiosManager } from "./audios-manager"
import { compressToOpus } from "@/lib/audio/compress-audio"

const toastMock = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: toastMock })),
}))

vi.mock("@/lib/audio/compress-audio", () => ({
  compressToOpus: vi.fn(async (f: File) => ({ ok: true as const, file: f, originalBytes: f.size, opusBytes: f.size })),
  opusFileName: (n: string) => n.replace(/\.[^.]*$/, "") + ".ogg",
}))

vi.mock("@/lib/media/bulk-match", async (importOriginal) => ({
  // matching mockeado (stem simple), pero normalizeStem real: la búsqueda
  // del modal de asignación lo usa.
  ...(await importOriginal<Record<string, unknown>>()),
  matchIllustrationFiles: vi.fn(),
}))

import { matchIllustrationFiles } from "@/lib/media/bulk-match"

function bodyHas(pattern: string | RegExp): boolean {
  const text = document.body.textContent ?? ""
  return typeof pattern === "string" ? text.includes(pattern) : pattern.test(text)
}

const WORDS = [
  { id: "w1", spanish: "Casa", nasaYuwe: "Yat", category: "sustantivo", audioUrl: null },
  { id: "w2", spanish: "Agua", nasaYuwe: "Yu'", category: "sustantivo", audioUrl: "https://cdn.test/exist.ogg" },
]

function setupFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    if (url.includes("/api/admin/upload-audio")) {
      return Response.json({ audioUrl: "https://cdn.test/audios/new.ogg", objectKey: "audios/new.ogg" })
    }
    if (url.includes("/api/admin/words") && method === "GET") {
      return Response.json({ words: WORDS, total: WORDS.length, totalPages: 1 })
    }
    if (method === "PUT") return Response.json({ word: { id: "x" } })
    return Response.json({})
  }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  setupFetch()
  vi.mocked(compressToOpus).mockImplementation(async (f: File) => ({ ok: true as const, file: f, originalBytes: f.size, opusBytes: f.size }))
  vi.mocked(matchIllustrationFiles).mockImplementation((files, words) => {
    const byName = new Map((words as { id: string; spanish: string; nasaYuwe: string; audioUrl: string | null }[]).map((w) => [w.spanish.toLowerCase(), w]))
    const matched = (files as File[])
      .map((file) => {
        const stem = file.name.replace(/\.[^.]+$/, "").toLowerCase()
        const w = byName.get(stem)
        return w ? { file, wordId: w.id, wordLabel: `${w.spanish} / ${w.nasaYuwe}` } : null
      })
      .filter(Boolean) as { file: File; wordId: string; wordLabel: string }[]
    const unmatched = (files as File[])
      .filter((file) => !matched.some((m) => m.file === file))
      .map((file) => ({ file, reason: "sin coincidencia" as const }))
    return { matched, unmatched }
  })
})

describe("AudiosManager — lote", () => {
  it("prepareBulk muestra sin coincidencia", { timeout: 30000 }, async () => {
    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "SinMatch.mp3", { type: "audio/mpeg" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas("sin coincidencia")).toBeTruthy(), { timeout: 5000 })
  })

  it("runBulk feliz", { timeout: 30000 }, async () => {
    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "Casa.mp3", { type: "audio/mpeg" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Casa \/ Yat/)).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 0 omitidos, 0 errores/)).toBeTruthy(), { timeout: 15000 })
  })

  it("error parcial: un archivo falla y el lote sigue", { timeout: 30000 }, async () => {
    let uploadCount = 0
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (url.includes("/api/admin/upload-audio")) {
        uploadCount++
        if (uploadCount === 2) return Response.json({ message: "Falló" }, { status: 400 })
        return Response.json({ audioUrl: "https://cdn.test/audios/new.ogg", objectKey: "audios/new.ogg" })
      }
      if (url.includes("/api/admin/words") && method === "GET") {
        const noAud = WORDS.map((w) => ({ ...w, audioUrl: null }))
        return Response.json({ words: noAud, total: 2, totalPages: 1 })
      }
      if (method === "PUT") return Response.json({ word: { id: "x" } })
      return Response.json({})
    }) as never

    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const files = [
        new File(["x"], "Casa.mp3", { type: "audio/mpeg" }),
        new File(["x"], "Agua.mp3", { type: "audio/mpeg" }),
      ]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Casa \/ Yat/)).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 0 omitidos, 1 errores/)).toBeTruthy(), { timeout: 15000 })
  })

  it("reintento: solo la fila error se reprocesa", { timeout: 30000 }, async () => {
    let uploadCount = 0
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (url.includes("/api/admin/upload-audio")) {
        uploadCount++
        if (uploadCount === 1) return Response.json({ message: "Falló" }, { status: 400 })
        return Response.json({ audioUrl: "https://cdn.test/audios/new.ogg", objectKey: "audios/new.ogg" })
      }
      if (url.includes("/api/admin/words") && method === "GET") {
        const noAud = WORDS.map((w) => ({ ...w, audioUrl: null }))
        return Response.json({ words: noAud, total: 2, totalPages: 1 })
      }
      if (method === "PUT") return Response.json({ word: { id: "x" } })
      return Response.json({})
    }) as never

    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "Casa.mp3", { type: "audio/mpeg" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Casa \/ Yat/)).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 0 subidas, 0 omitidos, 1 errores/)).toBeTruthy(), { timeout: 15000 })

    const uploadsAntes = uploadCount

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 0 omitidos, 0 errores/)).toBeTruthy(), { timeout: 15000 })

    expect(uploadCount).toBe(uploadsAntes + 1)
  })

  it("deshabilita input y botón mientras corre", { timeout: 30000 }, async () => {
    let resolveUpload: (v: Response) => void = () => {}
    const pending = new Promise<Response>((r) => { resolveUpload = r })

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/admin/upload-audio")) return pending
      if (url.includes("/api/admin/words") && (init?.method ?? "GET") === "GET") {
        return Response.json({ words: WORDS.map((w) => ({ ...w, audioUrl: null })), total: 2, totalPages: 1 })
      }
      if (init?.method === "PUT") return Response.json({ word: { id: "x" } })
      return Response.json({})
    }) as never

    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "Casa.mp3", { type: "audio/mpeg" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Casa \/ Yat/)).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 100))
    })

    await waitFor(() => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const btn = screen.getByRole("button", { name: /subir lote/i }) as HTMLButtonElement
      expect(input.disabled).toBe(true)
      expect(btn.disabled).toBe(true)
    })

    resolveUpload(Response.json({ audioUrl: "https://cdn.test/audios/new.ogg", objectKey: "audios/new.ogg" }))
    await waitFor(() => expect(bodyHas(/Lote terminado/)).toBeTruthy(), { timeout: 15000 })
  })

  it("skip-existing: fila con audio no dispara upload", { timeout: 30000 }, async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/admin/upload-audio")) {
        return Response.json({ audioUrl: "https://cdn.test/audios/new.ogg", objectKey: "audios/new.ogg" })
      }
      if (url.includes("/api/admin/words") && (init?.method ?? "GET") === "GET") {
        const withAud = WORDS.map((w) => (w.id === "w2" ? { ...w, audioUrl: "https://cdn.test/exist.ogg" } : w))
        return Response.json({ words: withAud, total: 2, totalPages: 1 })
      }
      if (init?.method === "PUT") return Response.json({ word: { id: "x" } })
      return Response.json({})
    }) as never

    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const files = [
        new File(["x"], "Casa.mp3", { type: "audio/mpeg" }),
        new File(["x"], "Agua.mp3", { type: "audio/mpeg" }),
      ]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Casa \/ Yat/)).toBeTruthy(), { timeout: 5000 })

    expect(bodyHas("⊘ ya tiene")).toBeTruthy()

    const uploadsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes("/api/admin/upload-audio")).length

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 1 omitidos, 0 errores/)).toBeTruthy(), { timeout: 15000 })

    const uploadsAfter = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes("/api/admin/upload-audio")).length
    expect(uploadsAfter - uploadsBefore).toBe(1)
  })

  it("per-row: elegir Reemplazar sube lo que estaba marcado omitir", { timeout: 30000 }, async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/admin/upload-audio")) {
        return Response.json({ audioUrl: "https://cdn.test/audios/new.ogg", objectKey: "audios/new.ogg" })
      }
      if (url.includes("/api/admin/words") && (init?.method ?? "GET") === "GET") {
        const withAud = WORDS.map((w) => (w.id === "w2" ? { ...w, audioUrl: "https://cdn.test/exist.ogg" } : w))
        return Response.json({ words: withAud, total: 2, totalPages: 1 })
      }
      if (init?.method === "PUT") return Response.json({ word: { id: "x" } })
      return Response.json({})
    }) as never

    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "Agua.mp3", { type: "audio/mpeg" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Agua \/ Yu/)).toBeTruthy(), { timeout: 5000 })

    const sel = screen.getByLabelText("Si la ficha ya tiene audio:") as HTMLSelectElement
    fireEvent.change(sel, { target: { value: "per-row" } })

    await waitFor(() => {
      const btns = screen.getAllByRole("button", { name: "Reemplazar" })
      expect(btns.length).toBeGreaterThanOrEqual(1)
    })

    const btns = screen.getAllByRole("button", { name: "Reemplazar" })
    fireEvent.click(btns[btns.length - 1])

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 0 omitidos, 0 errores/)).toBeTruthy(), { timeout: 15000 })
  })

  it("sin coincidencia: se omite sin fetch de upload", { timeout: 30000 }, async () => {
    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "SinMatch.mp3", { type: "audio/mpeg" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas("sin coincidencia")).toBeTruthy(), { timeout: 5000 })

    const uploadsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes("/api/admin/upload-audio")).length

    const btn = screen.getByRole("button", { name: /subir lote/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes("/api/admin/upload-audio")).length).toBe(uploadsBefore)
  })

  it("asignación manual: modal busca y la fila entra al mismo lote", { timeout: 30000 }, async () => {
    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [new File(["x"], "SinMatch.mp3", { type: "audio/mpeg" })] as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas("sin coincidencia")).toBeTruthy(), { timeout: 5000 })

    // Abrir el modal: la búsqueda se precarga con el stem del archivo.
    fireEvent.click(screen.getByRole("button", { name: "Asignar SinMatch.mp3" }))
    const buscador = await screen.findByRole("textbox", { name: "Buscar ficha para asignar" })

    // Buscar "casa": aparece el candidato (client-side, sin fetch).
    fireEvent.change(buscador, { target: { value: "casa" } })
    expect(bodyHas(/sin resultados/i)).toBeFalsy()
    fireEvent.click(screen.getByRole("button", { name: /Yat\s*⇄\s*Casa/ }))

    // La fila quedó asignada y lista para el mismo lote.
    await waitFor(() => expect(bodyHas("→ Casa / Yat")).toBeTruthy(), { timeout: 5000 })
    expect(bodyHas("sin coincidencia")).toBeFalsy()
    const btn = screen.getByRole("button", { name: /subir lote/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)

    await act(async () => {
      btn.click()
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 0 omitidos, 0 errores\./)).toBeTruthy(), { timeout: 15000 })
    expect(bodyHas("sin asignar")).toBeFalsy()
    // El PUT guardó el audio en la ficha elegida.
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/words/w1"),
      expect.objectContaining({ method: "PUT" })
    )
  })

  it("asignación manual: el admin puede reasignar con Cambiar", { timeout: 30000 }, async () => {
    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [new File(["x"], "SinMatch.mp3", { type: "audio/mpeg" })] as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas("sin coincidencia")).toBeTruthy(), { timeout: 5000 })

    fireEvent.click(screen.getByRole("button", { name: "Asignar SinMatch.mp3" }))
    const buscador = await screen.findByRole("textbox", { name: "Buscar ficha para asignar" })
    fireEvent.change(buscador, { target: { value: "casa" } })
    fireEvent.click(screen.getByRole("button", { name: /Yat\s*⇄\s*Casa/ }))
    await waitFor(() => expect(bodyHas("→ Casa / Yat")).toBeTruthy(), { timeout: 5000 })

    // Reasignar a Agua (que ya tiene audio: el badge avisa).
    fireEvent.click(screen.getByRole("button", { name: "Cambiar asignación de SinMatch.mp3" }))
    const buscador2 = await screen.findByRole("textbox", { name: "Buscar ficha para asignar" })
    fireEvent.change(buscador2, { target: { value: "agua" } })
    fireEvent.click(screen.getByRole("button", { name: /Yu'\s*⇄\s*Agua/ }))
    await waitFor(() => expect(bodyHas("→ Agua / Yu'")).toBeTruthy(), { timeout: 5000 })
  })

  it("las asignaciones manuales sobreviven a un re-prepare del lote", { timeout: 30000 }, async () => {
    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    const makeFiles = () => [new File(["x"], "SinMatch.mp3", { type: "audio/mpeg" })] as unknown as FileList
    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: makeFiles() } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas("sin coincidencia")).toBeTruthy(), { timeout: 5000 })

    fireEvent.click(screen.getByRole("button", { name: "Asignar SinMatch.mp3" }))
    const buscador = await screen.findByRole("textbox", { name: "Buscar ficha para asignar" })
    fireEvent.change(buscador, { target: { value: "casa" } })
    fireEvent.click(screen.getByRole("button", { name: /Yat\s*⇄\s*Casa/ }))
    await waitFor(() => expect(bodyHas("→ Casa / Yat")).toBeTruthy(), { timeout: 5000 })

    // Re-prepare con el MISMO archivo (nombre+tamaño): la asignación queda.
    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: makeFiles() } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas("→ Casa / Yat")).toBeTruthy(), { timeout: 5000 })
    expect(bodyHas("sin coincidencia")).toBeFalsy()
  })

  it("Quitar saca la fila del lote", { timeout: 30000 }, async () => {
    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "Casa.mp3", { type: "audio/mpeg" }), new File(["y"], "SinMatch.mp3", { type: "audio/mpeg" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas("sin coincidencia")).toBeTruthy(), { timeout: 5000 })

    fireEvent.click(screen.getByRole("button", { name: "Quitar SinMatch.mp3 del lote" }))
    await waitFor(() => expect(bodyHas("SinMatch.mp3")).toBeFalsy(), { timeout: 5000 })
    // La fila con match sigue intacta.
    expect(bodyHas("→ Casa / Yat")).toBeTruthy()
  })

  it("el resumen del lote cuenta las filas sin asignar", { timeout: 30000 }, async () => {
    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir audios para el lote"]') as HTMLInputElement
      const files = [new File(["x"], "Casa.mp3", { type: "audio/mpeg" }), new File(["y"], "SinMatch.mp3", { type: "audio/mpeg" })]
      fireEvent.change(input, { target: { files: files as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas("sin coincidencia")).toBeTruthy(), { timeout: 5000 })

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidas, 0 omitidos, 0 errores\. 1 sin asignar\./)).toBeTruthy(), { timeout: 15000 })
  })
})

describe("AudiosManager — subida individual en modal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupFetch()
    vi.mocked(compressToOpus).mockImplementation(async (f: File) => ({ ok: true as const, file: f, originalBytes: f.size, opusBytes: f.size }))
  })

  it("Subir abre el modal con la ficha y Cancelar lo cierra", { timeout: 30000 }, async () => {
    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    fireEvent.click(screen.getByRole("button", { name: "Subir" }))
    expect(await screen.findByRole("dialog")).toBeDefined()
    expect(screen.getByText("Audio para Casa / Yat")).toBeDefined()

    fireEvent.click(screen.getByText("Cancelar"))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 5000 })
  })

  it("guardar cierra el modal y hace PUT en la ficha", { timeout: 30000 }, async () => {
    render(<AudiosManager />)
    await waitFor(() => expect(bodyHas("Casa")).toBeTruthy(), { timeout: 5000 })

    fireEvent.click(screen.getByRole("button", { name: "Subir" }))
    await screen.findByRole("dialog")

    await act(async () => {
      const input = document.querySelector('input[aria-label="Elegir archivo de audio"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [new File(["x"], "casa.mp3", { type: "audio/mpeg" })] as unknown as FileList } })
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 10000 })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/words/w1"),
      expect.objectContaining({ method: "PUT" })
    )
    expect(toastMock).toHaveBeenCalledTimes(1)
    const { title } = toastMock.mock.calls[0][0] as { title: ReactNode }
    const { container } = render(<>{title}</>)
    expect(container).toHaveTextContent("Audio guardado")
    expect(container.querySelector("svg")).not.toBeNull()
  })
})
