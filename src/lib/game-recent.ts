/**
 * Ring buffer de palabras servidas recientemente (variedad real entre
 * sesiones): los helpers de juego pasan `exclude=` a la API y guardan lo
 * servido aquí. Es compartido entre juegos: una palabra vista en cualquier
 * juego se aparta un rato en todos, así el repertorio rota en vez de
 * repetir el mismo grupo (el diccionario tiene cientos de palabras).
 */

/** Clave versionada: no cambiarla (los usuarios conservan su historial). */
const RECENT_KEY = "piiyaak:game:v1:recent"

/** Tamaño del buffer: 48 servidas recientes (≈2 tandas grandes de juego). */
export const RECENT_MAX = 48

/**
 * Ids servidos recientemente, del más reciente al más viejo. Tolera JSON
 * corrupto, valores no-array y entradas no-string (devuelve solo lo
 * válido). Sin `window` (SSR) devuelve vacío.
 */
export function recentWordIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : []
  } catch {
    return []
  }
}

/**
 * Registra ids servidos (más reciente primero) sin duplicar los ya
 * presentes y recortando a RECENT_MAX. Escritura a prueba de fallos: si el
 * almacenamiento está lleno/bloqueado solo se pierde variedad, nunca
 * funcionalidad.
 */
export function trackWordIds(ids: readonly string[]): void {
  if (typeof window === "undefined") return
  if (ids.length === 0) return
  try {
    const prev = recentWordIds()
    const seen = new Set(ids)
    const next = [...ids, ...prev.filter((id) => !seen.has(id))].slice(0, RECENT_MAX)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // almacenamiento lleno/bloqueado: solo pierde variedad, no funcionalidad
  }
}
