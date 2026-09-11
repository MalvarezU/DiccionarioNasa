import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { mockDb } = vi.hoisted(() => ({
  mockDb: { user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } },
}))
vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
  compare: vi.fn(),
  hash: vi.fn(),
}))

vi.stubEnv("NEXTAUTH_SECRET", "test-secret-b16")

const { authOptions, ADMIN_INACTIVITY_LIMIT_S, USER_INACTIVITY_LIMIT_S } =
  await import("./route")
const { __resetLoginLockoutStore } = await import("@/lib/login-lockout")
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

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

describe("authorize con bloqueo CA-22 (B1.4)", () => {  // Se testea la función exportada: el objeto crudo del factory trae
  // authorize=()=>null y solo el core de NextAuth fusiona `options`.
  const authorize = async (creds: unknown, req?: unknown) =>
    (
      await import("./route")
    ).authorizeCredentials(
      creds as Record<"email" | "password", string> | undefined,
      req
    )
  const req = { headers: { "x-forwarded-for": "5.5.5.5" } }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    __resetLoginLockoutStore()
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
  })

  it("bloquea tras 5 fallos sin consultar la BD (indistinguible)", async () => {
    for (let i = 0; i < 5; i++) {
      expect(
        await authorize({ email: "v@x.com", password: "mal" }, req)
      ).toBeNull()
    }
    vi.clearAllMocks()
    expect(
      await authorize({ email: "v@x.com", password: "bien1234" }, req)
    ).toBeNull()
    // Bloqueado: ni siquiera pregunta a la BD (anti-enumeración)
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })

  it("el exito limpia el contador de fallos", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "v@x.com",
      password: "hashed",
      role: "user",
    } as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    for (let i = 0; i < 4; i++) {
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never)
      expect(
        await authorize({ email: "v@x.com", password: "mal" }, req)
      ).toBeNull()
    }
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    const ok = (await authorize(
      { email: "v@x.com", password: "bien1234" },
      req
    )) as unknown as Record<string, unknown>
    expect(ok.id).toBe("u1")

    // Tras el éxito, 4 fallos más no bloquean
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
    for (let i = 0; i < 4; i++) {
      expect(
        await authorize({ email: "v@x.com", password: "mal" }, req)
      ).toBeNull()
    }
    expect(db.user.findUnique).toHaveBeenCalled()
  })

  it("el bloqueo es por cuenta+IP", async () => {
    for (let i = 0; i < 5; i++) {
      await authorize({ email: "v@x.com", password: "mal" }, req)
    }
    vi.clearAllMocks()
    // Otra IP sí consulta la BD
    await authorize(
      { email: "v@x.com", password: "x" },
      { headers: { "x-forwarded-for": "9.9.9.9" } }
    )
    expect(db.user.findUnique).toHaveBeenCalledTimes(1)
  })
})

describe("signIn exige email verificado en credenciales (B1.2)", () => {
  const signIn = authOptions.callbacks!.signIn!

  it("niega credenciales sin verificar y admite verificadas", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ emailVerified: null } as never)
    expect(
      await signIn({
        user: { email: "n@x.com" },
        account: { provider: "credentials" },
      } as never)
    ).toBe(false)

    vi.mocked(db.user.findUnique).mockResolvedValue({
      emailVerified: new Date(),
    } as never)
    expect(
      await signIn({
        user: { email: "v@x.com" },
        account: { provider: "credentials" },
      } as never)
    ).toBe(true)
  })

  it("Google crea la cuenta verificada al primer login [B1.3]", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    vi.mocked(db.user.create).mockResolvedValue({ id: "g1" } as never)
    expect(
      await signIn({
        user: { email: "G@x.com", name: "Gugl" },
        account: { provider: "google" },
      } as never)
    ).toBe(true)
    expect(vi.mocked(db.user.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "g@x.com",
          role: "user",
          emailVerified: expect.any(Date),
        }),
      })
    )
  })

  it("Google existente entra y marca verificado si faltaba [B1.3]", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "g1",
      emailVerified: null,
    } as never)
    vi.mocked(db.user.update).mockResolvedValue({} as never)
    expect(
      await signIn({
        user: { email: "g@x.com" },
        account: { provider: "google" },
      } as never)
    ).toBe(true)
    expect(vi.mocked(db.user.update)).toHaveBeenCalled()
  })

  it("proveedor desconocido pasa (comportamiento previo)", async () => {
    expect(
      await signIn({ user: { email: "x@x.com" }, account: { provider: "github" } } as never)
    ).toBe(true)
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })
})
