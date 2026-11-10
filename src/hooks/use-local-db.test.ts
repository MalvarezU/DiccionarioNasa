import { vi, describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn().mockReturnValue(true),
}))

vi.mock("@/lib/local-db", () => ({
  isLocalDBReady: vi.fn().mockResolvedValue(false),
  storeWords: vi.fn().mockResolvedValue(undefined),
  getAllLocalWords: vi.fn().mockResolvedValue([]),
  getLocalDBStats: vi.fn().mockResolvedValue({ wordCount: 0, lastSync: null }),
  getLastSync: vi.fn().mockResolvedValue(null),
  setLastSync: vi.fn().mockResolvedValue(undefined),
  clearLocalDB: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/media-sync", () => ({
  downloadMediaQueue: vi.fn().mockResolvedValue({ total: 0, downloaded: 0, skippedCached: 0, failed: 0 }),
  extractMediaUrls: vi.fn().mockReturnValue([]),
}))

import {
  isLocalDBReady,
  storeWords,
  getAllLocalWords,
  getLocalDBStats,
  clearLocalDB,
} from "@/lib/local-db"
import { downloadMediaQueue, extractMediaUrls } from "@/lib/media-sync"
import { useLocalDB } from "./use-local-db"

const mockExportResponse = {
  words: [{ id: "w1", spanish: "Casa", nasaYuwe: "Yat" }],
  total: 1,
  hasMore: false,
  page: 1,
  pageSize: 100,
}

describe("useLocalDB", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(isLocalDBReady).mockResolvedValue(false)
    vi.mocked(getLocalDBStats).mockResolvedValue({ wordCount: 0, lastSync: null })
  })

  it("starts with not ready", () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useLocalDB())
    expect(result.current.isReady).toBe(false)
  })

  it("downloads words from export API", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json(mockExportResponse) as never
    )

    const { result } = renderHook(() => useLocalDB())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dictionary/export")
    )
  })

  it("stores words from API into local DB", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json(mockExportResponse) as never
    )

    const { result } = renderHook(() => useLocalDB())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(storeWords).toHaveBeenCalled()
  })

  it("sets isReady after successful download", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json(mockExportResponse) as never
    )

    const { result } = renderHook(() => useLocalDB())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })

    expect(result.current.isReady).toBe(true)
    expect(result.current.downloadProgress).toBe(100)
  })

  it("forceResync clears local DB and re-downloads", { timeout: 5000 }, async () => {
    // Respuesta fresca por llamada: el hook hace fetch al montar y otro en
    // forceResync; reutilizar el mismo Response rompe el segundo .json().
    vi.mocked(global.fetch).mockImplementation(
      () => Promise.resolve(Response.json(mockExportResponse)) as never
    )

    const { result } = renderHook(() => useLocalDB())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 500))
    })

    await act(async () => {
      await result.current.forceResync()
    })

    expect(clearLocalDB).toHaveBeenCalled()
  })

  it("fase de medios: corre downloadMediaQueue tras las palabras", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json(mockExportResponse) as never
    )
    vi.mocked(getAllLocalWords).mockResolvedValue([
      { id: "w1", audioUrl: "https://cdn/a.ogg", illustrationUrl: "https://cdn/i.webp" },
    ] as never)
    vi.mocked(extractMediaUrls).mockReturnValue(["https://cdn/a.ogg", "https://cdn/i.webp"])

    const { result } = renderHook(() => useLocalDB())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })

    expect(extractMediaUrls).toHaveBeenCalled()
    expect(downloadMediaQueue).toHaveBeenCalledWith(
      ["https://cdn/a.ogg", "https://cdn/i.webp"],
      expect.objectContaining({ signal: expect.anything() })
    )
    expect(result.current.downloadProgress).toBe(100)
  })

  it("forceResync devuelve true y limpia al final", async () => {
    // Respuesta FRESCA por fetch: el mount auto-descarga y el forceResync
    // reusa el mock; un mismo Response no se puede leer dos veces.
    vi.mocked(global.fetch).mockImplementation(
      () => Response.json(mockExportResponse) as never
    )

    const { result } = renderHook(() => useLocalDB())

    // Dejar que la auto-descarga del mount se asiente y libere el ref
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })

    let ok = false
    await act(async () => {
      ok = await result.current.forceResync()
    })

    expect(ok).toBe(true)
    expect(clearLocalDB).toHaveBeenCalled()
    expect(result.current.isReady).toBe(true)
  })

  it("forceResync devuelve false y no limpia si la descarga falla", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("red caída"))

    const { result } = renderHook(() => useLocalDB())

    // Dejar que la auto-descarga del mount se asiente y libere el ref
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })
    vi.mocked(clearLocalDB).mockClear()

    let ok = true
    await act(async () => {
      ok = await result.current.forceResync()
    })

    expect(ok).toBe(false)
    expect(clearLocalDB).not.toHaveBeenCalled()
    expect(result.current.error).toMatch(/red caída/)
  })

  it("auto-resume acotado: no reintenta en loop si el servidor está caído", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("red caída"))

    renderHook(() => useLocalDB())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 500))
    })

    // Montaje (1) + reconexión interna como máximo: con tope de 2 intentos
    // no hay loop infinito. Cada intento = 1 fetch al export.
    const calls = vi.mocked(global.fetch).mock.calls.length
    expect(calls).toBeLessThanOrEqual(2)
  })

  it("refreshStats updates word count from local DB", async () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}))
    vi.mocked(getLocalDBStats).mockResolvedValue({ wordCount: 42, lastSync: "2024-01-01T00:00:00Z" })

    const { result } = renderHook(() => useLocalDB())

    await act(async () => {
      await result.current.refreshStats()
    })

    expect(result.current.localWordCount).toBe(42)
    expect(result.current.lastSync).toBe("2024-01-01T00:00:00Z")
  })
})