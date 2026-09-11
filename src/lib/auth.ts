import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { canAccessAdminPanel, type Role } from "@/lib/roles"

/**
 * Get the current authenticated session, or return null if not authenticated.
 */
export async function getAuthSession() {
  return getServerSession(authOptions)
}

/**
 * Sesión garantizada por requireAuth/requireRole: usuario presente con id.
 * Centraliza el tipado para no repetir casts inseguros en cada ruta.
 */
export interface AuthedSession {
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string
  }
  expires: string
}

type GuardOk = { session: AuthedSession; error: null }
type GuardFail = { session: null; error: Response }

/**
 * Require that the current user is authenticated.
 * Returns the session if authenticated, or a NextResponse error if not.
 */
export async function requireAuth(): Promise<GuardOk | GuardFail> {
  const session = await getServerSession(authOptions)
  const rawUser = session?.user as
    | { id?: unknown; name?: string | null; email?: string | null }
    | undefined

  if (!session?.user || typeof rawUser?.id !== "string" || !rawUser.id) {
    return {
      session: null,
      error: Response.json(
        { message: "Debes iniciar sesión para acceder a este recurso" },
        { status: 401 }
      ),
    }
  }

  return {
    session: {
      ...session,
      user: {
        ...session.user,
        id: rawUser.id,
      },
    } as AuthedSession,
    error: null,
  }
}

/**
 * Require that the current user is authenticated AND has one of the given roles.
 * `editor` incluye a `admin` (jerarquía user < editor < admin).
 * Returns the session if authorized, or a NextResponse error if not.
 */
export async function requireRole(...allowed: Role[]) {
  const { session, error } = await requireAuth()

  if (error) return { session: null, error }

  const role = (session!.user as { role?: string }).role

  const ok =
    allowed.includes("user") ||
    (allowed.includes("editor") && (role === "editor" || role === "admin")) ||
    (allowed.includes("admin") && role === "admin")

  if (!ok) {
    return {
      session: null,
      error: Response.json(
        { message: "Acceso denegado. Tu rol no permite esta acción." },
        { status: 403 }
      ),
    }
  }

  return { session, error: null }
}

/**
 * Require that the current user is authenticated AND has the "admin" role.
 * Returns the session if authorized, or a NextResponse error if not.
 */
export async function requireAdmin() {
  return requireRole("admin")
}

/**
 * Check if a session has admin role (type-safe helper).
 */
export function isAdmin(session: { user?: { role?: string } | null } | null): boolean {
  if (!session?.user) return false
  const role = (session.user as { role?: string }).role
  return role === "admin"
}

/**
 * Check if a session may enter /admin (editor y admin).
 */
export function canUseAdminPanel(
  session: { user?: { role?: string } | null } | null
): boolean {
  if (!session?.user) return false
  return canAccessAdminPanel((session.user as { role?: string }).role)
}
