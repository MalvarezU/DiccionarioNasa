import { NextRequest } from "next/server"

/**
 * Helpers para construir `Request`/`NextRequest` de forma consistente en los
 * tests de rutas de API.
 */

/** `Request` con cuerpo JSON y el método indicado. */
export function jsonRequest(
  url: string,
  body: unknown,
  method = "POST"
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

/** `NextRequest` GET/POST contra una URL dada (sin cuerpo). */
export function urlRequest(url: string, method = "GET"): NextRequest {
  return new NextRequest(url, { method })
}

/**
 * Algunas rutas leen el cuerpo/URL desde un objeto plano (sin `NextRequest`).
 * Este helper construye el "request" mínimo con `json()` y `nextUrl`.
 */
export function plainRequest(body: unknown, path = "/api"): {
  json: () => Promise<unknown>
  nextUrl: URL
  [key: string]: unknown
} {
  return {
    json: async () => body,
    nextUrl: new URL(`http://localhost:3000${path}`),
  }
}
