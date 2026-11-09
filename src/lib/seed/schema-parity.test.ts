import { describe, it, expect } from "vitest"
import { DatabaseSync } from "node:sqlite"
import {
  APP_SCHEMA_TABLES,
  SCHEMA_VERSION_SEED,
  assertSchemaParity,
  buildDatabase,
  createSeedSchema,
  type SeedDb,
} from "./bundle-builder"
import fixture from "./__fixtures__/bundle-small.json"
import type { FullBundle } from "./bundle-builder"

function wrapMemory(): SeedDb {
  const db = new DatabaseSync(":memory:")
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

describe("schema-parity [W1]", () => {
  it("las 9 tablas existen con las columnas del SCHEMA de la app", () => {
    const db = wrapMemory()
    try {
      buildDatabase(db, fixture as unknown as FullBundle, "41")
      expect(() => assertSchemaParity(db)).not.toThrow()
      expect(Object.keys(APP_SCHEMA_TABLES).sort()).toEqual(
        ["course_progress", "courses", "history", "kv", "lessons", "media_manifest", "modules", "outbox", "words"].sort()
      )
    } finally {
      db.close()
    }
  })

  it("schemaVersion permanece 4 sin bump", () => {
    expect(SCHEMA_VERSION_SEED).toBe("4")
    const db = wrapMemory()
    try {
      buildDatabase(db, fixture as unknown as FullBundle, "41")
      expect(db.all<{ value: string }>("SELECT value FROM kv WHERE key = 'schemaVersion'")).toEqual([
        { value: "4" },
      ])
    } finally {
      db.close()
    }
  })

  it("divergencia simulada (columna agregada) → falla", () => {
    const db = wrapMemory()
    try {
      createSeedSchema(db)
      db.exec("ALTER TABLE words ADD COLUMN extra TEXT")
      expect(() => assertSchemaParity(db)).toThrow(/words/)
    } finally {
      db.close()
    }
  })

  it("tabla faltante → falla", () => {
    const db = wrapMemory()
    try {
      db.exec("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
      expect(() => assertSchemaParity(db)).toThrow(/words/)
    } finally {
      db.close()
    }
  })
})
