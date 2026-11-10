/**
 * Ayudas server-only para las rutas `/api/admin/apk/*`.
 *
 * Apunta al workflow `apk-release.yml` del repo móvil (Piiyaak-Mobile-),
 * distinto del workflow de semilla (que vive en este repo). El PAT vive
 * solo en env server-only y jamás aparece en respuestas, logs ni errores.
 */

export const APK_WORKFLOW = "apk-release.yml"
export const APK_REF = "main"
export const APK_UPSTREAM_ERROR = "No se pudo disparar la generación de la APK"
export const APK_RUNS_UPSTREAM_ERROR =
  "No se pudo obtener el estado de las ejecuciones de la APK"

export interface ApkRun {
  id: number
  status: string
  conclusion: string | null
  createdAt: string
  updatedAt: string
  inputs: Record<string, unknown>
  htmlUrl: string
}

interface ApkEnv {
  token: string
  owner: string
  repo: string
}

/** Env server-only; `null` si falta alguna pieza (la ruta responde 500). */
export function getApkEnv(): ApkEnv | null {
  const token = process.env.APK_DISPATCH_TOKEN
  const owner = process.env.APK_GITHUB_OWNER
  const repo = process.env.APK_GITHUB_REPO
  if (!token || !owner || !repo) return null
  return { token, owner, repo }
}

export function apkApiBase(env: ApkEnv): string {
  return `https://api.github.com/repos/${env.owner}/${env.repo}/actions/workflows/${APK_WORKFLOW}`
}

export function apkHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
  }
}

/** Forma mínima propia: solo las claves listadas, sin internos. */
export function toApkRun(raw: {
  id: number
  status: string
  conclusion?: string | null
  created_at: string
  updated_at: string
  inputs?: unknown
  html_url: string
}): ApkRun {
  return {
    id: raw.id,
    status: raw.status,
    conclusion: raw.conclusion ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    inputs:
      typeof raw.inputs === "object" && raw.inputs !== null
        ? (raw.inputs as Record<string, unknown>)
        : {},
    htmlUrl: raw.html_url,
  }
}
