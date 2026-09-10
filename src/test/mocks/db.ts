import { vi } from "vitest"

/**
 * Mock de la capa de datos (`@/lib/db`).
 *
 * Centraliza la superficie completa de Prisma en un único objeto, creado con
 * `vi.hoisted()` para que pueda ser usado dentro de `vi.mock(...)` (que se
 * ejecuta hoisteado antes que el resto del archivo de test).
 *
 * Uso en un archivo de test:
 *
 *   import { mockDb } from "@/test/mocks"
 *   vi.mock("@/lib/db", () => ({ db: mockDb }))
 *   import { db } from "@/lib/db"
 *   // ... db.dictionaryWord.findMany es ya un vi.fn()
 */

const model = (methods: string[]) =>
  Object.fromEntries(methods.map((m) => [m, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>

export const mockDb = vi.hoisted(() => {
  return {
    dictionaryWord: model([
      "findMany",
      "findUnique",
      "findFirst",
      "create",
      "update",
      "delete",
      "count",
      "updateMany",
      "upsert",
    ]),
    user: model(["findMany", "findUnique", "create", "update", "delete", "count"]),
    favorite: model(["findMany", "findUnique", "findFirst", "create", "delete", "deleteMany", "count"]),
    viewHistory: model(["findMany", "findUnique", "upsert", "deleteMany", "count"]),
    searchHistory: model(["findMany", "findUnique", "create", "deleteMany", "count"]),
    auditLog: model(["findMany", "findUnique", "create", "count"]),
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn(),
  }
})

export type MockDb = typeof mockDb
