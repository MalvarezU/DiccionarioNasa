import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}))

import { getServerSession } from "next-auth"
import { getAuthSession, requireAuth, requireAdmin, requireRole, isAdmin, canUseAdminPanel } from "@/lib/auth"
import { ROLES, isRole, canEdit, canAdminister } from "@/lib/roles"

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

  describe("requireRole (B1.5)", () => {
    const sess = (role?: string) =>
      ({ user: { id: "u1", ...(role !== undefined ? { role } : {}) } }) as never

    it("editor pasa donde se pide editor; admin también (jerarquía)", async () => {
      vi.mocked(getServerSession).mockResolvedValue(sess("editor"))
      expect((await requireRole("editor")).error).toBeNull()
      vi.mocked(getServerSession).mockResolvedValue(sess("admin"))
      expect((await requireRole("editor")).error).toBeNull()
    })

    it("user recibe 403 donde se pide editor", async () => {
      vi.mocked(getServerSession).mockResolvedValue(sess("user"))
      const result = await requireRole("editor")
      expect(result.session).toBeNull()
      expect(result.error!.status).toBe(403)
    })

    it("editor recibe 403 donde se pide admin", async () => {
      vi.mocked(getServerSession).mockResolvedValue(sess("editor"))
      const result = await requireRole("admin")
      expect(result.session).toBeNull()
      expect(result.error!.status).toBe(403)
    })

    it("sin sesión recibe 401", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)
      const result = await requireRole("editor")
      expect(result.error!.status).toBe(401)
    })
  })

  describe("canUseAdminPanel", () => {
    it("admite editor y admin, niega resto", () => {
      expect(canUseAdminPanel({ user: { role: "editor" } })).toBe(true)
      expect(canUseAdminPanel({ user: { role: "admin" } })).toBe(true)
      expect(canUseAdminPanel({ user: { role: "user" } })).toBe(false)
      expect(canUseAdminPanel(null)).toBe(false)
    })
  })

  describe("roles", () => {
    it("define user < editor < admin", () => {
      expect([...ROLES]).toEqual(["user", "editor", "admin"])
      expect(isRole("editor")).toBe(true)
      expect(isRole("superadmin")).toBe(false)
      expect(canEdit("editor")).toBe(true)
      expect(canEdit("admin")).toBe(true)
      expect(canEdit("user")).toBe(false)
      expect(canAdminister("editor")).toBe(false)
      expect(canAdminister("admin")).toBe(true)
    })
  })
})