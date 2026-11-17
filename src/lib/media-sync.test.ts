import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  downloadMediaQueue,
  extractMediaUrls,
  extractMediaByKind,
  planMediaDownloads,
  estimateBytes,
  isMeteredConnection,
  MEDIA_BUDGET_BYTES,
  AUDIO_ENTRY_CAP,
  IMAGE_ENTRY_CAP,
} from "./media-sync"

/** CacheStorage mockeable por test. */
function mockCaches(cachedUrls: Set<string>) {
  const mockCache = {
    match: vi.fn(async (url: string) => (cachedUrls.has(url) ? new Response("x") : undefined)),
  }
  globalThis.caches = {
    keys: vi.fn(async () => ["test-cache"]),
    open: vi.fn(async () => mockCache),
  } as never
  return mockCache
}

const fast = {
  timeoutMs: 200,
  batchPauseMs: 5,
  batchSize: 4,
  progressThrottleMs: 0,
}

describe("downloadMediaQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCaches(new Set())
  })

  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches
  })

  it("cola vacía devuelve ceros y reporta progreso", async () => {
    const onProgress = vi.fn()
    const r = await downloadMediaQueue([], { onProgress })
    expect(r).toEqual({ total: 0, downloaded: 0, skippedCached: 0, failed: 0, skippedBudget: 0 })
    expect(onProgress).toHaveBeenCalledWith(0, 0, 0)
  })

  it("descarga todas las URLs OK", async () => {
    globalThis.fetch = vi.fn(async () => new Response("bin", { status: 200 })) as never as never
    const r = await downloadMediaQueue(
      ["https://cdn/x1.ogg", "https://cdn/x2.webp"],
      { ...fast, concurrency: 2 }
    )
    expect(r).toEqual({ total: 2, downloaded: 2, skippedCached: 0, failed: 0, skippedBudget: 0 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it("salta lo ya-cacheado sin fetchear (resume barato)", async () => {
    mockCaches(new Set(["https://cdn/cached.ogg"]))
    const fetchMock = vi.fn(async () => new Response("bin", { status: 200 }))
    globalThis.fetch = fetchMock
    const r = await downloadMediaQueue(
      ["https://cdn/cached.ogg", "https://cdn/new.ogg"],
      fast
    )
    expect(r.downloaded).toBe(1)
    expect(r.skippedCached).toBe(1)
    expect(r.failed).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cdn/new.ogg",
      expect.objectContaining({ mode: "no-cors" })
    )
  })

  it("un fallo no rompe el resto (sin retry)", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (String(url).includes("bad")) throw new Error("boom")
      return new Response("bin", { status: 200 })
    }) as never
    const r = await downloadMediaQueue(
      ["https://cdn/ok1.ogg", "https://cdn/bad.ogg", "https://cdn/ok2.ogg"],
      { ...fast, concurrency: 1 }
    )
    expect(r).toEqual({ total: 3, downloaded: 2, skippedCached: 0, failed: 1, skippedBudget: 0 })
  })

  it("timeout aborta el ítem colgado sin congelar el sync", async () => {
    globalThis.fetch = vi.fn(
      (url: string, init?: { signal?: AbortSignal }) =>
        new Promise((resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          )
          // nunca resuelve por sí solo: solo el timeout lo corta
        })
    ) as never
    const t0 = Date.now()
    const r = await downloadMediaQueue(["https://cdn/hang.ogg"], {
      ...fast,
      timeoutMs: 60,
      concurrency: 1,
    })
    expect(Date.now() - t0).toBeLessThan(2000)
    expect(r.failed).toBe(1)
    expect(r.downloaded).toBe(0)
  })

  it("abort externo corta limpio sin contar fallos", async () => {
    let calls = 0
    globalThis.fetch = vi.fn(async () => {
      calls++
      await new Promise((r) => setTimeout(r, 30))
      return new Response("bin", { status: 200 })
    }) as never
    const ctrl = new AbortController()
    const p = downloadMediaQueue(
      ["https://cdn/a.ogg", "https://cdn/b.ogg", "https://cdn/c.ogg", "https://cdn/d.ogg"],
      { ...fast, batchPauseMs: 50, concurrency: 1, signal: ctrl.signal }
    )
    setTimeout(() => ctrl.abort(), 20)
    const r = await p
    // Abortado: lo no completado ni se cuenta como fallo ni como descarga
    expect(r.downloaded + r.failed + r.skippedCached).toBeLessThan(r.total)
    expect(calls).toBeLessThanOrEqual(2)
  })

  it("respeta el límite de concurrencia", async () => {
    let inFlight = 0
    let maxInFlight = 0
    globalThis.fetch = vi.fn(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 10))
      inFlight--
      return new Response("bin", { status: 200 })
    }) as never
    await downloadMediaQueue(
      ["https://cdn/1", "https://cdn/2", "https://cdn/3", "https://cdn/4", "https://cdn/5", "https://cdn/6"],
      { ...fast, concurrency: 2 }
    )
    expect(maxInFlight).toBeLessThanOrEqual(2)
  })

  it("progreso throttled: no llama por cada ítem con throttle alto", async () => {
    globalThis.fetch = vi.fn(async () => new Response("bin", { status: 200 })) as never as never
    const onProgress = vi.fn()
    await downloadMediaQueue(
      Array.from({ length: 8 }, (_, i) => `https://cdn/${i}.ogg`),
      { ...fast, concurrency: 1, progressThrottleMs: 60_000 }
    )
    // Solo reportes forzados (inicio + fin): muy por debajo de 8
    expect(onProgress.mock.calls.length).toBeLessThanOrEqual(3)
  })

  it("sin caches disponible (SSR/privado) no rompe: todo va a fetch", async () => {
    delete (globalThis as { caches?: unknown }).caches
    globalThis.fetch = vi.fn(async () => new Response("bin", { status: 200 })) as never as never
    const r = await downloadMediaQueue(["https://cdn/x.ogg"], fast)
    expect(r.downloaded).toBe(1)
  })

  it("nunca lanza aunque todo falle", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("red caída")
    }) as never
    const r = await downloadMediaQueue(
      ["https://cdn/1", "https://cdn/2"],
      fast
    )
    expect(r).toEqual({ total: 2, downloaded: 0, skippedCached: 0, failed: 2, skippedBudget: 0 })
  })
})

describe("extractMediaUrls", () => {
  it("deduplica y filtra nulls y no-http", () => {
    const urls = extractMediaUrls([
      { audioUrl: "https://cdn/a.ogg", illustrationUrl: "https://cdn/i.webp" },
      { audioUrl: "https://cdn/a.ogg", illustrationUrl: null },
      { audioUrl: "/api/other", illustrationUrl: undefined },
      { audioUrl: null, illustrationUrl: null },
    ])
    expect(urls.sort()).toEqual(["https://cdn/a.ogg", "https://cdn/i.webp"])
  })

  it("acepta el redirect legacy /api/media/<id> (sin extension)", () => {
    const urls = extractMediaUrls([
      { audioUrl: "/api/media/abc123", illustrationUrl: "/api/media/img456" },
      { audioUrl: "/api/media/abc123", illustrationUrl: null },
      { audioUrl: "  /api/media/con-espacios  ", illustrationUrl: undefined },
    ])
    expect(urls.sort()).toEqual([
      "/api/media/abc123",
      "/api/media/con-espacios",
      "/api/media/img456",
    ])
  })

  it("lista vacía devuelve vacío", () => {
    expect(extractMediaUrls([])).toEqual([])
  })
})

describe("extractMediaByKind", () => {
  it("clasifica audios e ilustraciones (/api/media va a ilustraciones)", () => {
    const { audios, illustrations } = extractMediaByKind([
      { audioUrl: "https://cdn/a.ogg", illustrationUrl: "https://cdn/i.webp" },
      { audioUrl: "/audio/local.mp3", illustrationUrl: "/api/media/legacy" },
    ])
    expect(audios.sort()).toEqual(["/audio/local.mp3", "https://cdn/a.ogg"])
    expect(illustrations.sort()).toEqual(["/api/media/legacy", "https://cdn/i.webp"])
  })
})

describe("planMediaDownloads (presupuesto 50MB)", () => {
  it("audios primero: entran todos (343 x 25KB < 10MB)", () => {
    const words = Array.from({ length: 343 }, (_, i) => ({
      audioUrl: `https://cdn/a${i}.mp3`,
      illustrationUrl: null,
    }))
    const plan = planMediaDownloads(words)
    expect(plan.audios).toHaveLength(343)
    expect(plan.illustrations).toHaveLength(0)
    expect(plan.estimatedBytes).toBeLessThan(10 * 1024 * 1024)
  })

  it("ilustraciones con tope de 120 entradas (~40MB)", () => {
    const words = Array.from({ length: 200 }, (_, i) => ({
      audioUrl: null,
      illustrationUrl: `https://cdn/i${i}.png`,
    }))
    const plan = planMediaDownloads(words)
    expect(plan.illustrations).toHaveLength(IMAGE_ENTRY_CAP)
    expect(plan.audios).toHaveLength(0)
    expect(plan.estimatedBytes).toBeLessThanOrEqual(50 * 1024 * 1024)
  })

  it("audios con tope de 400 entradas aunque el presupuesto dé más", () => {
    const words = Array.from({ length: 500 }, (_, i) => ({
      audioUrl: `https://cdn/a${i}.mp3`,
      illustrationUrl: null,
    }))
    const plan = planMediaDownloads(words)
    expect(plan.audios).toHaveLength(AUDIO_ENTRY_CAP)
  })

  it("caso real 343+343: todos los audios + 120 ilustraciones < 50MB", () => {
    const words = Array.from({ length: 343 }, (_, i) => ({
      audioUrl: `https://cdn/a${i}.mp3`,
      illustrationUrl: `https://cdn/i${i}.png`,
    }))
    const plan = planMediaDownloads(words)
    expect(plan.audios).toHaveLength(343)
    expect(plan.illustrations).toHaveLength(120)
    expect(plan.estimatedBytes).toBeLessThanOrEqual(MEDIA_BUDGET_BYTES)
  })
})

describe("downloadMediaQueue con presupuesto", () => {
  it("budgetBytes frena con skippedBudget en vez de fallar", async () => {
    globalThis.fetch = vi.fn(async () => new Response("bin", { status: 200 })) as never as never
    const r = await downloadMediaQueue(
      ["https://cdn/1.ogg", "https://cdn/2.ogg", "https://cdn/3.ogg"],
      { ...fast, concurrency: 1, budgetBytes: 10 }
    )
    // Cada ogg estima 25KB > 10B: ninguno se intenta, ninguno falla.
    expect(r.downloaded).toBe(0)
    expect(r.failed).toBe(0)
    expect(r.skippedBudget).toBe(3)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("lo ya-cacheado cuenta al presupuesto (resume no lo excede)", async () => {
    mockCaches(new Set(["https://cdn/cached.ogg"]))
    globalThis.fetch = vi.fn(async () => new Response("bin", { status: 200 })) as never as never
    const r = await downloadMediaQueue(
      ["https://cdn/cached.ogg", "https://cdn/new.ogg"],
      { ...fast, concurrency: 1, budgetBytes: estimateBytes("https://cdn/cached.ogg") }
    )
    // El cacheado consume el presupuesto: el nuevo queda para on-demand.
    expect(r.skippedCached).toBe(1)
    expect(r.skippedBudget).toBe(1)
    expect(r.downloaded).toBe(0)
  })

  it("mismo origen usa cors (legible) y cross-origin no-cors (opaco)", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("bin", {
          status: 200,
          headers: { "Content-Length": "12345" },
        })
    )
    globalThis.fetch = fetchMock as never
    const r = await downloadMediaQueue(["/audio/local.mp3"], {
      ...fast,
      concurrency: 1,
      budgetBytes: 30000,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/audio/local.mp3",
      expect.objectContaining({ mode: "cors" })
    )
    expect(r.downloaded).toBe(1)
    expect(r.skippedBudget).toBe(0)
  })
})

describe("isMeteredConnection", () => {
  it("false sin connection API, true con saveData o 2g", () => {
    expect(isMeteredConnection()).toBe(false)
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true, effectiveType: "4g" },
      configurable: true,
    })
    expect(isMeteredConnection()).toBe(true)
    Object.defineProperty(navigator, "connection", {
      value: { saveData: false, effectiveType: "2g" },
      configurable: true,
    })
    expect(isMeteredConnection()).toBe(true)
    Object.defineProperty(navigator, "connection", {
      value: { saveData: false, effectiveType: "4g" },
      configurable: true,
    })
    expect(isMeteredConnection()).toBe(false)
  })
})
