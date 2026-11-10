import { timingSafeEqual } from "node:crypto"

/**
 * Autenticación de la semilla CI (`GET /api/sync/full`, Fase B W3a).
 *
 * Un solo consumidor (GitHub Actions, Fase C) con clave compartida por
 * encabezado `X-CI-Secret`. Falla cerrado: sin `CI_SYNC_SECRET` configurado
 * toda validación retorna `false` y la ruta responde 401.
 *
 * Sin rate-limit en esta ruta por decisión documentada (spec §3.1): un solo
 * consumidor, IP compartida de runners (un límite por IP sería denegación
 * agregada) y ausencia de caché que impida absorber picos. Sin logs de
 * valores recibidos ni esperados, en ningún nivel.
 */

/** Secreto esperado; `null` si no configurado (falla cerrado). */
export function expectedCiSecret(): string | null {
  const value = process.env.CI_SYNC_SECRET
  if (!value) return null
  return value
}

/** Comparación en tiempo constante con resguardo de longitud. */
export function isValidCiSecret(provided: string | null | undefined): boolean {
  const expected = expectedCiSecret()
  if (!expected) return false
  if (typeof provided !== "string" || provided.length === 0) return false
  // `timingSafeEqual` lanza con longitudes distintas: el resguardo es
  // obligatorio. Comparar longitudes no filtra información útil (la longitud
  // del secreto no es el secreto).
  if (provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

/** 401 genérico: idéntico con y sin encabezado (sin oráculo). */
export function ciUnauthorized(): Response {
  return Response.json(
    { message: "No autorizado" },
    { status: 401, headers: { "Cache-Control": "private, no-store" } }
  )
}
