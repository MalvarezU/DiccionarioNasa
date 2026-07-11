import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parse the `examples` JSON string stored in DictionaryWord.
 * Seed data may contain invalid JSON (naive CSV split corrupts the field),
 * so this never throws — it returns null on parse failure.
 */
export function safeParseExamples(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
