/**
 * Matching de archivos para subida masiva de ilustraciones (Fase 3).
 *
 * Regla: el nombre del archivo (sin extensión) debe coincidir con el español
 * o el nasa yuwe de EXACTAMENTE una palabra, tras normalizar (minúsculas +
 * sin diacríticos, igual que el buscador). 0 ó 2+ coincidencias → sin match,
 * nunca se adivina.
 */

export type WordRef = { id: string; spanish: string; nasaYuwe: string }
export type FileRef = { name: string }

export type BulkMatch = { file: FileRef; wordId: string; wordLabel: string }
export type BulkUnmatched = { file: FileRef; reason: "sin coincidencia" | "ambiguo" }

function normalizeStem(name: string): string {
  const dot = name.lastIndexOf(".")
  const stem = (dot === -1 ? name : name.slice(0, dot)).trim()
  return (
    stem
      // Los archivos suelen usar -/_ donde la palabra lleva espacios
      .replace(/[-_]+/g, " ")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
  )
}

export function matchIllustrationFiles(
  files: FileRef[],
  words: WordRef[]
): { matched: BulkMatch[]; unmatched: BulkUnmatched[] } {
  const index = new Map<string, WordRef[]>()
  for (const w of words) {
    for (const label of [w.spanish, w.nasaYuwe]) {
      const key = normalizeStem(label)
      if (!key) continue
      const list = index.get(key) ?? []
      if (!list.some((x) => x.id === w.id)) list.push(w)
      index.set(key, list)
    }
  }

  const matched: BulkMatch[] = []
  const unmatched: BulkUnmatched[] = []
  for (const file of files) {
    const key = normalizeStem(file.name)
    const candidates = key ? (index.get(key) ?? []) : []
    if (candidates.length === 1) {
      const word = candidates[0]!
      matched.push({ file, wordId: word.id, wordLabel: `${word.spanish} / ${word.nasaYuwe}` })
    } else {
      unmatched.push({
        file,
        reason: candidates.length === 0 ? "sin coincidencia" : "ambiguo",
      })
    }
  }
  return { matched, unmatched }
}
