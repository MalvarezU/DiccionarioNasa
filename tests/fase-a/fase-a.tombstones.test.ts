import "./test-db";
import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { GET as GET_SYNC } from "@/app/api/sync/route";
import { testDb, disconnectTestDb } from "./test-db";

/**
 * C2 — Tombstones paginados por keyset (plan fase-a-fixes, H3/W3).
 *
 * El `take: 5000` sin paginar truncaba silenciosamente los tombstones cuando
 * había más de 5000 DELETE en la ventana. Este test de volumen inserta 5001
 * AuditLog DELETE en UNA query batch (`createMany`) y exige que el sync
 * devuelva los 5001 en `removedIds`.
 *
 * Archivo propio (no extensión de `fase-a.sync-aditivo.test.ts`): el ciclo de
 * vida del fixture (5001 filas + limpieza en `finally`) y el costo del batch
 * no pertenecen a los asserts de contrato aditivo de T10; mezclarlos
 * ensuciaría el `afterEach` de T10 y ralentizaría todos sus casos.
 */

const session = {
  session: { user: { id: "u-tomb", name: "Tomb", email: "tomb@test", role: "editor" } },
  error: null,
} as never;

const PREFIX = `tomb-c2-${Date.now()}-`;
const VOLUME_N = 5001;

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue(session);
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("C2 — volumen de tombstones DELETE por encima del viejo tope 5000", () => {
  it("devuelve los 5001 removedIds sin truncar (UNA query batch, cleanup en finally)", async () => {
    const since = new Date(Date.now() - 60_000).toISOString();
    const rows = Array.from({ length: VOLUME_N }, (_, i) => ({
      action: "DELETE",
      entity: "DictionaryWord",
      entityId: `${PREFIX}${i}`,
    }));
    try {
      const batch = await testDb().auditLog.createMany({ data: rows });
      expect(batch.count).toBe(VOLUME_N);

      const res = await GET_SYNC(
        new Request(`http://x/api/sync?since=${encodeURIComponent(since)}`) as never
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      // Contrato intacto: mismas claves, solo puede traer MÁS removedIds.
      for (const key of ["words", "removedIds", "serverTime", "nextCursor", "contentVersion"]) {
        expect(body, `clave preexistente ausente: ${key}`).toHaveProperty(key);
      }
      const removed: string[] = body.removedIds;
      expect(removed.length).toBeGreaterThanOrEqual(VOLUME_N);
      const missing = rows.filter((r) => !removed.includes(r.entityId!));
      expect(missing, `tombstones truncados: faltan ${missing.length}`).toEqual([]);
    } finally {
      await testDb().auditLog.deleteMany({ where: { entityId: { startsWith: PREFIX } } });
    }
  }, 60_000);
});
