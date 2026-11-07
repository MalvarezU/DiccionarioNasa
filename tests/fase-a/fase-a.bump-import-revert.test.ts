import "./test-db";
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/r2", () => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

import { requireRole, requireAdmin } from "@/lib/auth";
import { POST as POST_STAGING } from "@/app/api/admin/import/route";
import { POST as POST_PREVIEW } from "@/app/api/admin/import/preview/route";
import { POST as POST_CONFIRM } from "@/app/api/admin/import/confirm/route";
import { POST as POST_REVERT } from "@/app/api/admin/audit-logs/[id]/revert/route";
import { storePreview, __resetPreviewStore } from "@/app/api/admin/import/preview/route";
import { getContentVersion } from "@/lib/content-version";
import { testDb, ensureSeedRow, disconnectTestDb } from "./test-db";
import { acquireBumpLock, releaseBumpLock } from "./lock";

/**
 * T04 — Bumps grupo import (dos pasos) + revert (spec §2.3 puntos 6–9).
 *
 * - Staging (`POST /api/admin/import`) y preview: SIN bump (spec §2.3.6/8).
 * - Confirm: +1 por confirmación aplicada con ≥1 fila (N filas = +1, no +N);
 *   0 filas efectivas → sin bump.
 * - Revert: +1 solo si aplica (2xx); 404/409/410/422 → sin bump.
 * - E2: revert de DELETE histórico sin snapshot completo → 422 (no 409).
 */

const editorSession = {
  session: { user: { id: "e-t04", name: "Editor", email: "e@t04.test", role: "editor" } },
  error: null,
} as never;

const adminSession = {
  session: { user: { id: "a-t04", name: "Admin", email: "a@t04.test", role: "admin" } },
  error: null,
} as never;

let seq = 0;
const tag = () => `t04-${Date.now()}-${seq++}`;

function jsonReq(url: string, body?: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const revertParams = (id: string) => ({ params: Promise.resolve({ id }) });

async function seedWord(overrides: Record<string, unknown> = {}) {
  return testDb().dictionaryWord.create({
    data: { spanish: tag(), nasaYuwe: "ny", status: "DRAFT", ...overrides },
  });
}

async function seedLog(data: Record<string, unknown>) {
  return testDb().auditLog.create({
    data: {
      action: "UPDATE",
      entity: "DictionaryWord",
      userId: "a-t04",
      ...data,
    } as never,
  });
}

const validRow = (spanish: string) => ({
  spanish,
  nasaYuwe: "ny",
  pronunciation: null,
  audioUrl: null,
  culturalContext: null,
  category: null,
  examples: null,
  status: "DRAFT" as const,
});

beforeAll(async () => {
  await acquireBumpLock("bump-import-revert");
  await ensureSeedRow();
});

afterAll(async () => {
  await releaseBumpLock();
  await disconnectTestDb();
});

beforeEach(() => {
  vi.mocked(requireRole).mockResolvedValue(editorSession);
  vi.mocked(requireAdmin).mockResolvedValue(adminSession);
  __resetPreviewStore();
});

afterEach(async () => {
  await testDb().dictionaryWord.deleteMany({ where: { spanish: { startsWith: "t04-" } } });
});

describe("T04 staging y preview no publican (sin bump)", () => {
  it("POST /api/admin/import crea fichas pero deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_STAGING(
      jsonReq("http://x/api/admin/import", {
        words: [
          { spanish: tag(), nasaYuwe: "ny" },
          { spanish: tag(), nasaYuwe: "ny" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(2);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("POST /api/admin/import/preview solo valida y deja la versión intacta", async () => {
    const before = await getContentVersion();
    const csv = `spanish,nasaYuwe\n${tag()},ny`;
    const fd = new FormData();
    fd.append("file", new File([csv], "palabras.csv", { type: "text/csv" }));
    // OJO: multipart real jsdom↔undici no sobrevive al roundtrip: se espía formData.
    const raw = new Request("http://x/api/admin/import/preview", { method: "POST" });
    vi.spyOn(raw, "formData").mockResolvedValue(fd);
    const res = await POST_PREVIEW(raw);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(1);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T04 punto 7 — POST /api/admin/import/confirm", () => {
  it("N filas aplicadas producen exactamente +1 (no +N)", async () => {
    const token = storePreview([validRow(tag()), validRow(tag()), validRow(tag())]);
    const before = await getContentVersion();
    const res = await POST_CONFIRM(jsonReq("http://x/api/admin/import/confirm", { previewToken: token }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(3);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("0 filas efectivas (todo duplicado) deja la versión intacta", async () => {
    const dup = await seedWord();
    const token = storePreview([validRow(dup.spanish)]);
    const before = await getContentVersion();
    const res = await POST_CONFIRM(jsonReq("http://x/api/admin/import/confirm", { previewToken: token }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(0);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("token inválido (410) deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_CONFIRM(jsonReq("http://x/api/admin/import/confirm", { previewToken: "no-existe" }));
    expect(res.status).toBe(410);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("sin token (400) deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_CONFIRM(jsonReq("http://x/api/admin/import/confirm", {}));
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T04 punto 9 — POST /api/admin/audit-logs/[id]/revert", () => {
  it("revert aplicado (UPDATE) restaura y deja +1", async () => {
    const word = await seedWord({ category: "verbo" });
    const log = await seedLog({
      entityId: word.id,
      wordId: word.id,
      changes: JSON.stringify({ category: { before: "sustantivo", after: "verbo" } }),
    });
    const before = await getContentVersion();
    const res = await POST_REVERT(jsonReq("http://x/revert", {}), revertParams(log.id));
    expect(res.status).toBe(200);
    const row = await testDb().dictionaryWord.findUnique({ where: { id: word.id } });
    expect(row?.category).toBe("sustantivo");
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("revert aplicado (CREATE) elimina la ficha y deja +1", async () => {
    const word = await seedWord();
    const log = await seedLog({
      action: "CREATE",
      entityId: word.id,
      wordId: word.id,
      changes: JSON.stringify({ spanish: word.spanish, nasaYuwe: "ny" }),
    });
    const before = await getContentVersion();
    const res = await POST_REVERT(jsonReq("http://x/revert", {}), revertParams(log.id));
    expect(res.status).toBe(200);
    await expect(testDb().dictionaryWord.findUnique({ where: { id: word.id } })).resolves.toBeNull();
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("404 (log inexistente) deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_REVERT(jsonReq("http://x/revert", {}), revertParams("log-inexistente-t04"));
    expect(res.status).toBe(404);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("409 (ya revertido) deja la versión intacta", async () => {
    const word = await seedWord({ category: "verbo" });
    const log = await seedLog({
      entityId: word.id,
      wordId: word.id,
      changes: JSON.stringify({ category: { before: "sustantivo", after: "verbo" } }),
    });
    await seedLog({
      action: "REVERT",
      entity: "DictionaryWord",
      entityId: word.id,
      wordId: word.id,
      changes: JSON.stringify({ originalLogId: log.id, restored: "ok" }),
    });
    const before = await getContentVersion();
    const res = await POST_REVERT(jsonReq("http://x/revert", {}), revertParams(log.id));
    expect(res.status).toBe(409);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("409 (divergencia posterior) deja la versión intacta", async () => {
    const word = await seedWord({ category: "otro" });
    const log = await seedLog({
      entityId: word.id,
      wordId: word.id,
      changes: JSON.stringify({ category: { before: "sustantivo", after: "verbo" } }),
    });
    const before = await getContentVersion();
    const res = await POST_REVERT(jsonReq("http://x/revert", {}), revertParams(log.id));
    expect(res.status).toBe(409);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("422 (DELETE histórico sin snapshot) deja la versión intacta", async () => {
    const log = await seedLog({
      action: "DELETE",
      entity: "DictionaryWord",
      entityId: "ficha-vieja-t04",
      wordId: null,
      changes: JSON.stringify({ responsable: "admin" }),
    });
    const before = await getContentVersion();
    const res = await POST_REVERT(jsonReq("http://x/revert", {}), revertParams(log.id));
    expect(res.status).toBe(422);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});
