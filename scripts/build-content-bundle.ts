#!/usr/bin/env bun
/**
 * Generador del bundle seed offline (Fase C, W1).
 *
 * Uso:
 *   bun run scripts/build-content-bundle.ts --out <dir> [--api-base <url>] [--expect-version <N>]
 *
 * Env requerido: `CI_SYNC_SECRET` (solo encabezado `X-CI-Secret`, nunca en
 * logs ni artefactos), `SEED_API_BASE` (default producción), credenciales R2
 * (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
 * `R2_PUBLIC_BASE_URL`) consumidas por `@/lib/r2` de forma perezosa.
 *
 * Códigos: 0 ok · 2 divergencia de versión (foto no atómica o
 * `--expect-version` distinto) · 3 incoherencia de medios · 4
 * infraestructura/uso. Todo-o-nada: cualquier fallo deja `<out>` borrado.
 *
 * Toda la lógica vive en `@/lib/seed/bundle-builder` (testeable en vitest);
 * este archivo es un envoltorio CLI delgado con la única dependencia de
 * runtime `bun:sqlite` (cargada de forma diferida para no romper vitest).
 */

import { getObjectBytes } from "@/lib/r2"
import {
  SeedBuildError,
  runBuild,
  type BuildNetwork,
  type SeedDb,
} from "@/lib/seed/bundle-builder"

export type { SeedDb, SeedParam } from "@/lib/seed/bundle-builder"

export type CliEnv = Record<string, string | undefined>

export interface CliArgs {
  outDir: string
  apiBase?: string
  expectVersion?: string
  help?: boolean
}

export interface CliDeps {
  fetchJson: BuildNetwork["fetchJson"]
  getBytes: BuildNetwork["getBytes"]
  openDb: (path: string) => SeedDb
  writeText: (line: string) => void
  writeError: (line: string) => void
  now: () => Date
}

const DEFAULT_API_BASE = "https://diccionario-nasa-liart.vercel.app"
const VERSION_RE = /^\d+$/

export function printHelp(): string {
  return [
    "build-content-bundle — generador del bundle seed offline (Fase C, W1)",
    "",
    "Uso:",
    "  bun run scripts/build-content-bundle.ts --out <dir> [--api-base <url>] [--expect-version <N>]",
    "",
    "Entorno:",
    "  CI_SYNC_SECRET    requerido (solo por entorno; viaja en X-CI-Secret)",
    "  SEED_API_BASE     default https://diccionario-nasa-liart.vercel.app",
    "  R2_*              credenciales del bucket (vía @/lib/r2)",
    "",
    "Códigos: 0 ok · 2 divergencia de versión · 3 incoherencia de medios · 4 infraestructura/uso.",
    "Métricas: imprime líneas METRIC words|courses|modules|lessons|mediaFiles|bytes_total|bytes_audio|bytes_image.",
  ].join("\n")
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { outDir: "" }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === "--help" || flag === "-h") {
      args.help = true
      continue
    }
    if (flag === "--out" || flag === "--api-base" || flag === "--expect-version") {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`[seed] ${flag} exige un valor`)
      }
      i += 1
      if (flag === "--out") args.outDir = value
      else if (flag === "--api-base") args.apiBase = value
      else args.expectVersion = value
      continue
    }
    throw new Error(`[seed] flag desconocido: ${flag}`)
  }
  if (args.help) return args
  if (!args.outDir) throw new Error("[seed] falta --out <dir>")
  if (args.expectVersion !== undefined && !VERSION_RE.test(args.expectVersion)) {
    throw new Error(`[seed] --expect-version inválido: ${args.expectVersion}`)
  }
  return args
}

export function resolveConfig(
  args: CliArgs,
  env: CliEnv
): { outDir: string; apiBase: string; ciSecret: string } {
  const ciSecret = env.CI_SYNC_SECRET
  if (!ciSecret) throw new Error("[seed] falta CI_SYNC_SECRET (solo por entorno)")
  const apiBase = args.apiBase ?? env.SEED_API_BASE ?? DEFAULT_API_BASE
  return { outDir: args.outDir, apiBase, ciSecret }
}

async function defaultOpenDbFactory(): Promise<(path: string) => SeedDb> {
  // Diferida a propósito: `bun:sqlite` no existe bajo vitest/node. El
  // `Function` oculta el especificador del análisis estático de vite.
  const lazyImport = Function("spec", "return import(spec)") as (
    spec: string
  ) => Promise<{
    Database: new (path: string) => {
      exec: (sql: string) => void
      prepare: (sql: string) => { run: (...p: unknown[]) => void; all: (...p: unknown[]) => unknown[] }
      close: () => void
    }
  }>
  const { Database } = await lazyImport("bun:sqlite")
  return (path: string): SeedDb => {
    const db = new Database(path)
    return {
      exec: (sql) => db.exec(sql),
      run: (sql, params = []) => {
        db.prepare(sql).run(...params)
      },
      all: <T,>(sql: string, params: ReadonlyArray<unknown> = []) =>
        db.prepare(sql).all(...params) as T[],
      close: () => db.close(),
    }
  }
}

async function defaultFetchJson(
  url: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, headers ? { headers } : undefined)
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

export async function main(
  argv: string[],
  env: CliEnv,
  overrides?: Partial<CliDeps>
): Promise<number> {
  const writeText = overrides?.writeText ?? ((line: string) => console.log(line))
  const writeError = overrides?.writeError ?? ((line: string) => console.error(line))

  let args: CliArgs
  try {
    args = parseArgs(argv)
  } catch (err) {
    writeError((err as Error).message)
    writeError(printHelp())
    return 4
  }
  if (args.help) {
    writeText(printHelp())
    return 0
  }

  let config: { outDir: string; apiBase: string; ciSecret: string }
  try {
    config = resolveConfig(args, env)
  } catch (err) {
    writeError((err as Error).message)
    return 4
  }

  const openDb = overrides?.openDb ?? (await defaultOpenDbFactory())
  const deps: CliDeps = {
    fetchJson: overrides?.fetchJson ?? defaultFetchJson,
    getBytes: overrides?.getBytes ?? getObjectBytes,
    openDb,
    writeText,
    writeError,
    now: overrides?.now ?? (() => new Date()),
  }

  try {
    const result = await runBuild({
      outDir: config.outDir,
      apiBase: config.apiBase,
      ciSecret: config.ciSecret,
      expectVersion: args.expectVersion,
      network: deps,
      openDb: deps.openDb,
      now: deps.now,
    })
    const m = result.metrics
    for (const [key, value] of [
      ["words", m.words],
      ["courses", m.courses],
      ["modules", m.modules],
      ["lessons", m.lessons],
      ["mediaFiles", m.mediaFiles],
      ["bytes_total", m.bytes_total],
      ["bytes_audio", m.bytes_audio],
      ["bytes_image", m.bytes_image],
    ] as const) {
      writeText(`METRIC ${key}=${value}`)
    }
    writeText(
      `seed: ${config.outDir} contentVersion=${result.manifest.contentVersion} ` +
        `db=${result.manifest.dbBytes} zip=${result.manifest.zipBytes}`
    )
    return 0
  } catch (err) {
    if (err instanceof SeedBuildError) {
      writeError(`código ${err.code}: ${err.message}`)
      return err.code
    }
    writeError(`código 4: ${(err as Error).message}`)
    return 4
  }
}

const invokedAsScript =
  (process.argv[1] ?? "").replace(/\\/g, "/").endsWith("scripts/build-content-bundle.ts") &&
  process.env.VITEST == null

if (invokedAsScript) {
  main(process.argv.slice(2), process.env).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`código 4: ${(err as Error).message}`)
      process.exit(4)
    }
  )
}
