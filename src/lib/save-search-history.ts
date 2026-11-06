/**
 * Guarda una búsqueda en el historial del servidor (fase 2 Mi espacio).
 *
 * Fire-and-forget a propósito: nunca bloquea la UI ni muestra errores.
 * Pensado para llamarse al buscar con Enter o al abrir un resultado del
 * diccionario, NUNCA por tecla (el servidor limita a 5/min por IP).
 */
export function saveSearchHistory(query: string): void {
  const normalized = query.trim().slice(0, 100);
  if (!normalized) return;

  try {
    const promise = fetch("/api/dictionary/search-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: normalized }),
      // La petición sobrevive si el usuario navega justo después de buscar.
      keepalive: true,
    });
    // Sin await: el guardado no retrasa la apertura del resultado.
    // El catch evita unhandledrejection en offline; el servidor ignora
    // duplicados/ruido por rate-limit.
    promise.catch(() => {});
  } catch {
    // fetch puede lanzar sincrónicamente en algunos entornos: ignorar.
  }
}
