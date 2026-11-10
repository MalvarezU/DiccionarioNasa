import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import {
  getApkEnv,
  apkApiBase,
  apkHeaders,
  toApkRun,
  APK_RUNS_UPSTREAM_ERROR,
} from "../github"

/**
 * GET /api/admin/apk/runs?per_page=&page= — historial de runs del
 * workflow de APK en el repo móvil. Requiere admin. El PAT jamás
 * aparece en respuestas ni logs.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const params = new URL(request.url).searchParams
  const rawPerPage = Number(params.get("per_page") ?? 10)
  const perPage = Number.isFinite(rawPerPage)
    ? Math.min(30, Math.max(1, Math.floor(rawPerPage)))
    : 10
  const rawPage = Number(params.get("page") ?? 1)
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1

  if (
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    !Number.isInteger(page) ||
    page < 1
  ) {
    return NextResponse.json(
      { message: "`per_page` debe ser un entero entre 1 y 30 y `page` un entero mayor o igual a 1" },
      { status: 400 }
    )
  }

  const env = getApkEnv()
  if (!env) {
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }

  let upstream: Response
  try {
    upstream = await fetch(
      `${apkApiBase(env)}/runs?per_page=${perPage}&page=${page}`,
      { headers: apkHeaders(env.token) }
    )
  } catch {
    console.error("apk runs: fallo de red hacia GitHub")
    return NextResponse.json({ message: APK_RUNS_UPSTREAM_ERROR }, { status: 502 })
  }

  if (!upstream.ok) {
    console.error(`apk runs: GitHub respondió ${upstream.status}`)
    return NextResponse.json({ message: APK_RUNS_UPSTREAM_ERROR }, { status: 502 })
  }

  const data = (await upstream.json()) as {
    total_count: number
    workflow_runs: Array<Parameters<typeof toApkRun>[0]>
  }

  return NextResponse.json({
    runs: (data.workflow_runs ?? []).map(toApkRun),
    totalCount: data.total_count ?? 0,
    page,
    per_page: perPage,
  })
}
