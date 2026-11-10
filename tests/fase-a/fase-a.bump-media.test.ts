import "./test-db";
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({
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

import { requireRole, requireAdmin } from "@/lib/auth";
import { POST as POST_UPLOAD_AUDIO } from "@/app/api/admin/upload-audio/route";
import { POST as POST_UPLOAD_IMAGE } from "@/app/api/admin/upload-image/route";
import { POST as POST_DELETE_AUDIO } from "@/app/api/admin/delete-audio/route";
import { DELETE as DELETE_MEDIA } from "@/app/api/media/[id]/route";
import { POST as POST_UPDATE_AUDIO } from "@/app/api/dictionary/update-audio/route";
import { getContentVersion } from "@/lib/content-version";
import { testDb, ensureSeedRow, disconnectTestDb } from "./test-db";
import { acquireBumpLock, releaseBumpLock } from "./lock";

/**
 * T06 — Bumps grupo medios (spec §2.3 puntos 10–14; BUMP-03/05, DEL-03).
 *
 * - upload-audio: crea fila MediaAsset (cierra brecha de inventario) +1;
 *   si el insert falla se compensa (borra R2) sin bump. 400 sin bump.
 * - upload-image: +1 junto al create; fallo de insert → compensa sin bump.
 * - delete-audio: elimina fila resuelta por objectKey + objeto R2, +1;
 *   clave válida sin fila → borra objeto por compatibilidad +1 igual;
 *   clave irresoluble (400) sin bump.
 * - media DELETE: +1 tras borrado exitoso; 404 sin bump.
 * - update-audio legacy: +1 si tocó ≥1 fila; 0 filas sin bump.
 */

process.env.R2_PUBLIC_BASE_URL = "https://cdn.test";

const editorSession = {
  session: { user: { id: "e-t06", name: "Editor", email: "e@t06.test", role: "editor" } },
  error: null,
} as never;

const adminSession = {
  session: { user: { id: "a-t06", name: "Admin", email: "a@t06.test", role: "admin" } },
  error: null,
} as never;

let seq = 0;
const tag = (ext: string) => `t06-${Date.now()}-${seq++}.${ext}`;

// MP3 mínimo aceptado por detectAudioMime (cabecera ID3, ver upload-audio.test).
const MP3_BYTES = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 1, 2, 3]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function fileReq(url: string, file: File | null): Request {
  const fd = new FormData();
  if (file) fd.append("file", file);
  // OJO: multipart real jsdom↔undici no sobrevive al roundtrip: se espía formData.
  const req = new Request(url, { method: "POST" });
  vi.spyOn(req, "formData").mockResolvedValue(fd);
  return req;
}

const audioFile = (name: string) => new File([MP3_BYTES as unknown as BlobPart], name, { type: "audio/mpeg" });
const imageFile = (name: string) => new File([PNG_BYTES as unknown as BlobPart], name, { type: "image/png" });

function jsonReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedAsset(objectKey: string) {
  return testDb().mediaAsset.create({
    data: { objectKey, filename: "seed.mp3", mimeType: "audio/mpeg", size: 12 },
  });
}

beforeAll(async () => {
  await acquireBumpLock("bump-media");
  await ensureSeedRow();
});

afterAll(async () => {
  await releaseBumpLock();
  await disconnectTestDb();
});

beforeEach(() => {
  vi.mocked(requireRole).mockResolvedValue(editorSession);
  vi.mocked(requireAdmin).mockResolvedValue(adminSession);
  mockPutObject.mockResolvedValue(undefined);
  mockDeleteObject.mockResolvedValue(undefined);
});

afterEach(async () => {
  await testDb().mediaAsset.deleteMany({ where: { filename: { startsWith: "t06-" } } });
  await testDb().dictionaryWord.deleteMany({
    where: { OR: [{ spanish: { startsWith: "t06-" } }, { spanish: "agua" }] },
  });
});

describe("T06 punto 11 — POST /api/admin/upload-audio", () => {
  it("sube a R2, crea la fila MediaAsset e incrementa +1", async () => {
    const before = await getContentVersion();
    const name = tag("mp3");
    const res = await POST_UPLOAD_AUDIO(
      fileReq("http://x/api/admin/upload-audio", audioFile(name))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.objectKey).toMatch(/^audios\//);
    const row = await testDb().mediaAsset.findUnique({ where: { objectKey: body.objectKey } });
    expect(row).not.toBeNull();
    expect(row?.filename).toBe(name);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("400 sin archivo deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_UPLOAD_AUDIO(fileReq("http://x/api/admin/upload-audio", null));
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T06 punto 12 — POST /api/admin/upload-image", () => {
  it("sube a R2, crea la fila e incrementa +1", async () => {
    const before = await getContentVersion();
    const name = tag("png");
    const res = await POST_UPLOAD_IMAGE(fileReq("http://x/api/admin/upload-image", imageFile(name)));
    expect(res.status).toBe(200);
    const body = await res.json();
    const row = await testDb().mediaAsset.findUnique({ where: { objectKey: body.objectKey } });
    expect(row).not.toBeNull();
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("400 con basura binaria deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_UPLOAD_IMAGE(
      fileReq(
        "http://x/api/admin/upload-image",
        new File([new Uint8Array([1, 2, 3, 4]) as unknown as BlobPart], tag("png"), { type: "image/png" })
      )
    );
    expect(res.status).toBe(400);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T06 punto 13 — POST /api/admin/delete-audio", () => {
  it("elimina fila + objeto e incrementa +1", async () => {
    const key = `audios/temp/t06-${Date.now()}-${seq++}.mp3`;
    await seedAsset(key);
    const before = await getContentVersion();
    const res = await POST_DELETE_AUDIO(jsonReq("http://x/api/admin/delete-audio", { objectKey: key }));
    expect(res.status).toBe(200);
    await expect(testDb().mediaAsset.findUnique({ where: { objectKey: key } })).resolves.toBeNull();
    expect(mockDeleteObject).toHaveBeenCalledWith(key);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("clave válida sin fila: borra el objeto por compatibilidad y aplica +1 igual", async () => {
    const key = `audios/temp/t06-huerfano-${Date.now()}.mp3`;
    const before = await getContentVersion();
    const res = await POST_DELETE_AUDIO(jsonReq("http://x/api/admin/delete-audio", { objectKey: key }));
    expect(res.status).toBe(200);
    expect(mockDeleteObject).toHaveBeenCalledWith(key);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("400 con referencia irresoluble deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await POST_DELETE_AUDIO(jsonReq("http://x/api/admin/delete-audio", { audioUrl: "/audio/test.mp3" }));
    expect(res.status).toBe(400);
    expect(mockDeleteObject).not.toHaveBeenCalled();
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T06 punto 14 — DELETE /api/media/[id]", () => {
  it("borra fila + objeto e incrementa +1", async () => {
    const asset = await seedAsset(`audios/temp/t06-media-${Date.now()}.mp3`);
    const before = await getContentVersion();
    const res = await DELETE_MEDIA({} as never, { params: Promise.resolve({ id: asset.id }) });
    expect(res.status).toBe(200);
    await expect(testDb().mediaAsset.findUnique({ where: { id: asset.id } })).resolves.toBeNull();
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("404 deja la versión intacta", async () => {
    const before = await getContentVersion();
    const res = await DELETE_MEDIA({} as never, { params: Promise.resolve({ id: "id-inexistente-t06" }) });
    expect(res.status).toBe(404);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});

describe("T06 punto 10 — POST /api/dictionary/update-audio (legacy)", () => {
  it("toca ≥1 fila e incrementa +1", async () => {
    await testDb().dictionaryWord.create({
      data: { spanish: "agua", nasaYuwe: "ny", status: "DRAFT" },
    });
    const before = await getContentVersion();
    const res = await POST_UPDATE_AUDIO();
    expect(res.status).toBe(200);
    const row = await testDb().dictionaryWord.findFirst({ where: { spanish: "agua" } });
    expect(row?.audioUrl).toBe("/audio/wala.wav");
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("0 filas tocadas deja la versión intacta", async () => {
    // La BD de test puede traer seed con estas claves: se vacían primero
    // para garantizar el caso 0-filas de forma determinista.
    await testDb().dictionaryWord.deleteMany({
      where: { spanish: { in: ["agua", "persona", "sol", "luna", "tierra", "fuego", "lengua", "corazón", "montaña"] } },
    });
    const before = await getContentVersion();
    const res = await POST_UPDATE_AUDIO();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.every((r: string) => r.endsWith("0 updated"))).toBe(true);
    await expect(getContentVersion()).resolves.toBe(before);
  });
});
