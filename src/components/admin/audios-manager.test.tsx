import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { AudiosManager } from "./audios-manager"

vi.mock("@/lib/audio/compress-audio", () => ({
  compressToOpus: vi.fn(async (f: File) => ({ ok: true as const, file: f, originalBytes: f.size, opusBytes: f.size })),
  opusFileName: (n: string) => n.replace(/\.[^.]*$/, "") + ".ogg",
}))

vi.mock("@/lib/media/bulk-match", () => ({
  // use real-ish matching by filename stem
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
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidos, 0 omitidos, 0 errores/)).toBeTruthy(), { timeout: 15000 })
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
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidos, 0 omitidos, 1 errores/)).toBeTruthy(), { timeout: 15000 })
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
    await waitFor(() => expect(bodyHas(/Lote terminado: 0 subidos, 0 omitidos, 1 errores/)).toBeTruthy(), { timeout: 15000 })

    const uploadsAntes = uploadCount

    await act(async () => {
      screen.getByRole("button", { name: /subir lote/i }).click()
      await new Promise((r) => setTimeout(r, 2000))
    })
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidos, 0 omitidos, 0 errores/)).toBeTruthy(), { timeout: 15000 })

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
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidos, 1 omitidos, 0 errores/)).toBeTruthy(), { timeout: 15000 })

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
    await waitFor(() => expect(bodyHas(/Lote terminado: 1 subidos, 0 omitidos, 0 errores/)).toBeTruthy(), { timeout: 15000 })
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
})
