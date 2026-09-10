/**
 * Fábricas de datos de prueba. Cada `make*` devuelve un objeto con valores
 * por defecto coherentes y permite sobreescribir campos.
 */

export interface Word {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  culturalContext: string | null
  category: string
  examples: string | null
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export function makeWord(overrides: Partial<Word> = {}): Word {
  const now = new Date().toISOString()
  return {
    id: "w1",
    spanish: "casa",
    nasaYuwe: "ya:t",
    pronunciation: "yaat",
    audioUrl: null,
    culturalContext: "Vivienda",
    category: "sustantivo",
    examples: null,
    status: "PUBLISHED",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "user@test.com",
    name: "User",
    role: "user",
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeAuditLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log1",
    action: "CREATE",
    entity: "DictionaryWord",
    entityId: "w1",
    changes: "{}",
    userId: "admin1",
    wordId: "w1",
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}
