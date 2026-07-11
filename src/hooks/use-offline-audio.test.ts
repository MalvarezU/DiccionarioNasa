import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

vi.mock("@/lib/offline-audio-cache", () => ({
  cacheAudio: vi.fn(),
  isAudioCached: vi.fn(),
  getCachedAudioBlobUrl: vi.fn(),
  removeCachedAudio: vi.fn(),
  getCacheStorageUsage: vi.fn(),
}))

import {
  cacheAudio,
  isAudioCached,
  getCachedAudioBlobUrl,
  removeCachedAudio,
  getCacheStorageUsage,
} from "@/lib/offline-audio-cache"
import { useOfflineAudio } from "./use-offline-audio"

describe("useOfflineAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isAudioCached).mockResolvedValue(false)
    vi.mocked(getCacheStorageUsage).mockResolvedValue(null)
    vi.mocked(getCachedAudioBlobUrl).mockResolvedValue(null)
    vi.mocked(cacheAudio).mockResolvedValue(true)
    vi.mocked(removeCachedAudio).mockResolvedValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns null audioSrc when audioUrl is null", () => {
    const { result } = renderHook(() => useOfflineAudio(null))
    expect(result.current.audioSrc).toBeNull()
    expect(result.current.isCached).toBe(false)
  })

  it("returns original URL when not cached", async () => {
    const { result } = renderHook(() => useOfflineAudio("/audio/test.wav"))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    expect(result.current.audioSrc).toBe("/audio/test.wav")
    expect(result.current.isCached).toBe(false)
  })

  it("sets isCached to true when audio is cached", async () => {
    vi.mocked(isAudioCached).mockResolvedValue(true)
    vi.mocked(getCachedAudioBlobUrl).mockResolvedValue("blob:mock-url")

    const { result } = renderHook(() => useOfflineAudio("/audio/test.wav"))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    expect(result.current.isCached).toBe(true)
    expect(result.current.audioSrc).toBe("blob:mock-url")
  })

  it("downloadForOffline caches audio and sets progress", async () => {
    const { result } = renderHook(() => useOfflineAudio("/audio/test.wav"))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    await act(async () => {
      await result.current.downloadForOffline()
    })

    expect(cacheAudio).toHaveBeenCalledWith("/audio/test.wav")
    expect(result.current.isCached).toBe(true)
    expect(result.current.downloadProgress).toBe(100)
  })

  it("removeFromCache removes audio and reverts to original URL", async () => {
    vi.mocked(isAudioCached).mockResolvedValue(true)
    vi.mocked(getCachedAudioBlobUrl).mockResolvedValue("blob:mock")

    const { result } = renderHook(() => useOfflineAudio("/audio/test.wav"))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    await act(async () => {
      await result.current.removeFromCache()
    })

    expect(removeCachedAudio).toHaveBeenCalledWith("/audio/test.wav")
    expect(result.current.isCached).toBe(false)
    expect(result.current.audioSrc).toBe("/audio/test.wav")
  })

  it("does not download when audioUrl is null", async () => {
    const { result } = renderHook(() => useOfflineAudio(null))
    await act(async () => {
      await result.current.downloadForOffline()
    })
    expect(cacheAudio).not.toHaveBeenCalled()
  })
})