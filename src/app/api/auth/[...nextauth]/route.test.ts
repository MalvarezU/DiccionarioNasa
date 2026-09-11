import { beforeAll, describe, expect, it, vi } from "vitest"

vi.stubEnv("NEXTAUTH_SECRET", "test-secret-b16")

const { authOptions, INACTIVITY_LIMIT_S } = await import("./route")

const jwt = authOptions.callbacks!.jwt!

function tokenWith(lastActivity: number) {
  return { id: "u1", role: "admin", lastActivity } as never
}

describe("nextauth jwt inactivity timeout (B1.6)", () => {
  beforeAll(() => {
    vi.useFakeTimers()
  })

  it("expone el limite de 30 minutos", () => {
    expect(INACTIVITY_LIMIT_S).toBe(30 * 60)
  })

  it("fija lastActivity al iniciar sesion", async () => {
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"))
    const out = (await jwt({
      token: {},
      user: { id: "u1", role: "admin" },
    } as never)) as unknown as Record<string, unknown>
    expect(out.id).toBe("u1")
    expect(out.lastActivity).toBe(Math.floor(Date.now() / 1000))
  })

  it("mantiene la sesion dentro de la ventana", async () => {
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"))
    const base = Math.floor(Date.now() / 1000)
    vi.setSystemTime(new Date("2026-09-11T10:20:00Z"))
    const out = (await jwt({
      token: tokenWith(base),
      user: undefined,
    } as never)) as unknown as Record<string, unknown>
    expect(out).not.toBeNull()
    expect(out.id).toBe("u1")
  })

  it("destruye la sesion tras 30 min de inactividad", async () => {
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"))
    const base = Math.floor(Date.now() / 1000)
    vi.setSystemTime(new Date("2026-09-11T10:31:00Z"))
    const out = await jwt({ token: tokenWith(base), user: undefined } as never)
    expect(out).toBeNull()
  })

  it("no re-sella la cookie antes de 5 min", async () => {
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"))
    const base = Math.floor(Date.now() / 1000)
    vi.setSystemTime(new Date("2026-09-11T10:04:00Z"))
    const out = (await jwt({
      token: tokenWith(base),
      user: undefined,
    } as never)) as unknown as Record<string, unknown>
    expect(out.lastActivity).toBe(base)
  })

  it("re-sella la cookie tras 5 min de actividad", async () => {
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"))
    const base = Math.floor(Date.now() / 1000)
    vi.setSystemTime(new Date("2026-09-11T10:06:00Z"))
    const out = (await jwt({
      token: tokenWith(base),
      user: undefined,
    } as never)) as unknown as Record<string, unknown>
    expect(out.lastActivity).toBe(base + 6 * 60)
  })
})
