import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"
import { bumpContentVersion } from "@/lib/content-version"

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/courses/[id]/reorder
 * Body { modules?: [moduleIds], lessons?: { [moduleId]: [lessonIds] } }
 * Reasigna `order` por posición (editor+).
 *
 * Fase A T05: +1 por request con ≥1 cambio real; request no-op (listas
 * vacías u orden idéntico) sin bump (BUMP-03). Solo cuentan filas del curso
 * (orden parcial: los ids ajenos se ignoran). Mutación + bump en la misma
 * transacción.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error

  try {
    const { id } = await params
    const course = await db.course.findUnique({ where: { id }, select: { id: true } })
    if (!course) {
      return NextResponse.json({ message: "Curso no encontrado" }, { status: 404 })
    }
    const body = await request.json().catch(() => null)

    const result = await db.$transaction(async (tx) => {
      let changed = 0

      if (Array.isArray(body?.modules)) {
        const ids = (body.modules as unknown[]).filter((v): v is string => typeof v === "string");
        // Solo módulos del curso, con su orden actual para detectar no-ops.
        const owned = await tx.module.findMany({
          where: { courseId: id, id: { in: ids } },
          select: { id: true, order: true },
        });
        const current = new Map(owned.map((m) => [m.id, m.order]));
        const ordered = ids.filter((mid) => current.has(mid));
        for (let order = 0; order < ordered.length; order++) {
          const mid = ordered[order]!;
          if (current.get(mid) !== order) {
            changed++;
            await tx.module.update({ where: { id: mid }, data: { order } });
          }
        }
      }

      if (body?.lessons && typeof body.lessons === "object") {
        for (const [moduleId, lessonIds] of Object.entries(
          body.lessons as Record<string, unknown>
        )) {
          if (!Array.isArray(lessonIds)) continue;
          const mod = await tx.module.findFirst({
            where: { id: moduleId, courseId: id },
            select: { id: true },
          });
          if (!mod) continue;
          const ids = lessonIds.filter((v): v is string => typeof v === "string");
          const owned = await tx.lesson.findMany({
            where: { moduleId, id: { in: ids } },
            select: { id: true },
          });
          const ownedSet = new Set(owned.map((l) => l.id));
          // Orden resultante: las mandadas primero (en ese orden), el resto del
          // módulo después por su order actual. Sin huecos en la numeración.
          const rest = await tx.lesson.findMany({
            where: { moduleId },
            orderBy: [{ order: "asc" }, { id: "asc" }],
            select: { id: true, order: true, lessonNumber: true },
          });
          const seen = new Set<string>();
          const finalOrder: string[] = [];
          for (const lid of ids) {
            if (ownedSet.has(lid) && !seen.has(lid)) {
              seen.add(lid);
              finalOrder.push(lid);
            }
          }
          for (const l of rest) {
            if (!seen.has(l.id)) {
              seen.add(l.id);
              finalOrder.push(l.id);
            }
          }
          const currentById = new Map(rest.map((l) => [l.id, l]));
          // Un solo update por lección solo si order o lessonNumber cambian.
          for (let idx = 0; idx < finalOrder.length; idx++) {
            const lid = finalOrder[idx]!;
            const cur = currentById.get(lid);
            if (!cur || cur.order !== idx || cur.lessonNumber !== idx + 1) {
              changed++;
              await tx.lesson.update({
                where: { id: lid },
                data: { order: idx, lessonNumber: idx + 1 },
              });
            }
          }
        }
      }

      if (changed > 0) {
        await bumpContentVersion(tx);
      }

      return { ok: true, updated: changed };
    });

    return NextResponse.json(result)
  } catch (err) {
    console.error("Course reorder error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
