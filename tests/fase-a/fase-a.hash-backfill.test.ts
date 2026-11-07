import "./test-db";
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { createHash } from "crypto";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
}));

const mockPutObject = vi.fn();
const mockDeleteObject = vi.fn();
const mockGetObjectBytes = vi.fn();

vi.mock("@/lib/r2", () => ({
  putObject: (...args: unknown[]) => mockPutObject(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  getObjectBytes: (...args: unknown[]) => mockGetObjectBytes(...args),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

import { requireRole, requireAdmin } from "@/lib/auth";
import { POST as POST_UPLOAD_AUDIO } from "@/app/api/admin/upload-audio/route";
import { POST as POST_UPLOAD_IMAGE } from "@/app/api/admin/upload-image/route";
import { POST as POST_UPDATE_AUDIO } from "@/app/api/dictionary/update-audio/route";
import { backfillMediaSha256 } from "@/lib/media/backfill-sha256";
import { getContentVersion } from "@/lib/content-version";
import { testDb, ensureSeedRow, disconnectTestDb } from "./test-db";
import { acquireBumpLock, releaseBumpLock } from "./lock";

/**
 * T08+T09 — Registro de medios (`sha256`, spec §4, criterios HASH-01/02).
 *
 * - T08: upload-audio, upload-image y update-audio persisten `sha256` (hex,
 *   64 chars, sobre bytes originales) en la fila `MediaAsset`; el hash
 *   coincide con el binario de R2 (calculado independientemente en el test).
 *   Referencias locales `/audio/*.wav` sin objeto R2 no crean fila y no
 *   bloquean (E6).
 * - T09: backfill idempotente + reporte de huérfanos (ver describes abajo).
 */

process.env.R2_PUBLIC_BASE_URL = "https://cdn.test";

const editorSession = {
  session: { user: { id: "e-t08", name: "Editor", email: "e@t08.test", role: "editor" } },
  error: null,
} as never;

const adminSession = {
  session: { user: { id: "a-t08", name: "Admin", email: "a@t08.test", role: "admin" } },
  error: null,
} as never;

let seq = 0;

// MP3 mínimo aceptado por detectAudioMime (cabecera ID3) y PNG mínimo.
const MP3_BYTES = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 1, 2, 3]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const sha256Of = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function fileReq(url: string, file: File | null): Request {
  const fd = new FormData();
  if (file) fd.append("file", file);
  // OJO: multipart real jsdom↔undici no sobrevive al roundtrip: se espía formData.
  const req = new Request(url, { method: "POST" });
  vi.spyOn(req, "formData").mockResolvedValue(fd);
  return req;
}

function jsonReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await acquireBumpLock("hash-backfill");
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
  mockGetObjectBytes.mockRejectedValue(Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey" }));
});

afterEach(async () => {
  await testDb().mediaAsset.deleteMany({ where: { objectKey: { contains: "t08" } } });
  await testDb().dictionaryWord.deleteMany({
    where: { OR: [{ spanish: { startsWith: "t08-" } }, { spanish: "agua" }] },
  });
});

describe("T08 HASH-01 — POST /api/admin/upload-audio persiste sha256", () => {
  it("crea la fila MediaAsset con sha256 igual al hash del binario subido", async () => {
    const before = await getContentVersion();
    const name = `t08-${Date.now()}-${seq++}.mp3`;
    const res = await POST_UPLOAD_AUDIO(
      fileReq("http://x/api/admin/upload-audio", new File([MP3_BYTES as unknown as BlobPart], name, { type: "audio/mpeg" }))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const row = await testDb().mediaAsset.findUnique({ where: { objectKey: body.objectKey } });
    expect(row).not.toBeNull();
    expect(row?.sha256).toBe(sha256Of(MP3_BYTES));
    expect(row?.sha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });
});

describe("T08 HASH-01 — POST /api/admin/upload-image persiste sha256", () => {
  it("crea la fila MediaAsset con sha256 igual al hash del binario subido", async () => {
    const before = await getContentVersion();
    const name = `t08-${Date.now()}-${seq++}.png`;
    const res = await POST_UPLOAD_IMAGE(
      fileReq("http://x/api/admin/upload-image", new File([PNG_BYTES as unknown as BlobPart], name, { type: "image/png" }))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const row = await testDb().mediaAsset.findUnique({ where: { objectKey: body.objectKey } });
    expect(row).not.toBeNull();
    expect(row?.sha256).toBe(sha256Of(PNG_BYTES));
    expect(row?.sha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });
});

describe("T09 HASH-02 — backfill idempotente + reporte de huérfanos", () => {
  const A_BYTES = Buffer.from(MP3_BYTES);
  const L_BYTES = Buffer.from([...PNG_BYTES, 9, 9, 9]);

  function fakeFetch(store: Map<string, Buffer>) {
    return async (objectKey: string): Promise<Buffer | null> => store.get(objectKey) ?? null;
  }

  it("primera corrida completa sha256, crea legacy existente y reporta faltantes; segunda corrida = 0 writes", async () => {
    await testDb().mediaAsset.create({
      data: { objectKey: "audios/t08-bf/a.mp3", filename: "a.mp3", mimeType: "audio/mpeg", size: A_BYTES.length },
    });
    await testDb().mediaAsset.create({
      data: { objectKey: "audios/t08-bf/missing.mp3", filename: "missing.mp3", mimeType: "audio/mpeg", size: 10 },
    });
    await testDb().dictionaryWord.create({
      data: { spanish: "t08-bf-legacy", nasaYuwe: "ny", status: "DRAFT", audioUrl: "https://cdn.test/audios/t08-bf/legacy.mp3" },
    });
    await testDb().dictionaryWord.create({
      data: { spanish: "t08-bf-ghost", nasaYuwe: "ny", status: "DRAFT", audioUrl: "https://cdn.test/audios/t08-bf/ghost.mp3" },
    });
    const store = new Map<string, Buffer>([
      ["audios/t08-bf/a.mp3", A_BYTES],
      ["audios/t08-bf/legacy.mp3", L_BYTES],
    ]);

    const first = await backfillMediaSha256({ db: testDb(), fetchBytes: fakeFetch(store) });

    // Fila sin hash completada con el hash de los bytes de R2.
    expect(first.updated).toBe(1);
    await expect(
      testDb().mediaAsset.findUnique({ where: { objectKey: "audios/t08-bf/a.mp3" } })
    ).resolves.toMatchObject({ sha256: sha256Of(MP3_BYTES) });
    // Legacy con objeto existente → fila creada con hash + MIME por firma.
    expect(first.legacyCreated).toEqual(["audios/t08-bf/legacy.mp3"]);
    await expect(
      testDb().mediaAsset.findUnique({ where: { objectKey: "audios/t08-bf/legacy.mp3" } })
    ).resolves.toMatchObject({ sha256: sha256Of(L_BYTES), filename: "legacy.mp3" });
    // Faltantes reportados sin fallar ni borrar.
    expect(first.missingInR2).toContainEqual(
      expect.objectContaining({ objectKey: "audios/t08-bf/missing.mp3" })
    );
    expect(first.legacyMissing).toContain("https://cdn.test/audios/t08-bf/ghost.mp3");
    await expect(
      testDb().mediaAsset.findUnique({ where: { objectKey: "audios/t08-bf/missing.mp3" } })
    ).resolves.not.toBeNull();

    const second = await backfillMediaSha256({ db: testDb(), fetchBytes: fakeFetch(store) });
    expect(second.updated).toBe(0);
    expect(second.legacyCreated).toEqual([]);
  });
});

describe("T08 HASH-01 — POST /api/dictionary/update-audio registra medios R2", () => {
  it("sobre objeto R2 existente crea la fila con el hash de los bytes descargados", async () => {
    await testDb().dictionaryWord.create({
      data: { spanish: "t08-palabra", nasaYuwe: "ny", status: "DRAFT" },
    });
    mockGetObjectBytes.mockResolvedValue(Buffer.from(MP3_BYTES));

    const before = await getContentVersion();
    const res = await POST_UPDATE_AUDIO(
      jsonReq("http://x/api/dictionary/update-audio", {
        audioMap: { "t08-palabra": "https://cdn.test/audios/t08/x.mp3" },
      }) as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mediaUpserted).toContain("audios/t08/x.mp3");

    const row = await testDb().mediaAsset.findUnique({ where: { objectKey: "audios/t08/x.mp3" } });
    expect(row).not.toBeNull();
    expect(row?.sha256).toBe(sha256Of(MP3_BYTES));
    expect(mockGetObjectBytes).toHaveBeenCalledWith("audios/t08/x.mp3");
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("sobre rutas locales /audio/*.wav no crea fila, no bloquea y reporta fuera de inventario", async () => {
    await testDb().dictionaryWord.create({
      data: { spanish: "agua", nasaYuwe: "ny", status: "DRAFT" },
    });

    const before = await getContentVersion();
    const res = await POST_UPDATE_AUDIO();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.length).toBe(9);
    // E6: locales sin objeto R2 → fuera de inventario, sin fila, sin bloquear.
    expect(body.outOfInventory).toContain("/audio/wala.wav");
    expect(mockGetObjectBytes).not.toHaveBeenCalled();
    const rows = await testDb().mediaAsset.findMany({ where: { objectKey: { contains: "t08" } } });
    expect(rows).toHaveLength(0);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });
});
