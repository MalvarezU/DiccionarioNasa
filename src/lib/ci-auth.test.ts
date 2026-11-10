import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { expectedCiSecret, isValidCiSecret, ciUnauthorized } from "./ci-auth"

const SECRET = "test-ci-secret-abc123"

describe("ci-auth [Fase B W3a]", () => {
  const OLD = process.env.CI_SYNC_SECRET

  beforeEach(() => {
    process.env.CI_SYNC_SECRET = SECRET
  })

  afterEach(() => {
    if (OLD === undefined) delete process.env.CI_SYNC_SECRET
    else process.env.CI_SYNC_SECRET = OLD
  })

  it("sin encabezado (null/undefined/vacío) → inválido", () => {
    expect(isValidCiSecret(null)).toBe(false)
    expect(isValidCiSecret(undefined)).toBe(false)
    expect(isValidCiSecret("")).toBe(false)
  })

  it("secreto inválido → 401 idéntico al de ausencia (mismo estado y cuerpo, sin oráculo)", async () => {
    expect(isValidCiSecret("secreto-incorrecto")).toBe(false)

    const sinHeader = ciUnauthorized()
    expect(sinHeader.status).toBe(401)
    expect(await sinHeader.json()).toEqual({ message: "No autorizado" })
    // Sin Cache-Control público: la ruta CI nunca es cacheable.
    expect(sinHeader.headers.get("Cache-Control")).toBe("private, no-store")
  })

  it("secreto válido → pasa", () => {
    expect(isValidCiSecret(SECRET)).toBe(true)
  })

  it("longitudes distintas no lanzan (resguardo previo a timingSafeEqual)", () => {
    expect(() => isValidCiSecret("corto")).not.toThrow()
    expect(isValidCiSecret("corto")).toBe(false)
    expect(() => isValidCiSecret(SECRET + "-mucho-mas-largo")).not.toThrow()
    expect(isValidCiSecret(SECRET + "-mucho-mas-largo")).toBe(false)
  })

  it("CI_SYNC_SECRET ausente o vacío → todo 401 (falla cerrado)", () => {
    delete process.env.CI_SYNC_SECRET
    expect(expectedCiSecret()).toBeNull()
    expect(isValidCiSecret(SECRET)).toBe(false)

    process.env.CI_SYNC_SECRET = ""
    expect(expectedCiSecret()).toBeNull()
    expect(isValidCiSecret("cualquier-cosa")).toBe(false)
  })
})
