import "./test-db";
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}));

import { requireRole, requireAdmin } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { POST as POST_COURSES } from "@/app/api/courses/route";
import { PATCH as PATCH_COURSE, DELETE as DELETE_COURSE } from "@/app/api/courses/[id]/route";
import { POST as POST_MODULES } from "@/app/api/modules/route";
import { PATCH as PATCH_MODULE, DELETE as DELETE_MODULE } from "@/app/api/modules/[id]/route";
import { POST as POST_LESSON } from "@/app/api/modules/[id]/lessons/route";
import { PATCH as PATCH_LESSON, PUT as PUT_LESSON, DELETE as DELETE_LESSON } from "@/app/api/lessons/[id]/route";
import { POST as POST_REORDER } from "@/app/api/courses/[id]/reorder/route";
import { getContentVersion } from "@/lib/content-version";
import { testDb, ensureSeedRow, disconnectTestDb } from "./test-db";
import { acquireBumpLock, releaseBumpLock } from "./lock";

/**
 * T05 — Bumps grupo cursos (spec §2.3 puntos 15–19; BUMP-02/03/05).
 *
 * - POST course / PATCH course / DELETE course (→ARCHIVED) → +1.
 * - POST/PATCH module, DELETE module (→deletedAt) → +1.
 * - POST/PATCH/PUT lesson, DELETE lesson (→deletedAt) → +1.
 * - reorder: ≥1 cambio real → +1 exacto; no-op (vacío o idéntico) → sin bump.
 * - 400/404/409/500 → sin bump.
 * - El bump vive en los handlers, no en `courses/_lib.ts`.
 */

const editorSession = {
  session: { user: { id: "e-t05", name: "Editor", email: "e@t05.test", role: "editor" } },
  error: null,
} as never;

const adminSession = {
  session: { user: { id: "a-t05", name: "Admin", email: "a@t05.test", role: "admin" } },
  error: null,
} as never;

let seq = 0;
const tag = () => `t05-${Date.now()}-${seq++}`;

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) });

async function seedCourse(status = "DRAFT") {
  return testDb().course.create({ data: { title: tag(), status: status as never } });
}

async function seedModule(courseId: string, order = 0) {
  return testDb().module.create({ data: { courseId, title: tag(), order } });
}

async function seedLesson(moduleId: string, order = 0) {
  return testDb().lesson.create({
    data: {
      moduleId,
      title: tag(),
      order,
      lessonNumber: order + 1,
      content: { version: 2, blocks: [] },
    },
  });
}

beforeAll(async () => {
  await acquireBumpLock("bump-courses");
  await ensureSeedRow();
});

afterAll(async () => {
  await releaseBumpLock();
  await disconnectTestDb();
});

beforeEach(() => {
  vi.mocked(requireRole).mockResolvedValue(editorSession);
  vi.mocked(requireAdmin).mockResolvedValue(adminSession);
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: "e-t05", role: "editor" },
  } as never);
});

afterEach(async () => {
  await testDb().course.deleteMany({ where: { title: { startsWith: "t05-" } } });
  await testDb().module.deleteMany({ where: { title: { startsWith: "t05-" } } });
});

describe("T05 punto 15 — POST /api/courses", () => {
  it("crea el curso e incrementa la versión en +1", async () => {
    const before = await getContentVersion();
    const res = await POST_COURSES(jsonReq("http://x/api/courses", "POST", { title: tag() }) as never);
    expect(res.status).toBe(201);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("400 sin título deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_COURSES(jsonReq("http://x/api/courses", "POST", {}) as never);
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T05 punto 16 — PATCH/DELETE /api/courses/[id]", () => {
  it("PATCH actualiza e incrementa la versión en +1", async () => {
    const course = await seedCourse();
    const before = await getContentVersion();
    const res = await PATCH_COURSE(
      jsonReq("http://x/api/courses/c", "PATCH", { title: tag() }) as never,
      paramsOf(course.id)
    );
    expect(res.status).toBe(200);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("PATCH vacío (400) deja la versión intacta", async () => {
    const course = await seedCourse();
    const before = await getContentVersion();
    const res = await PATCH_COURSE(jsonReq("http://x/api/courses/c", "PATCH", {}) as never, paramsOf(course.id));
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("DELETE archiva (no borra) e incrementa la versión en +1", async () => {
    const course = await seedCourse("PUBLISHED");
    const before = await getContentVersion();
    const res = await DELETE_COURSE({} as never, paramsOf(course.id));
    expect(res.status).toBe(200);
    const row = await testDb().course.findUnique({ where: { id: course.id } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe("ARCHIVED");
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });
});

describe("T05 punto 17 — módulos", () => {
  it("POST /api/modules crea e incrementa la versión en +1", async () => {
    const course = await seedCourse();
    const before = await getContentVersion();
    const res = await POST_MODULES(
      jsonReq("http://x/api/modules", "POST", { courseId: course.id, title: tag() }) as never
    );
    expect(res.status).toBe(201);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("POST /api/modules sin datos (400) deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_MODULES(jsonReq("http://x/api/modules", "POST", {}) as never);
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("PATCH /api/modules/[id] actualiza e incrementa la versión en +1", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id);
    const before = await getContentVersion();
    const res = await PATCH_MODULE(
      jsonReq("http://x/api/modules/m", "PATCH", { title: tag() }) as never,
      paramsOf(mod.id)
    );
    expect(res.status).toBe(200);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("PATCH /api/modules/[id] vacío (400) deja la versión intacta", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id);
    const before = await getContentVersion();
    const res = await PATCH_MODULE(jsonReq("http://x/api/modules/m", "PATCH", {}) as never, paramsOf(mod.id));
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("DELETE /api/modules/[id] marca deletedAt (no borra) e incrementa +1", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id);
    const before = await getContentVersion();
    const res = await DELETE_MODULE({} as never, paramsOf(mod.id));
    expect(res.status).toBe(200);
    const row = await testDb().module.findUnique({ where: { id: mod.id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });
});

describe("T05 punto 18 — lecciones", () => {
  it("POST /api/modules/[id]/lessons crea e incrementa la versión en +1", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id);
    const before = await getContentVersion();
    const res = await POST_LESSON(
      jsonReq("http://x/api/modules/m/lessons", "POST", { title: tag() }) as never,
      paramsOf(mod.id)
    );
    expect(res.status).toBe(201);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("POST lección duplicada (409) deja la versión intacta", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id);
    const lesson = await seedLesson(mod.id);
    const before = await getContentVersion();
    const res = await POST_LESSON(
      jsonReq("http://x/api/modules/m/lessons", "POST", { title: lesson.title }) as never,
      paramsOf(mod.id)
    );
    expect(res.status).toBe(409);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("POST lección en módulo inexistente (404) deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_LESSON(
      jsonReq("http://x/api/modules/m/lessons", "POST", { title: tag() }) as never,
      paramsOf("modulo-inexistente-t05")
    );
    expect(res.status).toBe(404);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("PATCH /api/lessons/[id] actualiza e incrementa la versión en +1", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id);
    const lesson = await seedLesson(mod.id);
    const before = await getContentVersion();
    const res = await PATCH_LESSON(
      jsonReq("http://x/api/lessons/l", "PATCH", { title: tag() }) as never,
      paramsOf(lesson.id)
    );
    expect(res.status).toBe(200);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("PUT /api/lessons/[id] guarda contenido e incrementa la versión en +1", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id);
    const lesson = await seedLesson(mod.id);
    const before = await getContentVersion();
    const res = await PUT_LESSON(
      jsonReq("http://x/api/lessons/l", "PUT", { content: { version: 2, blocks: [] } }) as never,
      paramsOf(lesson.id)
    );
    expect(res.status).toBe(200);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("PUT contenido inválido (400) deja la versión intacta", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id);
    const lesson = await seedLesson(mod.id);
    const before = await getContentVersion();
    const res = await PUT_LESSON(
      jsonReq("http://x/api/lessons/l", "PUT", { content: { version: 2, blocks: "roto" } }) as never,
      paramsOf(lesson.id)
    );
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("DELETE /api/lessons/[id] marca deletedAt (no borra) e incrementa +1", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id);
    const lesson = await seedLesson(mod.id);
    const before = await getContentVersion();
    const res = await DELETE_LESSON({} as never, paramsOf(lesson.id));
    expect(res.status).toBe(200);
    const row = await testDb().lesson.findUnique({ where: { id: lesson.id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });
});

describe("T05 punto 19 — POST /api/courses/[id]/reorder", () => {
  it("reordenar módulos deja exactamente +1", async () => {
    const course = await seedCourse();
    const m1 = await seedModule(course.id, 0);
    const m2 = await seedModule(course.id, 1);
    const before = await getContentVersion();
    const res = await POST_REORDER(
      jsonReq("http://x/api/courses/c/reorder", "POST", { modules: [m2.id, m1.id] }) as never,
      paramsOf(course.id)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBeGreaterThan(0);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("reordenar lecciones deja exactamente +1 (no +N)", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id);
    const l1 = await seedLesson(mod.id, 0);
    const l2 = await seedLesson(mod.id, 1);
    const l3 = await seedLesson(mod.id, 2);
    void l3;
    const before = await getContentVersion();
    const res = await POST_REORDER(
      jsonReq("http://x/api/courses/c/reorder", "POST", {
        lessons: { [mod.id]: [l2.id, l1.id] },
      }) as never,
      paramsOf(course.id)
    );
    expect(res.status).toBe(200);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("no-op (orden idéntico) deja la versión intacta", async () => {
    const course = await seedCourse();
    const mod = await seedModule(course.id, 0);
    const l1 = await seedLesson(mod.id, 0);
    const l2 = await seedLesson(mod.id, 1);
    const before = await getContentVersion();
    const res = await POST_REORDER(
      jsonReq("http://x/api/courses/c/reorder", "POST", {
        modules: [mod.id],
        lessons: { [mod.id]: [l1.id, l2.id] },
      }) as never,
      paramsOf(course.id)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(0);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("request vacío deja la versión intacta", async () => {
    const course = await seedCourse();
    const before = await getContentVersion();
    const res = await POST_REORDER(
      jsonReq("http://x/api/courses/c/reorder", "POST", {}) as never,
      paramsOf(course.id)
    );
    expect(res.status).toBe(200);
    await expect(getContentVersion()).resolves.toBe(before);
  });

  it("404 en curso inexistente deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_REORDER(
      jsonReq("http://x/api/courses/c/reorder", "POST", { modules: ["x"] }) as never,
      paramsOf("curso-inexistente-t05")
    );
    expect(res.status).toBe(404);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});
