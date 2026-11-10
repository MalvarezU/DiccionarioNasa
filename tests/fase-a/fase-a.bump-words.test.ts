import "./test-db";
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
}));

import { requireRole, requireAdmin } from "@/lib/auth";
import { POST as POST_WORDS } from "@/app/api/admin/words/route";
import { PUT, PATCH, DELETE } from "@/app/api/admin/words/[id]/route";
import { POST as POST_BULK } from "@/app/api/admin/words/bulk-status/route";
import { getContentVersion } from "@/lib/content-version";
import { testDb, ensureSeedRow, disconnectTestDb } from "./test-db";
import { acquireBumpLock, releaseBumpLock } from "./lock";

/**
 * T03 — Bumps grupo words (spec §2.3 puntos 1–5; BUMP-02/03/05).
 *
 * - POST/PUT/PATCH/DELETE efectivos → +1 cada uno.
 * - `bulk-status` sobre N fichas → +1 exacto (no +N); 0 filas → sin bump.
 * - 400/404 (incluido `status` inválido) → sin bump.
 * - Normalización T07: `status` en minúsculas se acepta y se guarda en
 *   mayúsculas (`published` → `PUBLISHED`).
 *
 * Aserciones siempre relativas a la versión leída justo antes del request
 * (nunca absolutas): los demás archivos de Fase A comparten la BD (ver
 * `lock.ts`: este archivo corre con el lock de bump).
 */

const editorSession = {
  session: { user: { id: "e-t03", name: "Editor", email: "e@t03.test", role: "editor" } },
  error: null,
} as never;

const adminSession = {
  session: { user: { id: "a-t03", name: "Admin", email: "a@t03.test", role: "admin" } },
  error: null,
} as never;

let seq = 0;
const tag = () => `t03-${Date.now()}-${seq++}`;

function req(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) });

async function seedWord(overrides: Record<string, unknown> = {}) {
  return testDb().dictionaryWord.create({
    data: {
      spanish: tag(),
      nasaYuwe: "ny",
      status: "DRAFT",
      ...overrides,
    },
  });
}

beforeAll(async () => {
  await acquireBumpLock("bump-words");
  await ensureSeedRow();
});

afterAll(async () => {
  await releaseBumpLock();
  await disconnectTestDb();
});

beforeEach(() => {
  vi.mocked(requireRole).mockResolvedValue(editorSession);
  vi.mocked(requireAdmin).mockResolvedValue(adminSession);
});

afterEach(async () => {
  await testDb().dictionaryWord.deleteMany({ where: { spanish: { startsWith: "t03-" } } });
});

describe("T03 punto 1 — POST /api/admin/words", () => {
  it("crea la ficha e incrementa la versión en +1", async () => {
    const before = await getContentVersion();
    const res = await POST_WORDS(
      req("http://x/api/admin/words", "POST", { spanish: tag(), nasaYuwe: "ny" })
    );
    expect(res.status).toBe(201);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("400 sin campos obligatorios deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_WORDS(req("http://x/api/admin/words", "POST", {}));
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("400 con status inválido deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_WORDS(
      req("http://x/api/admin/words", "POST", { spanish: tag(), nasaYuwe: "ny", status: "WRONG" })
    );
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("normaliza status en minúsculas a mayúsculas y aplica +1", async () => {
    const before = await getContentVersion();
    const spanish = tag();
    const res = await POST_WORDS(
      req("http://x/api/admin/words", "POST", { spanish, nasaYuwe: "ny", status: "published" })
    );
    expect(res.status).toBe(201);
    const row = await testDb().dictionaryWord.findFirst({ where: { spanish } });
    expect(row?.status).toBe("PUBLISHED");
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });
});

describe("T03 punto 2 — PUT /api/admin/words/[id]", () => {
  it("actualiza la ficha e incrementa la versión en +1", async () => {
    const word = await seedWord();
    const before = await getContentVersion();
    const res = await PUT(
      req("http://x/api/admin/words/w", "PUT", { category: "verbo" }),
      paramsOf(word.id)
    );
    expect(res.status).toBe(200);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("400 con status inválido deja la versión intacta", async () => {
    const word = await seedWord();
    const before = await getContentVersion();
    const res = await PUT(
      req("http://x/api/admin/words/w", "PUT", { status: "WRONG" }),
      paramsOf(word.id)
    );
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("normaliza status en minúsculas, lo guarda en mayúsculas y aplica +1", async () => {
    const word = await seedWord({ status: "DRAFT" });
    const before = await getContentVersion();
    const res = await PUT(
      req("http://x/api/admin/words/w", "PUT", { status: "archived" }),
      paramsOf(word.id)
    );
    expect(res.status).toBe(200);
    const row = await testDb().dictionaryWord.findUnique({ where: { id: word.id } });
    expect(row?.status).toBe("ARCHIVED");
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("200 sin cambios detectados deja la versión intacta", async () => {
    const word = await seedWord({ spanish: tag(), category: "sustantivo" });
    const before = await getContentVersion();
    const res = await PUT(
      req("http://x/api/admin/words/w", "PUT", { spanish: word.spanish }),
      paramsOf(word.id)
    );
    expect(res.status).toBe(200);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("404 deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await PUT(
      req("http://x/api/admin/words/w", "PUT", { category: "verbo" }),
      paramsOf("id-inexistente-t03")
    );
    expect(res.status).toBe(404);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T03 punto 3 — PATCH /api/admin/words/[id]", () => {
  it("cambia el estado e incrementa la versión en +1", async () => {
    const word = await seedWord({ status: "DRAFT" });
    const before = await getContentVersion();
    const res = await PATCH(
      req("http://x/api/admin/words/w", "PATCH", { status: "PUBLISHED" }),
      paramsOf(word.id)
    );
    expect(res.status).toBe(200);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("normaliza status en minúsculas y aplica +1", async () => {
    const word = await seedWord({ status: "DRAFT" });
    const before = await getContentVersion();
    const res = await PATCH(
      req("http://x/api/admin/words/w", "PATCH", { status: "archived" }),
      paramsOf(word.id)
    );
    expect(res.status).toBe(200);
    const row = await testDb().dictionaryWord.findUnique({ where: { id: word.id } });
    expect(row?.status).toBe("ARCHIVED");
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("400 con status inválido deja la versión intacta", async () => {
    const word = await seedWord();
    const before = await getContentVersion();
    const res = await PATCH(
      req("http://x/api/admin/words/w", "PATCH", { status: "WRONG" }),
      paramsOf(word.id)
    );
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("mismo estado devuelve 200 sin bump", async () => {
    const word = await seedWord({ status: "PUBLISHED" });
    const before = await getContentVersion();
    const res = await PATCH(
      req("http://x/api/admin/words/w", "PATCH", { status: "PUBLISHED" }),
      paramsOf(word.id)
    );
    expect(res.status).toBe(200);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("404 deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await PATCH(
      req("http://x/api/admin/words/w", "PATCH", { status: "PUBLISHED" }),
      paramsOf("id-inexistente-t03")
    );
    expect(res.status).toBe(404);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T03 punto 4 — DELETE /api/admin/words/[id] (reemplazo lateral T07)", () => {
  it("archiva la ficha (no la borra) e incrementa la versión en +1", async () => {
    const word = await seedWord({ status: "PUBLISHED" });
    const before = await getContentVersion();
    const res = await DELETE(
      req("http://x/api/admin/words/w", "DELETE"),
      paramsOf(word.id)
    );
    expect(res.status).toBe(200);
    const row = await testDb().dictionaryWord.findUnique({ where: { id: word.id } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe("ARCHIVED");
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("404 deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await DELETE(
      req("http://x/api/admin/words/w", "DELETE"),
      paramsOf("id-inexistente-t03")
    );
    expect(res.status).toBe(404);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T03 punto 5 — POST /api/admin/words/bulk-status", () => {
  it("N fichas efectivas producen exactamente +1 (no +N)", async () => {
    const words = await Promise.all([
      seedWord({ status: "DRAFT" }),
      seedWord({ status: "DRAFT" }),
      seedWord({ status: "DRAFT" }),
    ]);
    const before = await getContentVersion();
    const res = await POST_BULK(
      req("http://x/api/admin/words/bulk-status", "POST", {
        wordIds: words.map((w) => w.id),
        status: "PUBLISHED",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(3);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("normaliza status en minúsculas y aplica +1", async () => {
    const word = await seedWord({ status: "DRAFT" });
    const before = await getContentVersion();
    const res = await POST_BULK(
      req("http://x/api/admin/words/bulk-status", "POST", {
        wordIds: [word.id],
        status: "published",
      })
    );
    expect(res.status).toBe(200);
    const row = await testDb().dictionaryWord.findUnique({ where: { id: word.id } });
    expect(row?.status).toBe("PUBLISHED");
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("0 filas efectivas deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_BULK(
      req("http://x/api/admin/words/bulk-status", "POST", {
        wordIds: ["id-inexistente-t03-a", "id-inexistente-t03-b"],
        status: "PUBLISHED",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(0);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("400 con status inválido deja la versión intacta", async () => {
    const word = await seedWord();
    const before = await getContentVersion();
    const res = await POST_BULK(
      req("http://x/api/admin/words/bulk-status", "POST", {
        wordIds: [word.id],
        status: "WRONG",
      })
    );
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});
