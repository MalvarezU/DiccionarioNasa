import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * PATCH /api/admin/users/[id]
 *
 * Update a user's role (admin only).
 * Body: { role: "admin" | "user" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const { role } = body

    if (!role || !["admin", "user"].includes(role)) {
      return NextResponse.json(
        { message: 'El rol debe ser "admin" o "user"' },
        { status: 400 }
      )
    }

    // Prevent self-demotion
    if (id === (session!.user as { id: string }).id && role === "user") {
      return NextResponse.json(
        { message: "No puedes quitarte tu propio rol de administrador" },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json(
        { message: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    const updated = await db.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "User",
        entityId: id,
        changes: JSON.stringify({
          field: "role",
          from: user.role,
          to: role,
          responsable: session!.user.name || session!.user.email,
        }),
        userId: (session!.user as { id: string }).id,
      },
    })

    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error("Update user role error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[id]
 *
 * Delete a user account (admin only).
 * Cannot delete self.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  try {
    const { id } = await params

    // Prevent self-deletion
    if (id === (session!.user as { id: string }).id) {
      return NextResponse.json(
        { message: "No puedes eliminar tu propia cuenta" },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json(
        { message: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    await db.user.delete({ where: { id } })

    // Audit log
    await db.auditLog.create({
      data: {
        action: "DELETE",
        entity: "User",
        entityId: id,
        changes: JSON.stringify({
          email: user.email,
          name: user.name,
          role: user.role,
          responsable: session!.user.name || session!.user.email,
        }),
        userId: (session!.user as { id: string }).id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Delete user error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
