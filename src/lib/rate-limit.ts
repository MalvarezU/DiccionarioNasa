import { NextResponse } from "next/server"

/**
 * Rate-limit en memoria (ventana deslizante por clave).
 *
 * Pensado para endpoints públicos de bajo volumen (suggest, register):
 * frena spam y fuerza bruta sin añadir infraestructura.
 *
 * Limitación conocida: el estado vive por instancia/edge. En Vercel con
 * múltiples instancias el límite es aproximado, no estricto. Si se necesita
 * estricto, migrar a Upstash Redis u otro store compartido.
 */

const buckets = new Map<string, number[]>()
const MAX_KEYS = 10_000

export interface RateLimitResult {
  allowed: boolean
  /** ms hasta que el cliente puede reintentar (0 si allowed) */
  retryAfterMs: number
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const cutoff = now - windowMs
  let hits = buckets.get(key)
  if (!hits) {
    hits = []
    buckets.set(key, hits)
    // Evitar crecimiento ilimitado: elimina la clave más antigua
    if (buckets.size > MAX_KEYS) {
      const oldest = buckets.keys().next().value
      if (oldest !== undefined) buckets.delete(oldest)
    }
  }

  // Purgar timestamps fuera de la ventana (in-place)
  let freshFrom = 0
  while (freshFrom < hits.length && hits[freshFrom]! <= cutoff) freshFrom++
  if (freshFrom > 0) hits.splice(0, freshFrom)

  if (hits.length >= limit) {
    const retryAfterMs = Math.max(0, hits[0]! + windowMs - now)
    return { allowed: false, retryAfterMs }
  }

  hits.push(now)
  return { allowed: true, retryAfterMs: 0 }
}

/**
 * Extrae la IP del cliente de forma defensiva (funciona con NextRequest
 * real y con objetos parciales en tests).
 */
export function getClientIp(request: {
  headers?: { get?: (name: string) => string | null } | null;
}): string {
  try {
    const forwarded = request.headers?.get?.("x-forwarded-for")
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim()
      if (first) return first
    }
    const realIp = request.headers?.get?.("x-real-ip")?.trim()
    if (realIp) return realIp
  } catch {
    // ignorar: caer al fallback
  }
  return "unknown"
}

export function rateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000))
  return NextResponse.json(
    { message: "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  )
}

/** Solo tests: vacía el store entre casos. */
export function __resetRateLimitStore(): void {
  buckets.clear()
}
