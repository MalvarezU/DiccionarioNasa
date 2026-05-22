// ─── IndexedDB Configuration ───────────────────────────────────────────────

const DB_NAME = "NasaYuweDictionary"
const DB_VERSION = 1
const WORDS_STORE = "words"
const METADATA_STORE = "metadata"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DictionaryWord {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  category: string | null
  culturalContext: string | null
  examples?: string | null
  audioUrl?: string | null
}

export interface CachedWordOfDay {
  word: {
    id: string
    spanish: string
    nasaYuwe: string
    pronunciation: string | null
    audioUrl: string | null
    culturalContext: string | null
    category: string | null
    examples: Array<{ spanish: string; nasaYuwe: string }> | null
  }
  date: string
  cachedAt: string
}

interface LocalDBStats {
  wordCount: number
  lastSync: string | null
}

// ─── IndexedDB Helpers ──────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(WORDS_STORE)) {
        const wordsStore = db.createObjectStore(WORDS_STORE, { keyPath: "id" })
        wordsStore.createIndex("spanish", "spanish", { unique: false })
        wordsStore.createIndex("nasaYuwe", "nasaYuwe", { unique: false })
      }

      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "key" })
      }
    }
  })
}

async function withDB<T>(callback: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDB()
  try {
    return await callback(db)
  } finally {
    db.close()
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if the local DB has been initialized and contains words.
 */
export async function isLocalDBReady(): Promise<boolean> {
  try {
    return await withDB(async (db) => {
      const stats = await getLocalDBStats()
      return stats.wordCount > 0
    })
  } catch {
    return false
  }
}

/**
 * Get the normalized initial letter of a word for alphabetical grouping.
 * Handles Spanish alphabet and normalization (e.g., "Á" → "A", "ñ" → "N").
 */
export function getNormalizedInitial(word: string): string {
  if (!word) return "#"
  const firstChar = word.charAt(0).toUpperCase()
  const normalized = firstChar.normalize("NFD").replace(/[̀-ͯ]/g, "")
  if (normalized === "Ñ") return "N"
  if (normalized === "Á") return "A"
  if (normalized === "É") return "E"
  if (normalized === "Í") return "I"
  if (normalized === "Ó") return "O"
  if (normalized === "Ú") return "U"
  if (normalized === "Ü") return "U"
  return normalized
}

/**
 * Store an array of words in the local IndexedDB.
 * Overwrites existing words with the same ID.
 */
export async function storeWords(words: DictionaryWord[]): Promise<void> {
  await withDB(async (db) => {
    const tx = db.transaction(WORDS_STORE, "readwrite")
    const store = tx.objectStore(WORDS_STORE)

    await Promise.all(
      words.map(
        (word) =>
          new Promise<void>((resolve, reject) => {
            const request = store.put(word)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
          })
      )
    )

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  })
}

/**
 * Get all words from the local DB, sorted alphabetically by Spanish.
 */
export async function getAllLocalWords(): Promise<DictionaryWord[]> {
  return await withDB(async (db) => {
    const tx = db.transaction(WORDS_STORE, "readonly")
    const store = tx.objectStore(WORDS_STORE)
    const index = store.index("spanish")

    return await new Promise((resolve, reject) => {
      const request = index.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  })
}

/**
 * Get statistics about the local DB (word count and last sync timestamp).
 */
export async function getLocalDBStats(): Promise<LocalDBStats> {
  return await withDB(async (db) => {
    const wordsTx = db.transaction(WORDS_STORE, "readonly")
    const wordsStore = wordsTx.objectStore(WORDS_STORE)

    const wordCount = await new Promise<number>((resolve, reject) => {
      const request = wordsStore.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    const metaTx = db.transaction(METADATA_STORE, "readonly")
    const metaStore = metaTx.objectStore(METADATA_STORE)

    const lastSync = await new Promise<string | null>((resolve, reject) => {
      const request = metaStore.get("lastSync")
      request.onsuccess = () => resolve(request.result?.value ?? null)
      request.onerror = () => reject(request.error)
    })

    return { wordCount, lastSync }
  })
}

/**
 * Get the last sync timestamp from metadata.
 */
export async function getLastSync(): Promise<string | null> {
  try {
    return await withDB(async (db) => {
      const tx = db.transaction(METADATA_STORE, "readonly")
      const store = tx.objectStore(METADATA_STORE)

      return await new Promise<string | null>((resolve, reject) => {
        const request = store.get("lastSync")
        request.onsuccess = () => resolve(request.result?.value ?? null)
        request.onerror = () => reject(request.error)
      })
    })
  } catch {
    return null
  }
}

/**
 * Set the last sync timestamp in metadata.
 */
export async function setLastSync(timestamp: string): Promise<void> {
  await withDB(async (db) => {
    const tx = db.transaction(METADATA_STORE, "readwrite")
    const store = tx.objectStore(METADATA_STORE)

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key: "lastSync", value: timestamp })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  })
}

/**
 * Clear all data from the local DB (both words and metadata).
 */
export async function clearLocalDB(): Promise<void> {
  await withDB(async (db) => {
    const wordsTx = db.transaction(WORDS_STORE, "readwrite")
    const wordsStore = wordsTx.objectStore(WORDS_STORE)

    await new Promise<void>((resolve, reject) => {
      const request = wordsStore.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    await new Promise<void>((resolve, reject) => {
      wordsTx.oncomplete = () => resolve()
      wordsTx.onerror = () => reject(wordsTx.error)
    })

    const metaTx = db.transaction(METADATA_STORE, "readwrite")
    const metaStore = metaTx.objectStore(METADATA_STORE)

    await new Promise<void>((resolve, reject) => {
      const request = metaStore.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    await new Promise<void>((resolve, reject) => {
      metaTx.oncomplete = () => resolve()
      metaTx.onerror = () => reject(metaTx.error)
    })
  })
}

/**
 * Get the cached word of the day from metadata.
 */
export async function getCachedWordOfDay(): Promise<CachedWordOfDay | null> {
  try {
    return await withDB(async (db) => {
      const tx = db.transaction(METADATA_STORE, "readonly")
      const store = tx.objectStore(METADATA_STORE)

      return await new Promise<CachedWordOfDay | null>((resolve, reject) => {
        const request = store.get("wordOfDay")
        request.onsuccess = () => resolve(request.result?.value ?? null)
        request.onerror = () => reject(request.error)
      })
    })
  } catch {
    return null
  }
}

/**
 * Set the cached word of the day in metadata.
 */
export async function setCachedWordOfDay(data: CachedWordOfDay): Promise<void> {
  await withDB(async (db) => {
    const tx = db.transaction(METADATA_STORE, "readwrite")
    const store = tx.objectStore(METADATA_STORE)

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key: "wordOfDay", value: data })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  })
}

/**
 * Search for words in the local DB by query.
 * Matches against both Spanish and Nasa Yuwe text.
 */
export async function searchLocalWords(
  query: string,
  limit: number = 50
): Promise<DictionaryWord[]> {
  if (!query.trim()) {
    return []
  }

  const normalizedQuery = query.toLowerCase().trim()

  return await withDB(async (db) => {
    const tx = db.transaction(WORDS_STORE, "readonly")
    const store = tx.objectStore(WORDS_STORE)

    const results: DictionaryWord[] = []

    await new Promise<void>((resolve, reject) => {
      const request = store.openCursor()
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null
        if (cursor) {
          const word = cursor.value as DictionaryWord
          const matchesSpanish = word.spanish.toLowerCase().includes(normalizedQuery)
          const matchesNasaYuwe = word.nasaYuwe.toLowerCase().includes(normalizedQuery)

          if (matchesSpanish || matchesNasaYuwe) {
            results.push(word)
          }

          if (results.length >= limit) {
            resolve()
          } else {
            cursor.continue()
          }
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })

    return results
  })
}

/**
 * Get a single word by ID from the local DB.
 */
export async function getLocalWord(wordId: string): Promise<DictionaryWord | null> {
  try {
    return await withDB(async (db) => {
      const tx = db.transaction(WORDS_STORE, "readonly")
      const store = tx.objectStore(WORDS_STORE)

      return await new Promise<DictionaryWord | null>((resolve, reject) => {
        const request = store.get(wordId)
        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () => reject(request.error)
      })
    })
  } catch {
    return null
  }
}
