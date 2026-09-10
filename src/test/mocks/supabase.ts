import { vi } from "vitest"

/**
 * Mock de Supabase server (`@/lib/supabase-server`).
 *
 * Uso típico:
 *
 *   import { mockSupabaseServer, installSupabaseMock } from "@/test/mocks"
 *   installSupabaseMock()
 *   // ... mockSupabaseServer.getSupabaseServer es un vi.fn()
 *   //               mockSupabaseServer.upload / .createSignedUrl / .remove ...
 */

export const mockSupabase = vi.hoisted(() => {
  const upload = vi.fn()
  const createSignedUrl = vi.fn()
  const remove = vi.fn()

  const storageFrom = vi.fn(() => ({ upload, createSignedUrl, remove }))
  const getSupabaseServer = vi.fn(() => ({
    storage: { from: storageFrom },
    auth: { admin: {} },
  }))

  return {
    getSupabaseServer,
    storageFrom,
    upload,
    createSignedUrl,
    remove,
    AUDIO_BUCKET: "audios",
    audioObjectPath: vi.fn((wordId: string, file: string) => `${wordId}/${file}`),
    signedUrlToObjectPath: vi.fn(),
  }
})

export function installSupabaseMock() {
  vi.mock("@/lib/supabase-server", () => ({
    getSupabaseServer: mockSupabase.getSupabaseServer,
    AUDIO_BUCKET: mockSupabase.AUDIO_BUCKET,
    audioObjectPath: mockSupabase.audioObjectPath,
    signedUrlToObjectPath: mockSupabase.signedUrlToObjectPath,
  }))
}
