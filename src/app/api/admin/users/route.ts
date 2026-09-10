import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/admin/users
 *
 * List all users (admin only).
 * Supports ?search= filter and ?page=&pageSize= pagination
 * (default pageSize 20, max 100).
 */
export async function GET(request: NextRequest) {
  const { session, error } = await requireAdmin()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || undefined

    const rawPage = Number(searchParams.get("page") ?? "1")
    const rawPageSize = Number(searchParams.get("pageSize") ?? "20")
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
    const pageSize = Number.isFinite(rawPageSize)
      ? Math.min(100, Math.max(1, Math.floor(rawPageSize)))
      : 20

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              favorites: true,
              viewHistory: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.user.count({ where }),
    ])

    return NextResponse.json({
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error("List users error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
