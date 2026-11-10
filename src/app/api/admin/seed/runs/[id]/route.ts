import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import {
  getSeedEnv,
  seedApiBase,
  seedHeaders,
  toSeedRun,
  RUNS_UPSTREAM_ERROR,
} from "../../github"

/**
 * GET /api/admin/seed/runs/[id]
 *
 * Detalle de un run para el seguimiento del polling (Fase D W1).
 * `id` numérico de path; upstream 404 → propio 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { message: "`id` debe ser un identificador numérico" },
      { status: 400 }
    )
  }

  const env = getSeedEnv()
  if (!env) {
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }

  let upstream: Response
  try {
    upstream = await fetch(`${seedApiBase(env)}/runs/${id}`, {
      headers: seedHeaders(env.token),
    })
  } catch {
    console.error("seed runs/[id]: fallo de red hacia GitHub")
    return NextResponse.json({ message: RUNS_UPSTREAM_ERROR }, { status: 502 })
  }

  if (upstream.status === 404) {
    return NextResponse.json(
      { message: "Ejecución no encontrada" },
      { status: 404 }
    )
  }

  if (!upstream.ok) {
    console.error(`seed runs/[id]: GitHub respondió ${upstream.status}`)
    return NextResponse.json({ message: RUNS_UPSTREAM_ERROR }, { status: 502 })
  }

  const data = (await upstream.json()) as Parameters<typeof toSeedRun>[0]
  return NextResponse.json(toSeedRun(data))
}
