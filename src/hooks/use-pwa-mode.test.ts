import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { usePwaMode } from "./use-pwa-mode"

const QUERY = "(display-mode: standalone)"

type Listener = (e: MediaQueryListEvent) => void

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>()
  const mql = {
    matches,
    media: QUERY,
    onchange: null,
    addEventListener: vi.fn((_type: string, fn: Listener) => {
      listeners.add(fn)
    }),
    removeEventListener: vi.fn((_type: string, fn: Listener) => {
      listeners.delete(fn)
    }),
    addListener: vi.fn((fn: Listener) => {
      listeners.add(fn)
    }),
    removeListener: vi.fn((fn: Listener) => {
      listeners.delete(fn)
    }),
    dispatchEvent: () => false,
  }
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  })
  return {
    mql,
    fire(next: boolean) {
      act(() => {
        listeners.forEach((fn) => fn({ matches: next } as MediaQueryListEvent))
      })
    },
  }
}

describe("usePwaMode", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      writable: true,
      value: undefined,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reports ready once mounted (no SSR flash gate stuck)", () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => usePwaMode())
    expect(result.current.ready).toBe(true)
  })

  it("reports isPwa when display-mode is standalone", () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => usePwaMode())
    expect(result.current).toEqual({ isPwa: true, ready: true })
  })

  it("reports not-PWA in a regular browser tab", () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => usePwaMode())
    expect(result.current.isPwa).toBe(false)
  })

  it("falls back to navigator.standalone on iOS", () => {
    mockMatchMedia(false)
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      writable: true,
      value: true,
    })
    const { result } = renderHook(() => usePwaMode())
    expect(result.current.isPwa).toBe(true)
  })

  it("updates live when display-mode changes", () => {
    const { fire } = mockMatchMedia(false)
    const { result } = renderHook(() => usePwaMode())
    expect(result.current.isPwa).toBe(false)
    fire(true)
    expect(result.current.isPwa).toBe(true)
    fire(false)
    expect(result.current.isPwa).toBe(false)
  })

  it("removes the change listener on unmount", () => {
    const { mql } = mockMatchMedia(false)
    const { unmount } = renderHook(() => usePwaMode())
    unmount()
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function))
  })
})
