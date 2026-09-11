import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  __resetLoginLockoutStore,
  getAuthorizeIp,
  isLoginLocked,
  lockoutKey,
  recordLoginFailure,
  resetLoginAttempts,
} from "./login-lockout"

describe("login-lockout (CA-22)", () => {
  beforeEach(() => {
    __resetLoginLockoutStore()
    vi.useRealTimers()
  })

  it("bloquea tras 5 fallos por cuenta+IP durante 15 min", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"))
    for (let i = 0; i < 5; i++) {
      expect(isLoginLocked("a@x.com", "1.1.1.1")).toBe(false)
      recordLoginFailure("a@x.com", "1.1.1.1")
    }
    expect(isLoginLocked("a@x.com", "1.1.1.1")).toBe(true)

    vi.setSystemTime(new Date("2026-09-11T10:14:59Z"))
    expect(isLoginLocked("a@x.com", "1.1.1.1")).toBe(true)
    vi.setSystemTime(new Date("2026-09-11T10:15:01Z"))
    expect(isLoginLocked("a@x.com", "1.1.1.1")).toBe(false)
  })

  it("aisla por cuenta, por IP y normaliza email", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure("User@X.com", "1.1.1.1")
    expect(isLoginLocked("user@x.com", "1.1.1.1")).toBe(true)
    expect(isLoginLocked("user@x.com", "2.2.2.2")).toBe(false)
    expect(isLoginLocked("other@x.com", "1.1.1.1")).toBe(false)
    expect(lockoutKey(" User@X.com ", "1.1.1.1")).toBe(lockoutKey("user@x.com", "1.1.1.1"))
  })

  it("el exito limpia el contador", () => {
    for (let i = 0; i < 4; i++) recordLoginFailure("a@x.com", "1.1.1.1")
    resetLoginAttempts("a@x.com", "1.1.1.1")
    expect(isLoginLocked("a@x.com", "1.1.1.1")).toBe(false)
  })

  it("extrae IP de Headers, objeto plano o unknown", () => {
    expect(getAuthorizeIp(null)).toBe("unknown")
    expect(getAuthorizeIp({})).toBe("unknown")
    expect(
      getAuthorizeIp({ headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8" } })
    ).toBe("9.9.9.9")
    expect(getAuthorizeIp({ headers: { "x-real-ip": "7.7.7.7" } })).toBe(
      "7.7.7.7"
    )
    const h = new Headers({ "x-forwarded-for": "6.6.6.6" })
    expect(getAuthorizeIp({ headers: h })).toBe("6.6.6.6")
  })
})
