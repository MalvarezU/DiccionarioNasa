import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createHash } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  main,
  parseArgs,
  printHelp,
  resolveConfig,
  type CliDeps,
  type SeedDb,
  type SeedParam,
} from "./build-content-bundle"
import type { FullBundle } from "../src/lib/seed/bundle-builder"
import fixture from "../src/lib/seed/__fixtures__/bundle-small.json"

const CDN = "https://cdn.test"
const OLD_BASE = process.env.R2_PUBLIC_BASE_URL

const sha = (s: string | Uint8Array): string => createHash("sha256").update(s).digest("hex")

function bundleWithRealBytes(): { bundle: FullBundle; bytes: Map<string, Buffer> } {
  const audio = Buffer.from([0x49, 0x44, 0x33])
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  const bundle = JSON.parse(JSON.stringify(fixture)) as FullBundle
  bundle.media[0]!.sha256 = sha(audio)
  bundle.media[1]!.sha256 = sha(image)
  return {
    bundle,
    bytes: new Map([
      ["audios/w1/clip.mp3", audio],
      ["images/w1.png", image],
    ]),
  }
}

function openDb(path: string): SeedDb {
  const db = new DatabaseSync(path)
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params = []) => {
      db.prepare(sql).run(...params)
    },
    all: <T,>(sql: string, params: ReadonlyArray<SeedParam> = []) =>
      db.prepare(sql).all(...params) as T[],
    close: () => db.close(),
  }
}

function collector() {
  const out: string[] = []
  const err: string[] = []
  const deps: CliDeps = {
    fetchJson: async (url: string) => {
      if (url.endsWith("/api/sync/version")) return { status: 200, body: { contentVersion: "41" } }
      const { bundle } = bundleWithRealBytes()
      void bundle
      throw new Error(`no esperado: ${url}`)
    },
    getBytes: async () => null,
    openDb,
    writeText: (line: string) => {
      out.push(line)
    },
    writeError: (line: string) => {
      err.push(line)
    },
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  }
  return { out, err, deps }
}

beforeEach(() => {
  process.env.R2_PUBLIC_BASE_URL = CDN
})

afterEach(() => {
  if (OLD_BASE === undefined) delete process.env.R2_PUBLIC_BASE_URL
  else process.env.R2_PUBLIC_BASE_URL = OLD_BASE
})

describe("scripts/build-content-bundle [W1-04]", () => {
  describe("parseArgs", () => {
    it("exige --out y aplica defaults", () => {
      const args = parseArgs(["--out", "dist/seed"])
      expect(args).toMatchObject({ outDir: "dist/seed" })
      expect(args.apiBase).toBeUndefined()
      expect(args.expectVersion).toBeUndefined()
    })

    it("acepta --api-base y --expect-version; --help en cualquier posición", () => {
      const args = parseArgs(["--out", "d", "--api-base", "http://stg", "--expect-version", "41"])
      expect(args).toMatchObject({ outDir: "d", apiBase: "http://stg", expectVersion: "41" })
      expect(parseArgs(["--help"]).help).toBe(true)
      expect(parseArgs(["--out", "d", "--help"]).help).toBe(true)
    })

    it("flag desconocido o --out sin valor → error de uso", () => {
      expect(() => parseArgs([])).toThrow(/--out/)
      expect(() => parseArgs(["--out"])).toThrow(/--out/)
      expect(() => parseArgs(["--out", "d", "--nope"])).toThrow(/desconocido/)
    })

    it("--expect-version no numérico → error de uso", () => {
      expect(() => parseArgs(["--out", "d", "--expect-version", "x"])).toThrow(/expect-version/)
    })
  })

  describe("resolveConfig", () => {
    it("precedencia flag > env > default; secreto solo por entorno", () => {
      const base = resolveConfig(
        { outDir: "d", apiBase: "http://flag" },
        { CI_SYNC_SECRET: "s", SEED_API_BASE: "http://env" }
      )
      expect(base.apiBase).toBe("http://flag")
      expect(base.ciSecret).toBe("s")
      expect(resolveConfig({ outDir: "d" }, { CI_SYNC_SECRET: "s", SEED_API_BASE: "http://env" }).apiBase).toBe("http://env")
      expect(resolveConfig({ outDir: "d" }, { CI_SYNC_SECRET: "s" }).apiBase).toBe(
        "https://diccionario-nasa-liart.vercel.app"
      )
      expect(() => resolveConfig({ outDir: "d" }, {})).toThrow(/CI_SYNC_SECRET/)
    })
  })

  describe("main", () => {
    it("--help → 0 con la firma, sin tocar la red", async () => {
      const { out, err, deps } = collector()
      let fetched = 0
      deps.fetchJson = async () => {
        fetched += 1
        throw new Error("no debe llamarse")
      }
      const code = await main(["--help"], { CI_SYNC_SECRET: "s" }, deps)
      expect(code).toBe(0)
      expect(fetched).toBe(0)
      expect(out.join("\n")).toContain("--expect-version")
      expect(printHelp()).toContain("build-content-bundle")
    })

    it("éxito → 0 con líneas METRIC y secreto nunca impreso", async () => {
      const { bundle, bytes } = bundleWithRealBytes()
      const seenHeaders: Array<Record<string, string> | undefined> = []
      const { bundle: _b, ...rest } = { bundle }
      void _b
      const { out, err, deps } = collector()
      const SECRET = "SUPERSECRETO-XYZ-123"
      deps.fetchJson = async (url: string, headers?: Record<string, string>) => {
        seenHeaders.push(headers)
        if (url.endsWith("/api/sync/version")) return { status: 200, body: { contentVersion: "41" } }
        return { status: 200, body: bundle }
      }
      deps.getBytes = async (key: string) => bytes.get(key) ?? null
      const outDir = join(mkdtempSync(join(tmpdir(), "cli-")), "out")
      const code = await main(["--out", outDir], { CI_SYNC_SECRET: SECRET }, deps)
      expect(code).toBe(0)
      expect(seenHeaders.some((h) => h?.["X-CI-Secret"] === SECRET)).toBe(true)
      const text = out.join("\n")
      expect(text).toContain("METRIC words=2")
      expect(text).toContain("METRIC mediaFiles=2")
      expect(text).toContain("METRIC bytes_total=")
      expect(text).not.toContain(SECRET)
      expect(err.join("\n")).not.toContain(SECRET)
      void rest
    })

    it("--expect-version divergente → 2 antes de descargar", async () => {
      const { out, err, deps } = collector()
      let fullCalls = 0
      deps.fetchJson = async (url: string) => {
        if (url.endsWith("/api/sync/version")) return { status: 200, body: { contentVersion: "41" } }
        fullCalls += 1
        return { status: 200, body: {} }
      }
      const outDir = join(mkdtempSync(join(tmpdir(), "cli-")), "out")
      const code = await main(["--out", outDir, "--expect-version", "40"], { CI_SYNC_SECRET: "s" }, deps)
      expect(code).toBe(2)
      expect(fullCalls).toBe(0)
      expect(err.join("\n")).toContain("código 2")
      expect(out.join("\n")).not.toContain("METRIC")
    })

    it("sin --out → 4 de uso; sin secreto → 4 sin exponer nada", async () => {
      const { deps } = collector()
      expect(await main([], { CI_SYNC_SECRET: "s" }, deps)).toBe(4)
      expect(await main(["--out", "d"], {}, deps)).toBe(4)
    })
  })
})
