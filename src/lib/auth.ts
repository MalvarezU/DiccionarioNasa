import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

/**
 * Get the current authenticated session, or return null if not authenticated.
 */
export async function getAuthSession() {
  return getServerSession(authOptions)
}

/**
 * Require that the current user is authenticated.
 * Returns the session if authenticated, or a NextResponse error if not.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return {
      session: null,
      error: Response.json(
        { message: "Debes iniciar sesión para acceder a este recurso" },
        { status: 401 }
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
  const { session, error } = await requireAuth()

  if (error) return { session: null, error }

  const role = (session!.user as { role?: string }).role

  if (role !== "admin") {
    return {
      session: null,
      error: Response.json(
        { message: "Acceso denegado. Se requiere rol de administrador." },
        { status: 403 }
      ),
    }
  }

  return { session, error: null }
}

/**
 * Check if a session has admin role (type-safe helper).
 */
export function isAdmin(session: { user?: { role?: string } | null } | null): boolean {
  if (!session?.user) return false
  const role = (session.user as { role?: string }).role
  return role === "admin"
}
