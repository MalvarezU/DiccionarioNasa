import "./test-db";
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}));

const mockDeleteObject = vi.fn();

vi.mock("@/lib/r2", () => ({
  putObject: vi.fn(),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

import { requireRole, requireAdmin, requireAuth } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { DELETE as DELETE_WORD } from "@/app/api/admin/words/[id]/route";
import { DELETE as DELETE_COURSE, GET as GET_COURSE } from "@/app/api/courses/[id]/route";
import { GET as LIST_COURSES } from "@/app/api/courses/route";
import { DELETE as DELETE_MODULE } from "@/app/api/modules/[id]/route";
import { DELETE as DELETE_LESSON } from "@/app/api/lessons/[id]/route";
import { GET as GET_MANIFEST } from "@/app/api/courses/[id]/manifest/route";
import { DELETE as DELETE_MEDIA } from "@/app/api/media/[id]/route";
import { POST as POST_DELETE_AUDIO } from "@/app/api/admin/delete-audio/route";
import { POST as POST_REVERT } from "@/app/api/admin/audit-logs/[id]/revert/route";
import { GET as GET_SYNC } from "@/app/api/sync/route";
import { getContentVersion } from "@/lib/content-version";
import { testDb, ensureSeedRow, disconnectTestDb } from "./test-db";
import { acquireBumpLock, releaseBumpLock } from "./lock";

/**
 * T07 — Borrado lógico por entidad + normalización case + regresión removedIds.
 *
 * - DEL-01: DELETE word/course deja ARCHIVED (no desaparece) y se excluye
 *   de lecturas públicas; el bump aplicó (verificado en bump-words/courses).
 * - DEL-02: DELETE module/lesson deja deletedAt seteado y se excluye del
 *   árbol público; revert del borrado deja deletedAt = null + bump.
 * - DEL-03: media DELETE y delete-audio eliminan la fila (sin deletedAt;
 *   reconciliación por diff de manifiesto).
 * - R-ARCHIVED: palabra histórica con status "archived" (minúsculas) aparece
 *   en removedIds de GET /api/sync y no en words.
 */

process.env.R2_PUBLIC_BASE_URL = "https://cdn.test";

const editorSession = {
  session: { user: { id: "e-t07", name: "Editor", email: "e@t07.test", role: "editor" } },
  error: null,
} as never;

const adminSession = {
  session: { user: { id: "a-t07", name: "Admin", email: "a@t07.test", role: "admin" } },
  error: null,
} as never;

const authOk = {
  session: { user: { id: "u-t07", name: "U", email: "u@t07.test", role: "user" } },
  error: null,
} as never;

let seq = 0;
const tag = () => `t07-${Date.now()}-${seq++}`;

const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  await acquireBumpLock("del-logico");
  await ensureSeedRow();
});

afterAll(async () => {
  await releaseBumpLock();
  await disconnectTestDb();
});

beforeEach(() => {
  vi.mocked(requireRole).mockResolvedValue(editorSession);
  vi.mocked(requireAdmin).mockResolvedValue(adminSession);
  vi.mocked(requireAuth).mockResolvedValue(authOk);
  vi.mocked(getServerSession).mockResolvedValue(null);
  mockDeleteObject.mockResolvedValue(undefined);
});

afterEach(async () => {
  await testDb().dictionaryWord.deleteMany({ where: { spanish: { startsWith: "t07-" } } });
  await testDb().course.deleteMany({ where: { title: { startsWith: "t07-" } } });
  await testDb().mediaAsset.deleteMany({ where: { filename: { startsWith: "t07-" } } });
});

describe("T07 DEL-01 — DictionaryWord/Course vía ARCHIVED", () => {
  it("DELETE word archiva y la excluye de lecturas públicas", async () => {
    const word = await testDb().dictionaryWord.create({
      data: { spanish: tag(), nasaYuwe: "ny", status: "PUBLISHED" },
    });
    const res = await DELETE_WORD(
      new Request("http://x/api/admin/words/w", { method: "DELETE" }),
      paramsOf(word.id)
    );
    expect(res.status).toBe(200);
    const row = await testDb().dictionaryWord.findUnique({ where: { id: word.id } });
    expect(row?.status).toBe("ARCHIVED");

    // Lectura pública del diccionario: solo PUBLISHED.
    const pub = await testDb().dictionaryWord.findMany({
      where: { status: "PUBLISHED", spanish: word.spanish },
    });
    expect(pub).toHaveLength(0);
  });

  it("DELETE course archiva y lo excluye del listado público", async () => {
    const course = await testDb().course.create({
      data: { title: tag(), status: "PUBLISHED" },
    });
    const res = await DELETE_COURSE({} as never, paramsOf(course.id));
    expect(res.status).toBe(200);
    const row = await testDb().course.findUnique({ where: { id: course.id } });
    expect(row?.status).toBe("ARCHIVED");

    const list = await LIST_COURSES({ nextUrl: new URL("http://x/api/courses") } as never);
    const body = await list.json();
    expect((body.courses as Array<{ id: string }>).some((c) => c.id === course.id)).toBe(false);
  });
});

describe("T07 DEL-02 — Module/Lesson vía deletedAt", () => {
  it("DELETE module setea deletedAt y lo excluye del árbol público", async () => {
    const course = await testDb().course.create({ data: { title: tag(), status: "PUBLISHED" } });
    const mod = await testDb().module.create({
      data: { courseId: course.id, title: tag(), order: 0 },
    });
    const res = await DELETE_MODULE({} as never, paramsOf(mod.id));
    expect(res.status).toBe(200);
    const row = await testDb().module.findUnique({ where: { id: mod.id } });
    expect(row?.deletedAt).not.toBeNull();

    const detail = await GET_COURSE({} as never, paramsOf(course.id));
    const body = await detail.json();
    expect(body.course.modules).toHaveLength(0);
  });

  it("DELETE lesson setea deletedAt y lo excluye del manifest", async () => {
    const course = await testDb().course.create({ data: { title: tag(), status: "PUBLISHED" } });
    const mod = await testDb().module.create({
      data: { courseId: course.id, title: tag(), order: 0 },
    });
    const lesson = await testDb().lesson.create({
      data: {
        moduleId: mod.id,
        title: tag(),
        order: 0,
        lessonNumber: 1,
        content: { version: 2, blocks: [] },
      },
    });
    const res = await DELETE_LESSON({} as never, paramsOf(lesson.id));
    expect(res.status).toBe(200);
    const row = await testDb().lesson.findUnique({ where: { id: lesson.id } });
    expect(row?.deletedAt).not.toBeNull();

    const manifest = await GET_MANIFEST({} as never, paramsOf(course.id));
    const body = await manifest.json();
    expect(body.modules).toHaveLength(1);
    expect(body.modules[0].lessons).toHaveLength(0);
  });

  it("revert del borrado lógico restaura deletedAt = null con +1", async () => {
    const course = await testDb().course.create({ data: { title: tag(), status: "PUBLISHED" } });
    const mod = await testDb().module.create({
      data: { courseId: course.id, title: tag(), order: 0 },
    });
    await DELETE_MODULE({} as never, paramsOf(mod.id));

    const log = await testDb().auditLog.findFirst({
      where: { action: "DELETE", entity: "Module", entityId: mod.id },
      orderBy: { createdAt: "desc" },
    });
    expect(log).not.toBeNull();

    const before = await getContentVersion();
    const res = await POST_REVERT({} as Request, {
      params: Promise.resolve({ id: log!.id }),
    });
    expect(res.status).toBe(200);
    const row = await testDb().module.findUnique({ where: { id: mod.id } });
    expect(row?.deletedAt).toBeNull();
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("revert de borrado ya restaurado (409) no hace bump", async () => {
    const course = await testDb().course.create({ data: { title: tag(), status: "PUBLISHED" } });
    const mod = await testDb().module.create({
      data: { courseId: course.id, title: tag(), order: 0 },
    });
    // Borrado y restaurado: deletedAt vuelve a null.
    await DELETE_MODULE({} as never, paramsOf(mod.id));
    const log = await testDb().auditLog.findFirst({
      where: { action: "DELETE", entity: "Module", entityId: mod.id },
      orderBy: { createdAt: "desc" },
    });
    await POST_REVERT({} as Request, { params: Promise.resolve({ id: log!.id }) });

    const before = await getContentVersion();
    const res = await POST_REVERT({} as Request, { params: Promise.resolve({ id: log!.id }) });
    expect(res.status).toBe(409);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T07 DEL-03 — MediaAsset por diff de manifiesto (sin deletedAt)", () => {
  it("media DELETE elimina la fila (el objectKey sale del inventario)", async () => {
    const asset = await testDb().mediaAsset.create({
      data: {
        objectKey: `images/t07-${Date.now()}.png`,
        filename: "t07-a.png",
        mimeType: "image/png",
        size: 12,
      },
    });
    const res = await DELETE_MEDIA({} as never, { params: Promise.resolve({ id: asset.id }) });
    expect(res.status).toBe(200);
    await expect(
      testDb().mediaAsset.findFirst({ where: { objectKey: asset.objectKey } })
    ).resolves.toBeNull();
  });

  it("delete-audio elimina la fila resuelta por objectKey", async () => {
    const key = `audios/temp/t07-${Date.now()}.mp3`;
    await testDb().mediaAsset.create({
      data: { objectKey: key, filename: "t07-b.mp3", mimeType: "audio/mpeg", size: 12 },
    });
    const res = await POST_DELETE_AUDIO(
      new Request("http://x/api/admin/delete-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey: key }),
      })
    );
    expect(res.status).toBe(200);
    await expect(testDb().mediaAsset.findFirst({ where: { objectKey: key } })).resolves.toBeNull();
  });
});

describe("T07 R-ARCHIVED — regresión de case en sync", () => {
  it("palabra histórica 'archived' en minúsculas va a removedIds y no a words", async () => {
    const legacy = await testDb().dictionaryWord.create({
      data: { spanish: tag(), nasaYuwe: "ny", status: "archived" },
    });
    const res = await GET_SYNC(
      new Request("http://x/api/sync?limit=1000") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removedIds).toContain(legacy.id);
    expect((body.words as Array<{ id: string }>).some((w) => w.id === legacy.id)).toBe(false);
  });
});
