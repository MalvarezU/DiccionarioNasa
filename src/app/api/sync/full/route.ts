import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getContentVersion } from "@/lib/content-version"
import { isValidCiSecret, ciUnauthorized } from "@/lib/ci-auth"
import { publicUrl } from "@/lib/r2"
import { r2PublicBase } from "@/lib/media/storage"
import { parseLessonContent } from "@/lib/courses/blocks"
import {
  collectMediaRefs,
  refsToKeys,
} from "@/lib/sync/full-bundle"

/**
 * GET /api/sync/full — semilla completa para CI (Fase B W3b, Fase C la consume).
 *
 * Auth: solo encabezado `X-CI-Secret` (nunca query string, nunca sesión).
 * Sin params (se ignoran), sin paginación (decisión F2: bundle único).
 * `Cache-Control: private, no-store` en 200 y 401: nunca cacheable.
 *
 * Todo o nada: cualquier excepción (incluida base R2 ausente durante la
 * serialización) responde 500 completo. No existe 206 ni bundle sin `media`.
 *
 * Recortes obligatorios respecto del detalle público `courses/[id]`:
 * 1. Rama `stats` de editor+ excluida (cero consultas a userLessonProgress).
 * 2. `deletedAt` excluido en cada nivel (mapeo explícito, nunca spread crudo).
 * 3. El bundle NO resuelve palabras embebidas de bloques (word/vocabulary):
 *    la forma exacta no tiene campo para ellas; las lecciones viajan con su
 *    `content` crudo (documento corrupto incluido igual, E5).
 */

const PRIVATE_NO_STORE = "private, no-store"

export async function GET(request: NextRequest): Promise<Response> {
  if (!isValidCiSecret(request.headers.get("x-ci-secret"))) {
    return ciUnauthorized()
  }

  try {
    // Base R2 ausente = bundle incoherente (toda media.url la necesita):
    // falla cerrado a 500 antes de serializar (E3).
    const base = r2PublicBase()
    if (!base) throw new Error("[sync/full] R2_PUBLIC_BASE_URL ausente")

    const [wordRows, courseRows] = await Promise.all([
      db.dictionaryWord.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { id: "asc" },
      }),
      db.course.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { id: "asc" },
        include: {
          modules: {
            where: { deletedAt: null },
            orderBy: { order: "asc" },
            include: {
              lessons: {
                where: { deletedAt: null },
                orderBy: [{ lessonNumber: "asc" }, { id: "asc" }],
              },
            },
          },
        },
      }),
    ])

    const words = wordRows.map((w) => ({
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
    }))

    const courses = courseRows.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      coverImage: c.coverImage,
      status: c.status,
      sequential: c.sequential,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
      modules: c.modules.map((m) => ({
        id: m.id,
        courseId: m.courseId,
        title: m.title,
        order: m.order,
        updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : String(m.updatedAt),
        lessons: m.lessons.map((l) => ({
          id: l.id,
          moduleId: l.moduleId,
          title: l.title,
          order: l.order,
          lessonNumber: l.lessonNumber,
          content: l.content,
          updatedAt:
            l.updatedAt instanceof Date ? l.updatedAt.toISOString() : String(l.updatedAt),
        })),
      })),
    }))

    // Manifiesto por referencias (spec §3.4): candidatos del bundle →
    // claves R2 válidas → filas con hash (nunca tabla completa, R4).
    // Documento corrupto: parseLessonContent falla → cero bloques para esa
    // lección, la lección igual se incluye (E5, precedente on-demand).
    const lessonBlocks = courseRows.flatMap((c) =>
      c.modules.flatMap((m) =>
        m.lessons.map((l) => {
          const parsed = parseLessonContent(l.content)
          return parsed.ok ? parsed.content.blocks : []
        })
      )
    )
    const candidates = collectMediaRefs({
      words: wordRows.map((w) => ({
        audioUrl: w.audioUrl,
        illustrationUrl: w.illustrationUrl,
      })),
      courses: courseRows.map((c) => ({ coverImage: c.coverImage })),
      lessonBlocks,
    })
    const keys = refsToKeys(candidates)
    const assets =
      keys.length > 0
        ? await db.mediaAsset.findMany({
            where: { objectKey: { in: keys }, sha256: { not: null } },
          })
        : []
    const media = assets.map((a) => ({
      objectKey: a.objectKey,
      url: publicUrl(a.objectKey),
      sha256: a.sha256,
      size: a.size,
      mimeType: a.mimeType,
    }))

    return NextResponse.json(
      { contentVersion: await getContentVersion(), words, courses, media },
      { headers: { "Cache-Control": PRIVATE_NO_STORE } }
    )
  } catch (err) {
    console.error("Sync full error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
