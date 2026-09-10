import { describe, it, expect, beforeEach } from "vitest"
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  __resetRateLimitStore,
} from "./rate-limit"

describe("checkRateLimit", () => {
  beforeEach(() => __resetRateLimitStore())

  it("permite hasta el límite dentro de la ventana", () => {
    expect(checkRateLimit("k", 3, 60_000, 1000).allowed).toBe(true)
    expect(checkRateLimit("k", 3, 60_000, 2000).allowed).toBe(true)
    expect(checkRateLimit("k", 3, 60_000, 3000).allowed).toBe(true)
  })

  it("bloquea al superar el límite e informa retryAfterMs", () => {
    checkRateLimit("k", 2, 60_000, 0)
    checkRateLimit("k", 2, 60_000, 10_000)
    const res = checkRateLimit("k", 2, 60_000, 20_000)

    expect(res.allowed).toBe(false)
    expect(res.retryAfterMs).toBe(40_000)
  })

  it("re-permite cuando la ventana se desplaza", () => {
    checkRateLimit("k", 1, 60_000, 0)
    expect(checkRateLimit("k", 1, 60_000, 30_000).allowed).toBe(false)
    expect(checkRateLimit("k", 1, 60_000, 60_001).allowed).toBe(true)
  })

  it("aísla claves distintas", () => {
    checkRateLimit("a", 1, 60_000, 0)
    expect(checkRateLimit("b", 1, 60_000, 0).allowed).toBe(true)
    expect(checkRateLimit("a", 1, 60_000, 0).allowed).toBe(false)
  })
})

describe("getClientIp", () => {
  it("usa x-forwarded-for (primera IP)", () => {
    const req = {
      headers: { get: (n: string) => (n === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null) },
    }
    expect(getClientIp(req)).toBe("1.2.3.4")
  })

  it("cae a x-real-ip y luego a unknown", () => {
    expect(
      getClientIp({ headers: { get: (n: string) => (n === "x-real-ip" ? "9.9.9.9" : null) } })
    ).toBe("9.9.9.9")
    expect(getClientIp({} as never)).toBe("unknown")
    expect(getClientIp({ headers: null } as never)).toBe("unknown")
  })
})

describe("rateLimitResponse", () => {
  it("devuelve 429 con header Retry-After", async () => {
    const res = rateLimitResponse(45_000)
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("45")
    const body = await res.json()
    expect(body.message).toContain("Demasiadas solicitudes")
  })
})
