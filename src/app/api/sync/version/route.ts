import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/sync/version — marcador de publicación para SKIP-BUILD (Fase B W1).
 *
 * Ruta pública: sin autenticación, sin parámetros, sin paginación.
 * Lectura fresca por request (sin caché en memoria), igual que sync/seed.
 * Primer precedente de `Cache-Control` del repositorio (valor literal
 * compartido con las lecturas públicas de W2).
 *
 * Fase D W0 (aditivo): además de `contentVersion` emite `serverTime`
 * (ISO-8601 UTC desde `updatedAt` de la fila `ContentVersion(id = 1)`),
 * exigido por `VersionResponseSchema` de la app. Sin migraciones.
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const row = await db.contentVersion.findUnique({ where: { id: 1 } })
    const contentVersion = String(row?.version ?? 1)
    const serverTime = (row?.updatedAt ?? new Date()).toISOString()
    return NextResponse.json(
      { contentVersion, serverTime },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (err) {
    console.error("Sync version error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
