import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"

/**
 * GET /api/admin/stats
 *
 * Returns dashboard statistics for the admin panel.
 */
export async function GET() {
  const { session, error } = await requireAdmin()
  if (error) return error

  try {
    // Total words (ALL statuses: DRAFT + PUBLISHED + ARCHIVED)
    const totalWords = await db.dictionaryWord.count()

    // Words by status
    const [draftCount, publishedCount, archivedCount] = await Promise.all([
      db.dictionaryWord.count({ where: { status: "DRAFT" } }),
      db.dictionaryWord.count({ where: { status: "PUBLISHED" } }),
      db.dictionaryWord.count({ where: { status: "ARCHIVED" } }),
    ])

    // Words with audio (all statuses)
    const wordsWithAudio = await db.dictionaryWord.count({
      where: { audioUrl: { not: null } },
    })

    // Published words WITHOUT audio (HU3.5.3)
    const publishedWithoutAudio = await db.dictionaryWord.count({
      where: {
        status: "PUBLISHED",
        audioUrl: null,
      },
    })

    // Total users
    const totalUsers = await db.user.count()

    // Total favorites
    const totalFavorites = await db.favorite.count()

    // Words created in the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentWords = await db.dictionaryWord.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    })

    // Recent audit log entries (last 10) (HU3.5.4)
    const recentAuditLogs = await db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        changes: true,
        userId: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      totalWords,
      draftCount,
      publishedCount,
      archivedCount,
      wordsWithAudio,
      publishedWithoutAudio,
      totalUsers,
      totalFavorites,
      recentWords,
      recentAuditLogs,
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
