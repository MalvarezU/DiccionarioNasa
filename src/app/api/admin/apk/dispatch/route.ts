import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { getApkEnv, apkApiBase, apkHeaders, APK_REF, APK_UPSTREAM_ERROR } from "../github"

const DispatchBodySchema = z.strictObject({
  dry_run: z.boolean().default(true),
})

/**
 * POST /api/admin/apk/dispatch
 *
 * Dispara `apk-release.yml` en el repo móvil vía `workflow_dispatch`.
 * `requireAdmin()` primero; el PAT vive solo en env server-only y jamás
 * aparece en respuestas, logs ni errores.
 */
export async function POST(request: Request) {
  const { session, error } = await requireAdmin()
  if (error) return error

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Cuerpo de la solicitud inválido" },
      { status: 400 }
    )
  }

  const parsed = DispatchBodySchema.safeParse(raw)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ")
    return NextResponse.json({ message: detail }, { status: 400 })
  }

  const env = getApkEnv()
  if (!env) {
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }

  const inputs: Record<string, unknown> = { dry_run: parsed.data.dry_run }

  let upstream: Response
  try {
    upstream = await fetch(`${apkApiBase(env)}/dispatches`, {
      method: "POST",
      headers: {
        ...apkHeaders(env.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: APK_REF, inputs }),
    })
  } catch {
    console.error("apk dispatch: fallo de red hacia GitHub")
    return NextResponse.json({ message: APK_UPSTREAM_ERROR }, { status: 502 })
  }

  if (upstream.status !== 204) {
    console.error(`apk dispatch: GitHub respondió ${upstream.status}`)
    return NextResponse.json({ message: APK_UPSTREAM_ERROR }, { status: 502 })
  }

  const correlationId = crypto.randomUUID()
  const user = session!.user as { id: string; name?: string; email?: string }
  await db.auditLog.create({
    data: {
      action: "APK_DISPATCH",
      entity: "ApkRelease",
      entityId: "latest",
      changes: JSON.stringify({
        ref: APK_REF,
        inputs,
        correlationId,
        responsable: user.name || user.email,
      }),
      userId: user.id,
    },
  })

  return NextResponse.json(
    { run: null, status: "dispatched", correlationId, ref: APK_REF, inputs },
    { status: 202 }
  )
}
