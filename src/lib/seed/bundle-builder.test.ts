import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createHash } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { mkdtempSync, readFileSync, existsSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  SeedBuildError,
  resolveExtension,
  normalizeSeedText,
  mediaKindFor,
  mediaLocalPath,
  createSeedSchema,
  buildDatabase,
  emitManifest,
  runBuild,
  type FullBundle,
  type SeedDb,
  type SeedParam,
} from "./bundle-builder"
import { createStoredZip, readStoredZip } from "./seed-zip"
import fixture from "./__fixtures__/bundle-small.json"

const CDN = "https://cdn.test"
const OLD_BASE = process.env.R2_PUBLIC_BASE_URL

const sha = (s: string | Uint8Array): string => createHash("sha256").update(s).digest("hex")

function wrapMemory(): SeedDb {
  const db = new DatabaseSync(":memory:")
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

function bundleWithRealBytes(): { bundle: FullBundle; bytes: Map<string, Buffer> } {
  const audio = Buffer.from([0x49, 0x44, 0x33])
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  const bundle = JSON.parse(JSON.stringify(fixture)) as FullBundle
  bundle.media[0]!.sha256 = sha(audio)
  bundle.media[0]!.size = audio.length
  bundle.media[1]!.sha256 = sha(image)
  bundle.media[1]!.size = image.length
  return {
    bundle,
    bytes: new Map([
      ["audios/w1/clip.mp3", audio],
      ["images/w1.png", image],
    ]),
  }
}

type FetchCall = { url: string; headers?: Record<string, string> }

function stubNetwork(opts: {
  bundle: FullBundle
  versions?: string[]
  bytes?: Map<string, Buffer>
  failFull?: number
  throwOnFull?: boolean
}) {
  const calls: FetchCall[] = []
  const versions = [...(opts.versions ?? ["41"])]
  const versionCalls: string[] = []
  let fullCalls = 0
  return {
    calls,
    versionCalls,
    get fullCalls() {
      return fullCalls
    },
    fetchJson: async (url: string, headers?: Record<string, string>) => {
      calls.push({ url, headers })
      if (url.endsWith("/api/sync/version")) {
        versionCalls.push(url)
        return { status: 200, body: { contentVersion: versions.shift() ?? "41" } }
      }
      if (url.endsWith("/api/sync/full")) {
        fullCalls += 1
        if (opts.throwOnFull) throw new Error("socket hang up")
        if (opts.failFull) return { status: opts.failFull, body: { message: "x" } }
        return { status: 200, body: opts.bundle }
      }
      throw new Error(`URL inesperada: ${url}`)
    },
    getBytes: async (key: string) => opts.bytes?.get(key) ?? null,
    openDb: (p: string): SeedDb => {
      const db = new DatabaseSync(p)
      return {
        exec: (sql) => db.exec(sql),
        run: (sql, params = []) => {
          db.prepare(sql).run(...params)
        },
        all: <T,>(sql: string, params: ReadonlyArray<SeedParam> = []) =>
          db.prepare(sql).all(...params) as T[],
        close: () => db.close(),
      }
    },
  }
}

beforeEach(() => {
  process.env.R2_PUBLIC_BASE_URL = CDN
})

afterEach(() => {
  if (OLD_BASE === undefined) delete process.env.R2_PUBLIC_BASE_URL
  else process.env.R2_PUBLIC_BASE_URL = OLD_BASE
})

describe("bundle-builder [W1]", () => {
  describe("resolveExtension (tabla cerrada §2.5)", () => {
    it("mapea los 12 mimeTypes exactos", () => {
      expect(resolveExtension("audio/mpeg", "k")).toBe("mp3")
      expect(resolveExtension("audio/mp4", "k")).toBe("m4a")
      expect(resolveExtension("audio/x-m4a", "k")).toBe("m4a")
      expect(resolveExtension("audio/aac", "k")).toBe("aac")
      expect(resolveExtension("audio/ogg", "k")).toBe("ogg")
      expect(resolveExtension("audio/opus", "k")).toBe("opus")
      expect(resolveExtension("audio/wav", "k")).toBe("wav")
      expect(resolveExtension("audio/x-wav", "k")).toBe("wav")
      expect(resolveExtension("audio/webm", "k")).toBe("webm")
      expect(resolveExtension("image/jpeg", "k")).toBe("jpg")
      expect(resolveExtension("image/png", "k")).toBe("png")
      expect(resolveExtension("image/webp", "k")).toBe("webp")
      expect(resolveExtension("image/gif", "k")).toBe("gif")
      expect(resolveExtension("image/avif", "k")).toBe("avif")
    })

    it("es case-insensitive por mimeType exacto", () => {
      expect(resolveExtension("Audio/MPEG", "k")).toBe("mp3")
    })

    it("mimeType desconocido → código 3 con el objectKey en el mensaje", () => {
      try {
        resolveExtension("audio/x-raro", "audios/w9/clip.xyz")
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(SeedBuildError)
        expect((err as SeedBuildError).code).toBe(3)
        expect((err as Error).message).toContain("audios/w9/clip.xyz")
      }
    })

    it("nunca deriva extensión de la URL", () => {
      try {
        resolveExtension("application/octet-stream", "audios/w1/clip.mp3")
        expect.unreachable()
      } catch (err) {
        expect((err as SeedBuildError).code).toBe(3)
      }
    })
  })

  describe("normalizeSeedText", () => {
    it("normaliza como export-db.py (NFD, minúsculas, trim)", () => {
      expect(normalizeSeedText("Niño  ")).toBe("nino")
      expect(normalizeSeedText("NASAYUWE É")).toBe("nasayuwe e")
    })
  })

  describe("mediaKindFor / mediaLocalPath", () => {
    it("audio/* → audio, image/* → illustration (CHECK de la app)", () => {
      expect(mediaKindFor("audio/mpeg", "k")).toBe("audio")
      expect(mediaKindFor("image/png", "k")).toBe("illustration")
    })

    it("local_uri en minúsculas con extensión de la tabla", () => {
      expect(
        mediaLocalPath({
          objectKey: "audios/w1/clip.mp3",
          url: `${CDN}/audios/w1/clip.mp3`,
          sha256: "AB".repeat(32),
          size: 3,
          mimeType: "audio/mpeg",
        })
      ).toBe(`media/${"ab".repeat(32)}.mp3`)
    })
  })

  describe("buildDatabase (núcleo §2.3–§2.4)", () => {
    it("mapea words 1:1 con spanish_norm y examples", () => {
      const db = wrapMemory()
      try {
        const counts = buildDatabase(db, fixture as unknown as FullBundle, "41")
        expect(counts).toMatchObject({ words: 2, courses: 1, modules: 1, lessons: 2, mediaFiles: 2 })
        const rows = db.all<{
          id: string
          spanish: string
          spanish_norm: string
          nasaYuwe_norm: string
          examples: string | null
        }>("SELECT id, spanish, spanish_norm, nasaYuwe_norm, examples FROM words ORDER BY id")
        expect(rows).toHaveLength(2)
        expect(rows[0]).toMatchObject({ id: "w1", spanish: "Niño", spanish_norm: "nino", nasaYuwe_norm: "luucx" })
        expect(rows[0]!.examples).toBe(JSON.stringify({ forma: "nasa", oracion: "Niño corre" }))
        expect(rows[1]).toMatchObject({ id: "w2", spanish_norm: "casa", nasaYuwe_norm: "yat" })
        expect(rows[1]!.examples).toBeNull()
      } finally {
        db.close()
      }
    })

    it("preserva content crudo incluido documento corrupto E5 y coverImage NULL", () => {
      const db = wrapMemory()
      try {
        buildDatabase(db, fixture as unknown as FullBundle, "41")
        const lessons = db.all<{ id: string; lessonNumber: string | null; content: string }>(
          "SELECT id, lessonNumber, content FROM lessons ORDER BY id"
        )
        expect(lessons[0]!.lessonNumber).toBe("1")
        expect(JSON.parse(lessons[0]!.content)).toEqual({
          version: 2,
          blocks: [{ id: "b1", type: "text", html: "<p>Hola</p>" }],
        })
        // Documento corrupto viaja igual, sin romper el build.
        expect(JSON.parse(lessons[1]!.content)).toEqual({ blocks: "roto" })
        const courses = db.all<{ coverImage: string | null }>("SELECT coverImage FROM courses")
        expect(courses[0]!.coverImage).toBeNull()
        const seq = db.all<{ sequential: number }>("SELECT sequential FROM courses")
        expect(seq[0]!.sequential).toBe(1)
      } finally {
        db.close()
      }
    })

    it("media_manifest con word_id sintético y tablas de usuario vacías; kv sin lastSync", () => {
      const db = wrapMemory()
      try {
        buildDatabase(db, fixture as unknown as FullBundle, "41")
        const manifest = db.all<{
          word_id: string
          kind: string
          url: string
          local_uri: string
        }>("SELECT word_id, kind, url, local_uri FROM media_manifest ORDER BY word_id")
        expect(manifest).toHaveLength(2)
        expect(manifest[0]).toMatchObject({
          word_id: "media:audios/w1/clip.mp3",
          kind: "audio",
          local_uri: `media/${"a".repeat(64)}.mp3`,
        })
        expect(manifest[1]).toMatchObject({
          word_id: "media:images/w1.png",
          kind: "illustration",
        })
        for (const t of ["course_progress", "outbox", "history"]) {
          expect(db.all(`SELECT COUNT(*) AS n FROM ${t}`)).toEqual([{ n: 0 }])
        }
        const kv = db.all<{ key: string; value: string }>("SELECT key, value FROM kv ORDER BY key")
        expect(kv).toEqual([
          { key: "piiyaak:contentVersion", value: "41" },
          { key: "schemaVersion", value: "4" },
        ])
      } finally {
        db.close()
      }
    })
  })

  describe("emitManifest (§2.6)", () => {
    it("formato exacto: format, zipBytes, localPath, conteos y bytesTotal", () => {
      const dbBytes = 12345
      const files = [
        { objectKey: "images/w1.png", sha256: "b".repeat(64), size: 4, mimeType: "image/png", localPath: "media/b.png" },
        { objectKey: "audios/w1/clip.mp3", sha256: "a".repeat(64), size: 3, mimeType: "audio/mpeg", localPath: "media/a.mp3" },
      ]
      const manifest = emitManifest({
        contentVersion: "41",
        createdAt: "2026-01-01T00:00:00.000Z",
        dbSha256: "c".repeat(64),
        dbBytes,
        zipBytes: 100,
        files,
        counts: { words: 2, courses: 1, modules: 1, lessons: 2, mediaFiles: 2 },
      })
      expect(manifest.format).toBe("piiyaak-seed/1")
      expect(manifest.files.map((f) => f.objectKey)).toEqual(["audios/w1/clip.mp3", "images/w1.png"])
      expect(manifest.bytesTotal).toBe(dbBytes + 3 + 4)
      expect(manifest).toMatchObject({ bytesAudio: 3, bytesImage: 4, dbBytes: 12345, zipBytes: 100 })
    })
  })

  describe("runBuild (códigos §0 + foto atómica)", () => {
    it("foto atómica: cvPost !== cvPre → código 2 y <out> borrado", async () => {
      const { bundle, bytes } = bundleWithRealBytes()
      const net = stubNetwork({ bundle, bytes, versions: ["41", "42"] })
      const outDir = join(mkdtempSync(join(tmpdir(), "seed-")), "out")
      await expect(
        runBuild({ outDir, apiBase: "http://x", ciSecret: "s", network: net, openDb: net.openDb })
      ).rejects.toMatchObject({ code: 2 })
      expect(existsSync(outDir)).toBe(false)
    })

    it("bundle.contentVersion !== cvPre → código 2 antes de descargar medios", async () => {
      const { bundle, bytes } = bundleWithRealBytes()
      const changed = { ...bundle, contentVersion: "99" }
      let downloaded = 0
      const net = stubNetwork({ bundle: changed, bytes })
      const counting = { ...net, getBytes: async (k: string) => { downloaded += 1; return net.getBytes(k) } }
      const outDir = join(mkdtempSync(join(tmpdir(), "seed-")), "out")
      await expect(
        runBuild({ outDir, apiBase: "http://x", ciSecret: "s", network: counting, openDb: net.openDb })
      ).rejects.toMatchObject({ code: 2 })
      expect(downloaded).toBe(0)
    })

    it("--expect-version divergente → código 2 sin descargar el bundle", async () => {
      const { bundle, bytes } = bundleWithRealBytes()
      const net = stubNetwork({ bundle, bytes })
      const outDir = join(mkdtempSync(join(tmpdir(), "seed-")), "out")
      await expect(
        runBuild({ outDir, apiBase: "http://x", ciSecret: "s", expectVersion: "40", network: net, openDb: net.openDb })
      ).rejects.toMatchObject({ code: 2 })
      expect(net.fullCalls).toBe(0)
    })

    it("getObjectBytes null → código 3; excepción de red → código 4", async () => {
      const { bundle } = bundleWithRealBytes()
      const missing = stubNetwork({ bundle, bytes: new Map(), versions: ["41", "41"] })
      await expect(
        runBuild({ outDir: join(mkdtempSync(join(tmpdir(), "seed-")), "out"), apiBase: "http://x", ciSecret: "s", network: missing, openDb: missing.openDb })
      ).rejects.toMatchObject({ code: 3 })

      const failing = stubNetwork({ bundle, bytes: new Map(), versions: ["41", "41"] })
      const throwing = { ...failing, getBytes: async () => { throw new Error("ECONNRESET") } }
      await expect(
        runBuild({ outDir: join(mkdtempSync(join(tmpdir(), "seed-")), "out"), apiBase: "http://x", ciSecret: "s", network: throwing, openDb: throwing.openDb })
      ).rejects.toMatchObject({ code: 4 })
    })

    it("hash distinto → código 3; version ilegible → código 4; full 500 → código 4", async () => {
      const { bundle, bytes } = bundleWithRealBytes()
      const tampered = JSON.parse(JSON.stringify(bundle)) as FullBundle
      tampered.media[0]!.sha256 = "0".repeat(64)
      const badHash = stubNetwork({ bundle: tampered, bytes, versions: ["41", "41"] })
      await expect(
        runBuild({ outDir: join(mkdtempSync(join(tmpdir(), "seed-")), "out"), apiBase: "http://x", ciSecret: "s", network: badHash, openDb: badHash.openDb })
      ).rejects.toMatchObject({ code: 3 })

      const badVersion = stubNetwork({ bundle, bytes, versions: ["no-numérica"] })
      await expect(
        runBuild({ outDir: join(mkdtempSync(join(tmpdir(), "seed-")), "out"), apiBase: "http://x", ciSecret: "s", network: badVersion, openDb: badVersion.openDb })
      ).rejects.toMatchObject({ code: 4 })

      const down = stubNetwork({ bundle, bytes, failFull: 500 })
      await expect(
        runBuild({ outDir: join(mkdtempSync(join(tmpdir(), "seed-")), "out"), apiBase: "http://x", ciSecret: "s", network: down, openDb: down.openDb })
      ).rejects.toMatchObject({ code: 4 })
    })

    it("referencia sin fila con hash → código 3 (missingMediaKeys)", async () => {
      const { bundle, bytes } = bundleWithRealBytes()
      const partial = JSON.parse(JSON.stringify(bundle)) as FullBundle
      partial.media = partial.media.slice(0, 1)
      const net = stubNetwork({ bundle: partial, bytes, versions: ["41", "41"] })
      await expect(
        runBuild({ outDir: join(mkdtempSync(join(tmpdir(), "seed-")), "out"), apiBase: "http://x", ciSecret: "s", network: net, openDb: net.openDb })
      ).rejects.toMatchObject({ code: 3 })
    })
  })

  describe("runBuild integrado (artefacto completo W1-05)", () => {
    it("emite db + media + manifest.json + zip determinista y auto-verifica", async () => {
      const { bundle, bytes } = bundleWithRealBytes()
      const net = stubNetwork({ bundle, bytes, versions: ["41", "41"] })
      const outDir = join(mkdtempSync(join(tmpdir(), "seed-")), "out")
      const result = await runBuild({
        outDir, apiBase: "http://x", ciSecret: "s", network: net, openDb: net.openDb,
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      })

      expect(existsSync(join(outDir, "piiyaak.db"))).toBe(true)
      expect(existsSync(join(outDir, "manifest.json"))).toBe(true)
      expect(existsSync(join(outDir, "piiyaak-seed.zip"))).toBe(true)

      const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"))
      expect(manifest.format).toBe("piiyaak-seed/1")
      expect(manifest.contentVersion).toBe("41")
      expect(manifest.createdAt).toBe("2026-01-01T00:00:00.000Z")
      expect(manifest.counts).toEqual({ words: 2, courses: 1, modules: 1, lessons: 2, mediaFiles: 2 })
      expect(manifest.files).toHaveLength(2)
      expect(manifest.files[0].localPath).toBe(`media/${manifest.files[0].sha256}.mp3`)

      const dbBytes = statSync(join(outDir, "piiyaak.db")).size
      expect(manifest.dbBytes).toBe(dbBytes)
      expect(manifest.dbSha256).toBe(createHash("sha256").update(readFileSync(join(outDir, "piiyaak.db"))).digest("hex"))
      expect(manifest.bytesTotal).toBe(dbBytes + manifest.files[0].size + manifest.files[1].size)
      expect(manifest.zipBytes).toBe(statSync(join(outDir, "piiyaak-seed.zip")).size)
      expect(result.metrics.bytes_total).toBe(manifest.bytesTotal)

      // Zip: layout exacto, entradas ordenadas, manifiesto idéntico al suelto.
      const zip = readStoredZip(readFileSync(join(outDir, "piiyaak-seed.zip")))
      const names = zip.map((e) => e.name)
      expect(names).toEqual([...names].sort())
      expect(names).toEqual(["manifest.json", `media/${manifest.files[1].sha256}.png`, `media/${manifest.files[0].sha256}.mp3`, "piiyaak.db"].sort())
      expect(JSON.parse(zip.find((e) => e.name === "manifest.json")!.data.toString("utf8"))).toEqual(manifest)

      // Medios del zip idénticos a los descargados.
      for (const f of manifest.files as Array<{ sha256: string; localPath: string }>) {
        const entry = zip.find((e) => e.name === f.localPath)!
        expect(sha(entry.data)).toBe(f.sha256)
        expect(existsSync(join(outDir, f.localPath))).toBe(true)
      }

      // Round-trip determinista del writer/reader.
      const rebuilt = readStoredZip(createStoredZip(zip.map((e) => ({ name: e.name, data: e.data }))))
      expect(rebuilt.map((e) => e.name)).toEqual(names)
    })
  })
})
