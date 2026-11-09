/**
 * Ayudas server-only para las rutas `/api/admin/seed/*` (Fase D W1).
 *
 * El PAT vive solo en env server-only y jamás aparece en respuestas, logs
 * ni errores. Sin Octokit: `fetch` nativo contra api.github.com.
 */

export const SEED_WORKFLOW = "seed-content.yml"
export const SEED_REF = "main"
export const RUNS_UPSTREAM_ERROR =
  "No se pudo obtener el estado de las ejecuciones"

export interface SeedRun {
  id: number
  status: string
  conclusion: string | null
  createdAt: string
  updatedAt: string
  inputs: Record<string, unknown>
  htmlUrl: string
}

interface SeedEnv {
  token: string
  owner: string
  repo: string
}

/** Env server-only; `null` si falta alguna pieza (la ruta responde 500). */
export function getSeedEnv(): SeedEnv | null {
  const token = process.env.SEED_DISPATCH_TOKEN
  const owner = process.env.SEED_GITHUB_OWNER
  const repo = process.env.SEED_GITHUB_REPO
  if (!token || !owner || !repo) return null
  return { token, owner, repo }
}

export function seedApiBase(env: SeedEnv): string {
  return `https://api.github.com/repos/${env.owner}/${env.repo}/actions/workflows/${SEED_WORKFLOW}`
}

export function seedHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
  }
}

/** Forma mínima propia: solo las claves listadas en el spec, sin internos. */
export function toSeedRun(raw: {
  id: number
  status: string
  conclusion?: string | null
  created_at: string
  updated_at: string
  inputs?: unknown
  html_url: string
}): SeedRun {
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
