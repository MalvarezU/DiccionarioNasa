import { beforeAll, describe, expect, it, vi } from "vitest"

vi.stubEnv("NEXTAUTH_SECRET", "test-secret-b16")

const { authOptions, ADMIN_INACTIVITY_LIMIT_S, USER_INACTIVITY_LIMIT_S } =
  await import("./route")

const jwt = authOptions.callbacks!.jwt!

function tokenWith(lastActivity: number, role = "admin") {
  return { id: "u1", role, lastActivity } as never
}

describe("nextauth jwt inactivity timeout (B1.6)", () => {
  beforeAll(() => {
    vi.useFakeTimers()
  })

  it("expone los limites por rol (admin 30 min, resto 30 dias)", () => {
    expect(ADMIN_INACTIVITY_LIMIT_S).toBe(30 * 60)
    expect(USER_INACTIVITY_LIMIT_S).toBe(30 * 24 * 3600)
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

  it("destruye la sesion admin tras 30 min de inactividad", async () => {
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"))
    const base = Math.floor(Date.now() / 1000)
    vi.setSystemTime(new Date("2026-09-11T10:31:00Z"))
    const out = await jwt({ token: tokenWith(base), user: undefined } as never)
    expect(out).toBeNull()
  })

  it("el usuario normal sobrevive 24h pero expira a los 30 dias", async () => {
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"))
    const base = Math.floor(Date.now() / 1000)

    vi.setSystemTime(new Date("2026-09-12T09:00:00Z"))
    const alive = (await jwt({
      token: tokenWith(base, "user"),
      user: undefined,
    } as never)) as unknown as Record<string, unknown>
    expect(alive).not.toBeNull()

    vi.setSystemTime(new Date("2026-10-12T10:00:01Z"))
    const dead = await jwt({
      token: tokenWith(base, "user"),
      user: undefined,
    } as never)
    expect(dead).toBeNull()
  })

  it("el editor tiene el limite largo de usuario normal", async () => {
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"))
    const base = Math.floor(Date.now() / 1000)
    vi.setSystemTime(new Date("2026-09-11T11:00:00Z"))
    const out = (await jwt({
      token: tokenWith(base, "editor"),
      user: undefined,
    } as never)) as unknown as Record<string, unknown>
    expect(out).not.toBeNull()
    expect(out.id).toBe("u1")
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
