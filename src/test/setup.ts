import "@testing-library/jest-dom/vitest"

/**
 * Setup global de Vitest.
 *
 * Instala polyfills y mocks de entorno comunes a toda la suite:
 *  - `localStorage` en memoria (jsdom no lo expone de forma aislada).
 *  - `ResizeObserver`, `matchMedia`, `IntersectionObserver` (no están en jsdom).
 *  - `fetch` por defecto que devuelve `Response` vacía (los tests lo sobreescriben
 *    con `vi.mocked(fetch)` cuando lo necesitan).
 *  - Suprime los logs ruidosos de NextAuth en tests (`/api/auth/_log`).
 */

const store = new Map<string, string>()

Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size },
  },
  writable: true,
  configurable: true,
})

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
    root = null
    rootMargin = ""
    thresholds = []
  } as unknown as typeof IntersectionObserver
}

if (typeof globalThis.matchMedia === "undefined") {
  globalThis.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

if (typeof globalThis.fetch === "undefined") {
  globalThis.fetch = async () => new Response()
}

// NextAuth registra en `console.error` el intento de parsear `/api/auth/_log`;
// es ruido cosmético en tests y ensucia la salida. Se suprime aquí.
const originalError = console.error
console.error = (...args: unknown[]) => {
  const msg = args.map(String).join(" ")
  if (msg.includes("/api/auth/_log")) return
  originalError(...args)
}

// Aislar estado entre tests: limpiar localStorage en memoria antes de cada test
// (evita fugas de favoritos/historial entre archivos de test).
import { beforeEach } from "vitest"

beforeEach(() => {
  store.clear()
})
