import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  cacheAudio,
  isAudioCached,
  getCachedAudioBlobUrl,
  removeCachedAudio,
  getCacheStorageUsage,
} from "./offline-audio-cache"

const mockCache = {
  put: vi.fn(),
  match: vi.fn(),
  delete: vi.fn(),
}

const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
}

describe("offline-audio-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.caches = mockCaches as never
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock")
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches
  })

  describe("cacheAudio", () => {
    it("caches audio successfully when fetch returns ok", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("audio-data", { status: 200 })
      )

      const result = await cacheAudio("/audio/test.wav")
      expect(result).toBe(true)
      expect(mockCache.put).toHaveBeenCalledWith(
        "/audio/test.wav",
        expect.any(Response)
      )
    })

    it("returns false when fetch fails", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

      const result = await cacheAudio("/audio/test.wav")
      expect(result).toBe(false)
    })

    it("returns false when fetch returns non-ok status", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(null, { status: 404 })
      )

      const result = await cacheAudio("/audio/test.wav")
      expect(result).toBe(false)
    })
  })

  describe("isAudioCached", () => {
    it("returns true when audio is in cache", async () => {
      mockCache.match.mockResolvedValue(new Response("audio"))

      const result = await isAudioCached("/audio/test.wav")
      expect(result).toBe(true)
    })

    it("returns false when audio is not in cache", async () => {
      mockCache.match.mockResolvedValue(undefined)

      const result = await isAudioCached("/audio/test.wav")
      expect(result).toBe(false)
    })
  })

  describe("getCachedAudioBlobUrl", () => {
    it("returns blob URL when audio is cached", async () => {
      const blob = new Blob(["audio"], { type: "audio/wav" })
      mockCache.match.mockResolvedValue(new Response(blob))

      const result = await getCachedAudioBlobUrl("/audio/test.wav")
      expect(result).toBe("blob:mock")
    })

    it("returns null when audio is not cached", async () => {
      mockCache.match.mockResolvedValue(undefined)

      const result = await getCachedAudioBlobUrl("/audio/test.wav")
      expect(result).toBeNull()
    })
  })

  describe("removeCachedAudio", () => {
    it("deletes the audio from cache", async () => {
      mockCache.delete.mockResolvedValue(true)

      const result = await removeCachedAudio("/audio/test.wav")
      expect(result).toBe(true)
      expect(mockCache.delete).toHaveBeenCalledWith("/audio/test.wav")
    })

    it("returns true even when entry does not exist", async () => {
      mockCache.delete.mockResolvedValue(false)

      const result = await removeCachedAudio("/audio/nonexistent.wav")
      expect(result).toBe(true)
    })
  })

  describe("getCacheStorageUsage", () => {
    it("returns storage estimate when available", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          storage: {
            estimate: vi.fn().mockResolvedValue({ usage: 1048576, quota: 104857600 }),
          },
        },
        writable: true,
        configurable: true,
      })

      const result = await getCacheStorageUsage()
      expect(result).not.toBeNull()
      expect(result!.usedMB).toBe(1)
      expect(result!.quotaMB).toBe(100)
      expect(result!.percentUsed).toBe(1)
    })

    it("returns null when navigator.storage is unavailable", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      })

      const result = await getCacheStorageUsage()
      expect(result).toBeNull()
    })
  })
})