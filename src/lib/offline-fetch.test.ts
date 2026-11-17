import { describe, it, expect, vi, beforeEach } from "vitest"
import { offlineFetch } from "./offline-fetch"

describe("offlineFetch (network → snapshot → empty)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("red ok: devuelve datos y escribe el snapshot", async () => {
    const write = vi.fn(async () => {})
    globalThis.fetch = vi.fn(async () => Response.json({ words: [1] })) as never
    const r = await offlineFetch(
      "/api/x",
      undefined,
      { read: async () => null, write },
      { words: [] as number[] }
    )
    expect(r).toEqual({ data: { words: [1] }, source: "network" })
    expect(write).toHaveBeenCalledWith({ words: [1] })
  })

  it("red caída (503 offline del SW): sirve el snapshot", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    }) as never
    const snap = { words: [9] }
    const r = await offlineFetch(
      "/api/x",
      undefined,
      { read: async () => snap, write: async () => {} },
      { words: [] as number[] }
    )
    expect(r).toEqual({ data: snap, source: "snapshot" })
  })

  it("500 online con snapshot: sirve snapshot sin error", async () => {
    globalThis.fetch = vi.fn(async () => new Response("x", { status: 500 })) as never
    const snap = { words: [9] }
    const r = await offlineFetch(
      "/api/x",
      undefined,
      { read: async () => snap, write: async () => {} },
      { words: [] as number[] }
    )
    expect(r.source).toBe("snapshot")
  })

  it("sin red ni snapshot: devuelve empty", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    }) as never
    const r = await offlineFetch(
      "/api/x",
      undefined,
      { read: async () => null, write: async () => {} },
      { courses: [] as string[] }
    )
    expect(r).toEqual({ data: { courses: [] }, source: "empty" })
  })

  it("abort se propaga (no se enmascara como offline)", async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    globalThis.fetch = vi.fn(async () => {
      throw new DOMException("Aborted", "AbortError")
    }) as never
    await expect(
      offlineFetch(
        "/api/x",
        { signal: ctrl.signal },
        { read: async () => ({ v: 1 }), write: async () => {} },
        { v: 0 }
      )
    ).rejects.toMatchObject({ name: "AbortError" })
  })

  it("write del snapshot best-effort: no rompe la red ok", async () => {
    globalThis.fetch = vi.fn(async () => Response.json({ ok: true })) as never
    const r = await offlineFetch(
      "/api/x",
      undefined,
      {
        read: async () => null,
        write: async () => {
          throw new Error("quota")
        },
      },
      { ok: false }
    )
    expect(r).toEqual({ data: { ok: true }, source: "network" })
  })
})
