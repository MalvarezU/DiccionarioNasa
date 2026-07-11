import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}))

import { getServerSession } from "next-auth"
import { getAuthSession, requireAuth, requireAdmin, isAdmin } from "@/lib/auth"

describe("auth helpers", () => {
  beforeEach(() => vi.clearAllMocks())

  describe("getAuthSession", () => {
    it("returns the session from getServerSession", async () => {
      const mockSession = { user: { id: "u1", role: "admin" } } as never
      vi.mocked(getServerSession).mockResolvedValue(mockSession)
      const result = await getAuthSession()
      expect(result).toBe(mockSession)
    })

    it("returns null when no session", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)
      const result = await getAuthSession()
      expect(result).toBeNull()
    })
  })

  describe("requireAuth", () => {
    it("returns session when authenticated", async () => {
      const mockSession = { user: { id: "u1" } } as never
      vi.mocked(getServerSession).mockResolvedValue(mockSession)
      const result = await requireAuth()
      expect(result.session).toBe(mockSession)
      expect(result.error).toBeNull()
    })

    it("returns 401 error when no session", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)
      const result = await requireAuth()
      expect(result.session).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error!.status).toBe(401)
    })

    it("returns 401 error when session has no user", async () => {
      vi.mocked(getServerSession).mockResolvedValue({ user: null } as never)
      const result = await requireAuth()
      expect(result.session).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error!.status).toBe(401)
    })
  })

  describe("requireAdmin", () => {
    it("returns session when user is admin", async () => {
      const mockSession = { user: { id: "u1", role: "admin" } } as never
      vi.mocked(getServerSession).mockResolvedValue(mockSession)
      const result = await requireAdmin()
      expect(result.session).toBe(mockSession)
      expect(result.error).toBeNull()
    })

    it("returns 403 error when user is not admin", async () => {
      const mockSession = { user: { id: "u1", role: "user" } } as never
      vi.mocked(getServerSession).mockResolvedValue(mockSession)
      const result = await requireAdmin()
      expect(result.session).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error!.status).toBe(403)
    })

    it("returns 403 error when user has no role", async () => {
      const mockSession = { user: { id: "u1" } } as never
      vi.mocked(getServerSession).mockResolvedValue(mockSession)
      const result = await requireAdmin()
      expect(result.session).toBeNull()
      expect(result.error!.status).toBe(403)
    })

    it("returns 401 error when not authenticated", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)
      const result = await requireAdmin()
      expect(result.session).toBeNull()
      expect(result.error!.status).toBe(401)
    })
  })

  describe("isAdmin", () => {
    it("returns true when session user has admin role", () => {
      expect(isAdmin({ user: { role: "admin" } })).toBe(true)
    })

    it("returns false when session user has user role", () => {
      expect(isAdmin({ user: { role: "user" } })).toBe(false)
    })

    it("returns false when session has no user", () => {
      expect(isAdmin({ user: null })).toBe(false)
    })

    it("returns false when session is null", () => {
      expect(isAdmin(null)).toBe(false)
    })

    it("returns false when user has no role", () => {
      expect(isAdmin({ user: {} })).toBe(false)
    })
  })
})