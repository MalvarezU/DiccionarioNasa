import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

const REF = "main"
const WORKFLOW = "seed-content.yml"
const UPSTREAM_ERROR = "No se pudo disparar la generación de contenido"

const DispatchBodySchema = z.strictObject({
  content_version: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .string()
      .regex(/^\d+$/)
      .max(20)
      .optional()
  ),
  dry_run: z.boolean().default(true),
})

interface DispatchInputs {
  dry_run: boolean
  content_version?: string
}

/**
 * POST /api/admin/seed/dispatch
 *
 * Dispara `seed-content.yml` vía `workflow_dispatch` (Fase D W1).
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

  const token = process.env.SEED_DISPATCH_TOKEN
  const owner = process.env.SEED_GITHUB_OWNER
  const repo = process.env.SEED_GITHUB_REPO
  if (!token || !owner || !repo) {
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }

  const inputs: DispatchInputs = { dry_run: parsed.data.dry_run }
  if (parsed.data.content_version !== undefined) {
    inputs.content_version = parsed.data.content_version
  }

  let upstream: Response
  try {
    upstream = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: REF, inputs }),
      }
    )
  } catch {
    // El cuerpo upstream jamás se filtra: mensaje genérico propio.
    console.error("seed dispatch: fallo de red hacia GitHub")
    return NextResponse.json({ message: UPSTREAM_ERROR }, { status: 502 })
  }

  if (upstream.status !== 204) {
    // El cuerpo upstream jamás se filtra: solo el status en el log servidor.
    console.error(`seed dispatch: GitHub respondió ${upstream.status}`)
    return NextResponse.json({ message: UPSTREAM_ERROR }, { status: 502 })
  }

  const correlationId = crypto.randomUUID()
  const user = session!.user as { id: string; name?: string; email?: string }
  await db.auditLog.create({
    data: {
      action: "SEED_DISPATCH",
      entity: "SeedContent",
      entityId: parsed.data.content_version ?? "latest",
      changes: JSON.stringify({
        ref: REF,
        inputs,
        correlationId,
        responsable: user.name || user.email,
      }),
      userId: user.id,
    },
  })

  return NextResponse.json(
    { run: null, status: "dispatched", correlationId, ref: REF, inputs },
    { status: 202 }
  )
}
