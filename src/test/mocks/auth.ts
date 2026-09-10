import { vi } from "vitest"

/**
 * Mock de autenticación (`@/lib/auth`).
 *
 * Uso:
 *
 *   import { mockAuth, allowAdmin, denyAdmin } from "@/test/mocks"
 *   vi.mock("@/lib/auth", () => mockAuth)
 *   import { requireAdmin, requireAuth } from "@/lib/auth"
 *   // ...
 *   allowAdmin()  // requireAdmin resuelve con una sesión admin
 *   denyAdmin()   // requireAdmin resuelve con un error 401
 */

export const mockAuth = vi.hoisted(() => {
  return {
    requireAdmin: vi.fn(),
    requireAuth: vi.fn(),
  }
})

export function adminSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: "admin1",
      name: "Admin",
      email: "admin@nasayuwe.com",
      role: "admin",
      ...overrides,
    },
  }
}

export function userSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: "user1",
      name: "User",
      email: "user@test.com",
      role: "user",
      ...overrides,
    },
  }
}

/** `requireAdmin` resuelve con una sesión admin válida (acceso permitido). */
export function allowAdmin(auth = mockAuth) {
  auth.requireAdmin.mockResolvedValue({ session: adminSession(), error: null })
}

/** `requireAdmin` resuelve con un error 401 (acceso denegado). */
export function denyAdmin(auth = mockAuth) {
  auth.requireAdmin.mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

/** `requireAuth` resuelve con una sesión de usuario válida. */
export function allowUser(auth = mockAuth) {
  auth.requireAuth.mockResolvedValue({ session: userSession(), error: null })
}
