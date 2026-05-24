import { describe, it, expect, beforeEach } from "vitest"
import "fake-indexeddb/auto"
import {
  storeWords,
  getAllLocalWords,
  searchLocalWords,
  getLocalWord,
  getLocalDBStats,
  getLastSync,
  setLastSync,
  clearLocalDB,
  getCachedWordOfDay,
  setCachedWordOfDay,
  isLocalDBReady,
  getNormalizedInitial,
} from "./local-db"
import type { DictionaryWord, CachedWordOfDay } from "./local-db"

const DB_NAME = "NasaYuweDictionary"
const wordA: DictionaryWord = {
  id: "1",
  spanish: "casa",
  nasaYuwe: "ya:t",
  pronunciation: "yaat",
  category: "sustantivo",
  culturalContext: "Vivienda tradicional",
}

const wordB: DictionaryWord = {
  id: "2",
  spanish: "sol",
  nasaYuwe: "kiwe",
  pronunciation: "kiwe",
  category: "sustantivo",
  culturalContext: "Astro rey",
}

const wordC: DictionaryWord = {
  id: "3",
  spanish: "árbol",
  nasaYuwe: "yu'",
  pronunciation: "yu",
  category: "sustantivo",
  culturalContext: "Ser espiritual",
}

async function deleteTestDB() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

beforeEach(async () => {
  await deleteTestDB()
})

describe("storeWords", () => {
  it("stores words and retrieves them", async () => {
    await storeWords([wordA, wordB])
    const all = await getAllLocalWords()
    expect(all).toHaveLength(2)
    expect(all.find((w) => w.id === "1")?.spanish).toBe("casa")
  })

  it("overwrites existing word with same ID", async () => {
    await storeWords([wordA])
    const modified = { ...wordA, spanish: "hogar" }
    await storeWords([modified])
    const all = await getAllLocalWords()
    expect(all).toHaveLength(1)
    expect(all[0].spanish).toBe("hogar")
  })

  it("handles empty array", async () => {
    await expect(storeWords([])).resolves.toBeUndefined()
    const all = await getAllLocalWords()
    expect(all).toHaveLength(0)
  })
})

describe("getAllLocalWords", () => {
  it("returns empty array when no words stored", async () => {
    const all = await getAllLocalWords()
    expect(all).toEqual([])
  })

  it("returns all stored words", async () => {
    await storeWords([wordA, wordB, wordC])
    const all = await getAllLocalWords()
    expect(all).toHaveLength(3)
  })
})

describe("getLocalWord", () => {
  it("returns word by ID", async () => {
    await storeWords([wordA, wordB])
    const result = await getLocalWord("1")
    expect(result).not.toBeNull()
    expect(result!.spanish).toBe("casa")
  })

  it("returns null for non-existing ID", async () => {
    await storeWords([wordA])
    const result = await getLocalWord("non-existent")
    expect(result).toBeNull()
  })

  it("returns null when DB is empty", async () => {
    const result = await getLocalWord("1")
    expect(result).toBeNull()
  })
})

describe("searchLocalWords", () => {
  beforeEach(async () => {
    await storeWords([wordA, wordB, wordC])
  })

  it("finds by spanish word", async () => {
    const results = await searchLocalWords("casa")
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("1")
  })

  it("finds by nasaYuwe word", async () => {
    const results = await searchLocalWords("ya:t")
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("1")
  })

  it("is case insensitive", async () => {
    const results = await searchLocalWords("CASA")
    expect(results).toHaveLength(1)
  })

  it("finds partial matches", async () => {
    const results = await searchLocalWords("cas")
    expect(results).toHaveLength(1)
  })

  it("finds matches with accent in the query", async () => {
    const results = await searchLocalWords("árbol")
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("3")
  })

  it("returns empty array for empty query without opening DB", async () => {
    const results = await searchLocalWords("")
    expect(results).toEqual([])
  })

  it("returns empty array for whitespace-only query", async () => {
    const results = await searchLocalWords("   ")
    expect(results).toEqual([])
  })

  it("returns empty array when no matches", async () => {
    const results = await searchLocalWords("xyzxyz")
    expect(results).toEqual([])
  })

  it("respects limit parameter", async () => {
    await storeWords([{ ...wordA, id: "4" }, { ...wordA, id: "5" }, { ...wordA, id: "6" }])
    const results = await searchLocalWords("casa", 2)
    expect(results).toHaveLength(2)
  })

  it("searches across both spanish and nasaYuwe", async () => {
    const results = await searchLocalWords("kiwe")
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("2")
  })
})

describe("getLocalDBStats", () => {
  it("returns zero count when empty", async () => {
    const stats = await getLocalDBStats()
    expect(stats.wordCount).toBe(0)
    expect(stats.lastSync).toBeNull()
  })

  it("returns correct word count", async () => {
    await storeWords([wordA, wordB])
    const stats = await getLocalDBStats()
    expect(stats.wordCount).toBe(2)
  })
})

describe("lastSync", () => {
  it("setLastSync then getLastSync returns same value", async () => {
    const ts = "2026-05-24T10:00:00.000Z"
    await setLastSync(ts)
    const result = await getLastSync()
    expect(result).toBe(ts)
  })

  it("getLastSync returns null when never set", async () => {
    const result = await getLastSync()
    expect(result).toBeNull()
  })

  it("overwrites previous value", async () => {
    await setLastSync("old")
    await setLastSync("new")
    const result = await getLastSync()
    expect(result).toBe("new")
  })
})

describe("clearLocalDB", () => {
  it("clears all words and metadata", async () => {
    await storeWords([wordA, wordB])
    await setLastSync("2026-05-24")

    await clearLocalDB()

    const all = await getAllLocalWords()
    expect(all).toHaveLength(0)

    const sync = await getLastSync()
    expect(sync).toBeNull()
  })

  it("works on already empty DB", async () => {
    await expect(clearLocalDB()).resolves.toBeUndefined()
  })
})

describe("word of day cache", () => {
  const cached: CachedWordOfDay = {
    word: {
      id: "1",
      spanish: "casa",
      nasaYuwe: "ya:t",
      pronunciation: "yaat",
      audioUrl: null,
      culturalContext: "Hogar",
      category: "sustantivo",
      examples: [{ spanish: "Mi casa", nasaYuwe: "ya:t" }],
    },
    date: "2026-05-24",
    cachedAt: "2026-05-24T10:00:00.000Z",
  }

  it("stores and retrieves word of day", async () => {
    await setCachedWordOfDay(cached)
    const result = await getCachedWordOfDay()
    expect(result).not.toBeNull()
    expect(result!.date).toBe("2026-05-24")
    expect(result!.word.spanish).toBe("casa")
  })

  it("returns null when not cached", async () => {
    const result = await getCachedWordOfDay()
    expect(result).toBeNull()
  })

  it("overwrites existing cache", async () => {
    await setCachedWordOfDay(cached)
    const updated = { ...cached, date: "2026-05-25" }
    await setCachedWordOfDay(updated)
    const result = await getCachedWordOfDay()
    expect(result!.date).toBe("2026-05-25")
  })
})

describe("isLocalDBReady", () => {
  it("returns false when no words stored", async () => {
    expect(await isLocalDBReady()).toBe(false)
  })

  it("returns true when words exist", async () => {
    await storeWords([wordA])
    expect(await isLocalDBReady()).toBe(true)
  })

  it("returns false after clear", async () => {
    await storeWords([wordA, wordB])
    await clearLocalDB()
    expect(await isLocalDBReady()).toBe(false)
  })
})

describe("getNormalizedInitial", () => {
  it("returns uppercase for normal letters", () => {
    expect(getNormalizedInitial("casa")).toBe("C")
  })

  it("handles Ñ as N", () => {
    expect(getNormalizedInitial("ñandú")).toBe("N")
  })

  it("strips accents from vowels", () => {
    expect(getNormalizedInitial("árbol")).toBe("A")
    expect(getNormalizedInitial("éxito")).toBe("E")
    expect(getNormalizedInitial("ícono")).toBe("I")
    expect(getNormalizedInitial("óleo")).toBe("O")
    expect(getNormalizedInitial("último")).toBe("U")
  })

  it("handles Ü as U", () => {
    expect(getNormalizedInitial("ü")).toBe("U")
  })

  it("returns # for empty string", () => {
    expect(getNormalizedInitial("")).toBe("#")
  })

  it("returns # for null", () => {
    expect(getNormalizedInitial(null as unknown as string)).toBe("#")
  })
})
