import { describe, it, expect, beforeEach } from "vitest"
import "fake-indexeddb/auto"
import { storeWords, searchLocalWords } from "./local-db"
import type { DictionaryWord } from "./local-db"

/**
 * RNF-01: la búsqueda local debe resolver en < 150 ms con el diccionario
 * completo (10.000 palabras) en un navegador real.
 *
 * Medido en jsdom + fake-indexeddb (más lento que un IndexedDB real): avg
 * ~135 ms / máx ~155 ms para el peor caso (query que fuerza el scan completo).
 * El umbral de 250 ms deja margen para la sobrecarga del entorno de test y de
 * CI, y sirve como guardia de regresión contra algoritmos O(n²) o scans
 * duplicados. El target de producto (150 ms) se valida en dispositivo real.
 *
 * El benchmark corre SIN instrumentación de coverage: v8 infla los tiempos
 * ~2.4x (135 ms → 321 ms) y rompe el umbral. El script `test:coverage` setea
 * PIYAAK_COVERAGE=1 y acá se saltea; el `test:run` normal sí lo ejecuta.
 */

const skipUnderCoverage = process.env.PIYAAK_COVERAGE === "1"

const DB_NAME = "NasaYuweDictionary"
const WORD_COUNT = 10_000

function makeWords(n: number): DictionaryWord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    spanish: `palabra${i}`,
    nasaYuwe: `nasa${i}`,
    pronunciation: null,
    category: "sustantivo",
    culturalContext: null,
  }))
}

async function deleteTestDB() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

describe("rendimiento de búsqueda local (RNF-01)", () => {
  beforeEach(async () => {
    await deleteTestDB()
  })

  it.skipIf(skipUnderCoverage)(
    `buscar en ${WORD_COUNT} palabras resuelve por debajo del umbral (promedio)`,
    async () => {
      await storeWords(makeWords(WORD_COUNT))

      // Warmup: la primera apertura de la DB y el primer cursor pagán el costo frío.
      await searchLocalWords("palabra9999")

      const times: number[] = []
      for (let i = 0; i < 20; i++) {
        const t0 = performance.now()
        const results = await searchLocalWords("palabra9999")
        times.push(performance.now() - t0)
        expect(results.length).toBeGreaterThan(0)
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length
      const max = Math.max(...times)
      // eslint-disable-next-line no-console
      console.log(`[RNF-01] search avg=${avg.toFixed(1)}ms max=${max.toFixed(1)}ms`)

      expect(avg).toBeLessThan(250)
    },
    120_000,
  )

  it.skipIf(skipUnderCoverage)(
    "buscar una palabra al inicio también resuelve rápido",
    async () => {
      await storeWords(makeWords(WORD_COUNT))
      await searchLocalWords("palabra1")

      const t0 = performance.now()
      const results = await searchLocalWords("palabra1")
      const elapsed = performance.now() - t0

      expect(results.some((w) => w.spanish === "palabra1")).toBe(true)
      expect(elapsed).toBeLessThan(250)
    },
    120_000,
  )
})