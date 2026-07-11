import { vi, describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn().mockReturnValue(true),
}))

vi.mock("@/lib/local-db", () => ({
  isLocalDBReady: vi.fn().mockResolvedValue(false),
  storeWords: vi.fn().mockResolvedValue(undefined),
  getLocalDBStats: vi.fn().mockResolvedValue({ wordCount: 0, lastSync: null }),
  getLastSync: vi.fn().mockResolvedValue(null),
  setLastSync: vi.fn().mockResolvedValue(undefined),
  clearLocalDB: vi.fn().mockResolvedValue(undefined),
}))

import {
  isLocalDBReady,
  storeWords,
  getLocalDBStats,
  clearLocalDB,
} from "@/lib/local-db"
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

  it.skip("forceResync clears local DB and re-downloads", { timeout: 5000 }, async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json(mockExportResponse) as never
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