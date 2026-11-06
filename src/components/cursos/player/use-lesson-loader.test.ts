import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useLessonLoader } from "./use-lesson-loader"

const lessonPayload = (id: string) => ({
  lesson: { id, title: `Lección ${id}`, lessonNumber: 1, content: { version: 2, blocks: [] }, moduleId: "m1" },
  words: [{ id: "w1", spanish: "casa", nasaYuwe: "yat", pronunciation: null, audioUrl: null, culturalContext: null, category: null }],
  nav: {
    prevId: null,
    prevTitle: null,
    prevNumber: null,
    nextId: "l2",
    nextTitle: "Siguiente",
    nextNumber: 2,
    moduleTitle: "M uno",
    moduleIndex: 1,
  },
})

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => payload,
  })
}

describe("useLessonLoader [F3]", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("cache hit: segundo load no refetchea", async () => {
    vi.mocked(fetch).mockImplementation(mockFetchOnce(lessonPayload("l1")))
    const { result } = renderHook(() => useLessonLoader("c1"))

    let first: unknown
    await act(async () => {
      first = await result.current.load("l1")
    })
    expect(first).toMatchObject({ lesson: { id: "l1" } })
    expect(fetch).toHaveBeenCalledTimes(1)

    let second: unknown
    await act(async () => {
      second = await result.current.load("l1")
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
    expect(result.current.getCached("l1")).toBe(first)
  })

  it("dedupe concurrente: dos load en vuelo comparten una sola request", async () => {
    let resolveFetch!: (v: Response) => void
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      })
    )
    const { result } = renderHook(() => useLessonLoader("c1"))

    let a: unknown, b: unknown
    await act(async () => {
      const pa = result.current.load("l1").then((v) => { a = v })
      const pb = result.current.load("l1").then((v) => { b = v })
      expect(fetch).toHaveBeenCalledTimes(1)
      resolveFetch({ ok: true, status: 200, json: async () => lessonPayload("l1") } as Response)
      await Promise.all([pa, pb])
    })
    expect(a).toEqual(b)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("prefetch único: doble prefetch + load posterior = una request", async () => {
    vi.mocked(fetch).mockImplementation(mockFetchOnce(lessonPayload("l1")))
    const { result } = renderHook(() => useLessonLoader("c1"))

    act(() => {
      result.current.prefetch("l1")
      result.current.prefetch("l1")
    })
    expect(fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.load("l1")
    })
    // el load reuse el vuelo del prefetch: sigue siendo una sola request
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("error en load se expone y el retry refetchea", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response)
      .mockImplementationOnce(mockFetchOnce(lessonPayload("l1")))
    const { result } = renderHook(() => useLessonLoader("c1"))

    await act(async () => {
      await expect(result.current.load("l1")).rejects.toThrow("No se pudo cargar la lección")
    })
    expect(result.current.getCached("l1")).toBeUndefined()

    let retried: unknown
    await act(async () => {
      retried = await result.current.load("l1")
    })
    expect(retried).toMatchObject({ lesson: { id: "l1" } })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("prefetch fallido es silencioso: no rechaza y load posterior reintenta", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response)
      .mockImplementationOnce(mockFetchOnce(lessonPayload("l1")))
    const { result } = renderHook(() => useLessonLoader("c1"))

    // prefetch nunca rechaza (retorna void): si lanzara, este act explotaría
    act(() => {
      result.current.prefetch("l1")
    })
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })
    // deja que el vuelo fallido se limpie del mapa de en-vuelo
    await act(async () => {})

    let loaded: unknown
    await act(async () => {
      loaded = await result.current.load("l1")
    })
    expect(loaded).toMatchObject({ lesson: { id: "l1" } })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("prefetch null/undefined es no-op", () => {
    const { result } = renderHook(() => useLessonLoader("c1"))
    act(() => {
      result.current.prefetch(null)
      result.current.prefetch(undefined)
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
