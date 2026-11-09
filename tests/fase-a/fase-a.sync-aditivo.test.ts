import "./test-db";
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
}));

const mockPutObject = vi.fn();
const mockDeleteObject = vi.fn();

vi.mock("@/lib/r2", () => ({
  putObject: (...args: unknown[]) => mockPutObject(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

import { requireAuth, requireRole, requireAdmin } from "@/lib/auth";
import { GET as GET_SYNC } from "@/app/api/sync/route";
import { GET as GET_SEED } from "@/app/api/sync/seed/route";
import { POST as POST_WORD } from "@/app/api/admin/words/route";
import { PUT as PUT_WORD, DELETE as DELETE_WORD } from "@/app/api/admin/words/[id]/route";
import { POST as POST_UPLOAD_IMAGE } from "@/app/api/admin/upload-image/route";
import { POST as POST_COURSE } from "@/app/api/courses/route";
import { getContentVersion } from "@/lib/content-version";
import { testDb, ensureSeedRow, disconnectTestDb } from "./test-db";
import { acquireBumpLock, releaseBumpLock } from "./lock";

/**
 * T10 — Sync aditivo: `contentVersion` en sync y seed (spec §5.1,
 * criterios SYNC-01 + BUMP-04).
 *
 * - Ambas respuestas incluyen `contentVersion` coincidente con
 *   `getContentVersion()`, sin renombrar ni eliminar claves preexistentes
 *   (patrón aditivo de `api-design-patterns`).
 * - Regresión R-ARCHIVED bajo F1 (Fase B W2): `status` histórico en
 *   minúsculas fuera de `words` y —por filtro PUBLISHED en consulta— también
 *   fuera de `removedIds` (vacío por construcción; la derivación queda como
 *   defensa cubierta a nivel unitario).
 * - Secuencia mixta N=5 (words + media + courses) desde v0 deja v0+5 exacto.
 */

process.env.R2_PUBLIC_BASE_URL = "https://cdn.test";

const session = {
  session: { user: { id: "u-t10", name: "T10", email: "t10@test", role: "editor" } },
  error: null,
} as never;

let seq = 0;
const tag = (s: string) => `t10-${Date.now()}-${seq++}-${s}`;

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function fileReq(url: string, file: File): Request {
  const fd = new FormData();
  fd.append("file", file);
  const req = new Request(url, { method: "POST" });
  vi.spyOn(req, "formData").mockResolvedValue(fd);
  return req;
}

function jsonReq(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

beforeAll(async () => {
  await acquireBumpLock("sync-aditivo");
  await ensureSeedRow();
});

afterAll(async () => {
  await releaseBumpLock();
  await disconnectTestDb();
});

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue(session);
  vi.mocked(requireRole).mockResolvedValue(session);
  vi.mocked(requireAdmin).mockResolvedValue(session);
  mockPutObject.mockResolvedValue(undefined);
  mockDeleteObject.mockResolvedValue(undefined);
});

afterEach(async () => {
  await testDb().mediaAsset.deleteMany({ where: { filename: { startsWith: "t10-" } } });
  await testDb().dictionaryWord.deleteMany({ where: { spanish: { startsWith: "t10-" } } });
  await testDb().course.deleteMany({ where: { title: { startsWith: "t10-" } } });
});

describe("T10 SYNC-01 — GET /api/sync expone contentVersion sin romper el contrato", () => {
  it("devuelve contentVersion coincidente con getContentVersion() y claves preexistentes intactas", async () => {
    const res = await GET_SYNC(new Request("http://x/api/sync") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contentVersion).toBe(String(await getContentVersion()));
    expect(typeof body.contentVersion).toBe("string");
    // Snapshot aditivo: ninguna clave preexistente se renombra ni se elimina.
    for (const key of ["words", "removedIds", "serverTime", "nextCursor"]) {
      expect(body, `clave preexistente ausente: ${key}`).toHaveProperty(key);
    }
  });

  it("R-ARCHIVED bajo F1: status historico en minusculas fuera de words y de removedIds", async () => {
    const name = tag("arch");
    await testDb().dictionaryWord.create({
      data: { spanish: name, nasaYuwe: "ny", status: "archived" },
    });
    const res = await GET_SYNC(new Request("http://x/api/sync?since=1970-01-01T00:00:00.000Z&limit=1000") as never);
    const body = await res.json();
    const ids: string[] = body.words.map((w: { id: string }) => w.id);
    const row = await testDb().dictionaryWord.findFirst({ where: { spanish: name } });
    // F1: el filtro PUBLISHED-only vive en la consulta; la fila nunca llega a
    // `page` y por construcción no aparece ni en words ni en removedIds.
    expect(body.removedIds).not.toContain(row!.id);
    expect(ids).not.toContain(row!.id);
  });
});

describe("T10 SYNC-01 — GET /api/sync/seed expone contentVersion sin romper el contrato", () => {
  it("devuelve contentVersion coincidente con getContentVersion() y claves preexistentes intactas", async () => {
    const res = await GET_SEED(new Request("http://x/api/sync/seed") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contentVersion).toBe(String(await getContentVersion()));
    expect(typeof body.contentVersion).toBe("string");
    for (const key of ["words", "total", "page", "pageSize", "totalPages", "serverTime"]) {
      expect(body, `clave preexistente ausente: ${key}`).toHaveProperty(key);
    }
  });
});

describe("T10 BUMP-04 — secuencia mixta N=5 deja v0+5 exacto", () => {
  it("words + media + courses mezclados incrementan exactamente +1 cada uno", async () => {
    const v0 = await getContentVersion();

    // 1. words: crear.
    const w1 = await POST_WORD(
      jsonReq("http://x/api/admin/words", { spanish: tag("w1"), nasaYuwe: "ny" })
    );
    expect(w1.status).toBe(201);
    const { word } = await w1.json();

    // 2. words: editar (cambio efectivo).
    const w2 = await PUT_WORD(jsonReq(`http://x/api/admin/words/${word.id}`, { category: tag("cat") }), ctx(word.id));
    expect(w2.status).toBe(200);

    // 3. media: upload-image.
    const img = await POST_UPLOAD_IMAGE(
      fileReq(
        "http://x/api/admin/upload-image",
        new File([PNG_BYTES as unknown as BlobPart], `t10-${Date.now()}.png`, { type: "image/png" })
      )
    );
    expect(img.status).toBe(200);

    // 4. courses: crear.
    const c1 = await POST_COURSE(jsonReq("http://x/api/courses", { title: tag("curso") }) as never);
    expect(c1.status).toBe(201);

    // 5. words: archivar (DELETE → ARCHIVED).
    const w3 = await DELETE_WORD({} as never, ctx(word.id));
    expect(w3.status).toBe(200);

    await expect(getContentVersion()).resolves.toBe(v0 + 5);

    // El sync refleja la versión final.
    const sync = await GET_SYNC(new Request("http://x/api/sync") as never);
    expect((await sync.json()).contentVersion).toBe(String(v0 + 5));
  });
});
