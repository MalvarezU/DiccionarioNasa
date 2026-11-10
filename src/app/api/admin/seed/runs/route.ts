import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import {
  getSeedEnv,
  seedApiBase,
  seedHeaders,
  toSeedRun,
  RUNS_UPSTREAM_ERROR,
} from "../github"

/**
 * GET /api/admin/seed/runs
 *
 * Lista runs de `seed-content.yml` (status/historial, Fase D W1).
 * `per_page` entero 1–30 (defecto 10); `page` entero ≥ 1 (defecto 1).
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const perPage = Number(searchParams.get("per_page") ?? "10")
  const page = Number(searchParams.get("page") ?? "1")

  if (
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    perPage > 30 ||
    !Number.isInteger(page) ||
    page < 1
  ) {
    return NextResponse.json(
      { message: "`per_page` debe ser un entero entre 1 y 30 y `page` un entero mayor o igual a 1" },
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
    upstream = await fetch(
      `${seedApiBase(env)}/runs?per_page=${perPage}&page=${page}`,
      { headers: seedHeaders(env.token) }
    )
  } catch {
    console.error("seed runs: fallo de red hacia GitHub")
    return NextResponse.json({ message: RUNS_UPSTREAM_ERROR }, { status: 502 })
  }

  if (!upstream.ok) {
    console.error(`seed runs: GitHub respondió ${upstream.status}`)
    return NextResponse.json({ message: RUNS_UPSTREAM_ERROR }, { status: 502 })
  }

  const data = (await upstream.json()) as {
    total_count: number
    workflow_runs: Array<Parameters<typeof toSeedRun>[0]>
  }

  return NextResponse.json({
    runs: (data.workflow_runs ?? []).map(toSeedRun),
    totalCount: data.total_count ?? 0,
    page,
    per_page: perPage,
  })
}
