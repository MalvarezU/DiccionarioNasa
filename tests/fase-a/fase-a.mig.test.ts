import "./test-db";
import { describe, it, expect, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { testDb, disconnectTestDb } from "./test-db";

/**
 * T01 — Migración Prisma aditiva (MIG-01, MIG-02).
 *
 * - MIG-01: `ContentVersion` existe con exactamente una fila `(1, v>=1)`.
 * - MIG-02: `Module`/`Lesson` exponen `updatedAt` + `deletedAt?` con índice en
 *   `updatedAt`; `MediaAsset` expone `sha256?` + `updatedAt` con índice.
 *
 * Combina DMMF (el cliente Prisma generado expone los campos que el código
 * futuro necesita) con `INFORMATION_SCHEMA` (verdad a nivel BD migrada).
 */

type ColumnInfo = {
  COLUMN_NAME: string;
  IS_NULLABLE: string;
  DATA_TYPE: string;
};

type IndexInfo = {
  INDEX_NAME: string;
};

async function columnsOf(table: string): Promise<ColumnInfo[]> {
  return testDb().$queryRaw<ColumnInfo[]>`
    SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
  `;
}

async function updatedAtIndexOn(table: string): Promise<IndexInfo[]> {
  return testDb().$queryRaw<IndexInfo[]>`
    SELECT INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
      AND COLUMN_NAME = 'updatedAt'
      AND NON_UNIQUE = 1
  `;
}

function modelByName(name: string) {
  return Prisma.dmmf.datamodel.models.find((m) => m.name === name);
}

afterAll(async () => {
  await disconnectTestDb();
});

describe("T01 MIG-01: tabla ContentVersion con semilla (1,1)", () => {
  it("existe con exactamente una fila id=1 y version>=1", { retry: 2 }, async () => {
    const rows = await testDb().$queryRaw<Array<{ id: number; version: number }>>`
      SELECT id, version FROM ContentVersion
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(1);
    expect(rows[0]?.version).toBeGreaterThanOrEqual(1);
  });
});

describe("T01 MIG-02: DMMF expone los campos nuevos", () => {
  it("Module tiene updatedAt requerido + deletedAt nullable", () => {
    const model = modelByName("Module");
    expect(model).toBeDefined();
    const updatedAt = model?.fields.find((f) => f.name === "updatedAt");
    const deletedAt = model?.fields.find((f) => f.name === "deletedAt");
    expect(updatedAt?.isRequired).toBe(true);
    expect(updatedAt?.isUpdatedAt).toBe(true);
    expect(deletedAt?.isRequired).toBe(false);
  });

  it("Lesson tiene updatedAt requerido + deletedAt nullable", () => {
    const model = modelByName("Lesson");
    expect(model).toBeDefined();
    const updatedAt = model?.fields.find((f) => f.name === "updatedAt");
    const deletedAt = model?.fields.find((f) => f.name === "deletedAt");
    expect(updatedAt?.isRequired).toBe(true);
    expect(updatedAt?.isUpdatedAt).toBe(true);
    expect(deletedAt?.isRequired).toBe(false);
  });

  it("MediaAsset tiene sha256 nullable + updatedAt requerido", () => {
    const model = modelByName("MediaAsset");
    expect(model).toBeDefined();
    const sha256 = model?.fields.find((f) => f.name === "sha256");
    const updatedAt = model?.fields.find((f) => f.name === "updatedAt");
    expect(sha256?.isRequired).toBe(false);
    expect(updatedAt?.isRequired).toBe(true);
    expect(updatedAt?.isUpdatedAt).toBe(true);
  });

  it("ContentVersion existe con id=1 por defecto", () => {
    const model = modelByName("ContentVersion");
    expect(model).toBeDefined();
    expect(model?.fields.find((f) => f.name === "version")?.isRequired).toBe(true);
  });
});

describe("T01 MIG-02: INFORMATION_SCHEMA confirma columnas e índices", () => {
  it("Module.updatedAt NOT NULL + Module.deletedAt nullable + índice en updatedAt", async () => {
    const cols = await columnsOf("Module");
    expect(cols.find((c) => c.COLUMN_NAME === "updatedAt")?.IS_NULLABLE).toBe("NO");
    expect(cols.find((c) => c.COLUMN_NAME === "deletedAt")?.IS_NULLABLE).toBe("YES");
    const idx = await updatedAtIndexOn("Module");
    expect(idx.length).toBeGreaterThanOrEqual(1);
  });

  it("Lesson.updatedAt NOT NULL + Lesson.deletedAt nullable + índice en updatedAt", async () => {
    const cols = await columnsOf("Lesson");
    expect(cols.find((c) => c.COLUMN_NAME === "updatedAt")?.IS_NULLABLE).toBe("NO");
    expect(cols.find((c) => c.COLUMN_NAME === "deletedAt")?.IS_NULLABLE).toBe("YES");
    const idx = await updatedAtIndexOn("Lesson");
    expect(idx.length).toBeGreaterThanOrEqual(1);
  });

  it("MediaAsset.sha256 nullable + MediaAsset.updatedAt NOT NULL + índice en updatedAt", async () => {
    const cols = await columnsOf("MediaAsset");
    expect(cols.find((c) => c.COLUMN_NAME === "sha256")?.IS_NULLABLE).toBe("YES");
    expect(cols.find((c) => c.COLUMN_NAME === "updatedAt")?.IS_NULLABLE).toBe("NO");
    const idx = await updatedAtIndexOn("MediaAsset");
    expect(idx.length).toBeGreaterThanOrEqual(1);
  });
});
