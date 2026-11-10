import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getContentVersion } from "@/lib/content-version"
import { resolveWordMediaSha256 } from "@/lib/media/word-sha256"

/**
 * GET /api/sync?since=&cursor=&limit= — sincronización incremental (B3.1).
 *
 * - `since`: ISO del último serverTime conocido (default: epoch = todo).
 * - Paginación keyset por (updatedAt, id); `cursor` opaco base64.
 * - Ruta pública, sin sesión (Fase B W2): devuelve upserts PUBLISHED en
 *   ventana y `removedIds` con los borrados duros rastreados por bitácora
 *   DELETE (más la línea de defensa para filas ARCHIVED si el filtro de
 *   consulta se alterara en el futuro).
 */

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 1000

interface Cursor {
  updatedAt: string
  id: string
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url")
}

function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf-8")
    ) as Partial<Cursor>
    if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") return null
    const d = new Date(parsed.updatedAt)
    if (Number.isNaN(d.getTime())) return null
    return { updatedAt: parsed.updatedAt, id: parsed.id }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams
    const rawLimit = Number(params.get("limit") ?? DEFAULT_LIMIT)
    const limit = Number.isFinite(rawLimit)
      ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
      : DEFAULT_LIMIT

    const sinceRaw = params.get("since")
    const since = sinceRaw ? new Date(sinceRaw) : new Date(0)
    const sinceValid = !Number.isNaN(since.getTime()) ? since : new Date(0)
    const cursor = decodeCursor(params.get("cursor"))

    const serverTime = new Date()

    // Ventana de cambios: updatedAt > since (o keyset dentro del mismo ms)
    const updatedFilter = cursor
      ? {
          OR: [
            { updatedAt: { gt: new Date(cursor.updatedAt) } },
            {
              updatedAt: { equals: new Date(cursor.updatedAt) },
              id: { gt: cursor.id },
            },
          ],
        }
      : { updatedAt: { gt: sinceValid } }

    // Fase B W2 (F1): PUBLISHED-only en consulta. El filtro de ventana
    // (`since`/`cursor`) se conjuga como condición obligatoria.
    const rows = await db.dictionaryWord.findMany({
      where: {
        AND: [
          { status: "PUBLISHED" },
          updatedFilter,
        ],
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit + 1,
    })

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const last = page[page.length - 1]

    // Borrados duros: tombstones por bitácora DELETE en la misma ventana.
    // C2: paginado keyset por (createdAt, id) con páginas de 1000 hasta página
    // corta — sin tope duro (el viejo `take: 5000` truncaba en silencio).
    // Mismo patrón keyset del loop de words de arriba.
    const TOMBSTONE_PAGE = 1000;
    const tombstoneIds: string[] = [];
    let tombCursor: { createdAt: Date; id: string } | null = null;
    for (;;) {
      const tombFilter = tombCursor
        ? {
            OR: [
              { createdAt: { gt: tombCursor.createdAt } },
              {
                createdAt: { equals: tombCursor.createdAt },
                id: { gt: tombCursor.id },
              },
            ],
          }
        : { createdAt: { gt: sinceValid } };
      const batch = await db.auditLog.findMany({
        where: {
          action: "DELETE",
          entity: "DictionaryWord",
          ...tombFilter,
        },
        select: { entityId: true, createdAt: true, id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: TOMBSTONE_PAGE,
      });
      for (const t of batch) {
        if (t.entityId) tombstoneIds.push(t.entityId);
      }
      if (batch.length < TOMBSTONE_PAGE) break;
      const lastTomb = batch[batch.length - 1]!;
      tombCursor = { createdAt: lastTomb.createdAt, id: lastTomb.id };
    }

    const removedIds = [
      // T07: comparación normalizada — sana "archived" minúscula histórica.
      // Fase B W2: con el filtro en consulta queda vacío por construcción;
      // se conserva como defensa (costo cero) si el `where` se altera.
      ...page.filter((w) => String(w.status).toUpperCase() === "ARCHIVED").map((w) => w.id),
      ...tombstoneIds,
    ]
    const removedSet = new Set(removedIds)
    // Fase B W2: `page` ya contiene solo PUBLISHED por el filtro en consulta.
    // T07: comparación normalizada como defensa si el `where` se alterara.
    // F1-a: sha256 de medios por palabra (aditivo, una query por página).
    const visible = page.filter((w) => String(w.status).toUpperCase() !== "ARCHIVED")
    const hashes = await resolveWordMediaSha256(visible)
    const words = visible
      .map((w) => ({
        id: w.id,
        spanish: w.spanish,
        nasaYuwe: w.nasaYuwe,
        pronunciation: w.pronunciation,
        audioUrl: w.audioUrl,
        illustrationUrl: w.illustrationUrl,
        culturalContext: w.culturalContext,
        category: w.category,
        examples: w.examples,
        status: w.status,
        updatedAt: w.updatedAt instanceof Date ? w.updatedAt.toISOString() : String(w.updatedAt),
        audioSha256: hashes.get(w.id)?.audioSha256 ?? null,
        illustrationSha256: hashes.get(w.id)?.illustrationSha256 ?? null,
      }))

    return NextResponse.json(
      {
        words,
        removedIds: [...removedSet],
        // Fase A T10: marcador aditivo de publicación (spec §5.1). Ningún campo
        // existente cambia: la APK compara contra su versión cacheada.
        contentVersion: String(await getContentVersion()),
        serverTime: serverTime.toISOString(),
        nextCursor:
          hasMore && last
            ? encodeCursor({
                updatedAt:
                  last.updatedAt instanceof Date
                    ? last.updatedAt.toISOString()
                    : String(last.updatedAt),
                id: last.id,
              })
            : null,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (err) {
    console.error("Sync error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
