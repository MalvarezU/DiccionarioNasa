import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/courses/[id]/reorder
 * Body { modules?: [moduleIds], lessons?: { [moduleId]: [lessonIds] } }
 * Reasigna `order` por posición (editor+).
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
    const ops: Array<Promise<unknown>> = []

    if (Array.isArray(body?.modules)) {
      const ids = (body.modules as unknown[]).filter((v): v is string => typeof v === "string");
      // Solo módulos del curso
      const owned = await db.module.findMany({
        where: { courseId: id, id: { in: ids } },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((m) => m.id));
      ids.forEach((mid, order) => {
        if (ownedSet.has(mid)) {
          ops.push(db.module.update({ where: { id: mid }, data: { order } }));
        }
      });
    }

    if (body?.lessons && typeof body.lessons === "object") {
      for (const [moduleId, lessonIds] of Object.entries(
        body.lessons as Record<string, unknown>
      )) {
        if (!Array.isArray(lessonIds)) continue;
        const mod = await db.module.findFirst({
          where: { id: moduleId, courseId: id },
          select: { id: true },
        });
        if (!mod) continue;
        const ids = lessonIds.filter((v): v is string => typeof v === "string");
        const owned = await db.lesson.findMany({
          where: { moduleId, id: { in: ids } },
          select: { id: true },
        });
        const ownedSet = new Set(owned.map((l) => l.id));
        // Orden resultante: las mandadas primero (en ese orden), el resto del
        // módulo después por su order actual. Sin huecos en la numeración.
        const rest = await db.lesson.findMany({
          where: { moduleId },
          orderBy: [{ order: "asc" }, { id: "asc" }],
          select: { id: true },
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
        // Un solo update por lección: order + lessonNumber (1..N) juntos
        finalOrder.forEach((lid, idx) => {
          ops.push(
            db.lesson.update({ where: { id: lid }, data: { order: idx, lessonNumber: idx + 1 } })
          );
        });
      }
    }

    await db.$transaction(ops as never);

    return NextResponse.json({ ok: true, updated: ops.length })
  } catch (err) {
    console.error("Course reorder error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
