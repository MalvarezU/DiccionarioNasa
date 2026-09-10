import { vi } from "vitest"

/**
 * Mocks complementarios reutilizados en varias rutas:
 *  - `next-auth` (`getServerSession`, providers, authOptions)
 *  - `bcryptjs`
 *  - `next-auth/react` (SessionProvider) y Supabase server, cuando aplica.
 */

export const mockNextAuth = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  default: vi.fn(),
}))

export const mockBcrypt = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn(),
}))

/**
 * Fábrica estándar de mocks para rutas que usan NextAuth + bcrypt.
 * Reemplaza el bloque repetido de:
 *
 *   vi.mock("next-auth", ...)
 *   vi.mock("next-auth/providers/credentials", ...)
 *   vi.mock("bcryptjs", ...)
 *   vi.mock("@/app/api/auth/[...nextauth]/route", ...)
 */
export function installNextAuthMocks() {
  vi.mock("next-auth", () => ({
    getServerSession: mockNextAuth.getServerSession,
    default: mockNextAuth.default,
  }))
  vi.mock("next-auth/providers/credentials", () => ({
    default: vi.fn(),
  }))
  vi.mock("bcryptjs", () => ({
    compare: mockBcrypt.compare,
  }))
  vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
    authOptions: {},
  }))
}
