/**
 * Bloqueo por intentos fallidos de login (CA-22).
 *
 * 5 fallos por cuenta+IP → bloqueo 15 min. Respuesta indistinguible del
 * fallo normal (el caller devuelve null en ambos casos: anti-enumeración).
 *
 * En memoria, como el rate-limit: aproximado bajo múltiples instancias
 * serverless (ver riesgo R-03 del SDD). El éxito limpia el contador.
 */

const MAX_FAILURES = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_KEYS = 10_000;

const failures = new Map<string, number[]>();

export function lockoutKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}\n${ip || "unknown"}`;
}

function prune(key: string, now: number): number[] {
  const cutoff = now - LOCK_WINDOW_MS;
  let hits = failures.get(key);
  if (!hits) {
    hits = [];
    failures.set(key, hits);
    if (failures.size > MAX_KEYS) {
      const oldest = failures.keys().next().value;
      if (oldest !== undefined) failures.delete(oldest);
    }
    return hits;
  }
  let freshFrom = 0;
  while (freshFrom < hits.length && hits[freshFrom]! <= cutoff) freshFrom++;
  if (freshFrom > 0) hits.splice(0, freshFrom);
  return hits;
}

/** ¿La cuenta+IP está bloqueada ahora? (no registra nada) */
export function isLoginLocked(
  email: string,
  ip: string,
  now: number = Date.now()
): boolean {
  return prune(lockoutKey(email, ip), now).length >= MAX_FAILURES;
}

/** Registra un intento fallido. */
export function recordLoginFailure(
  email: string,
  ip: string,
  now: number = Date.now()
): void {
  prune(lockoutKey(email, ip), now).push(now);
}

/** Limpia el contador tras un login exitoso. */
export function resetLoginAttempts(email: string, ip: string): void {
  failures.delete(lockoutKey(email, ip));
}

/** Solo tests. */
export function __resetLoginLockoutStore(): void {
  failures.clear();
}

/**
 * IP del segundo argumento de `authorize(credentials, req)`.
 * En App Router es un Request-like; defensivo ante Headers u objeto plano.
 */
export function getAuthorizeIp(
  req: unknown
): string {
  try {
    const headers = (req as { headers?: unknown } | null)?.headers;
    if (!headers) return "unknown";
    const get =
      typeof (headers as { get?: unknown }).get === "function"
        ? (headers as { get: (n: string) => string | null }).get.bind(headers)
        : (n: string) =>
            (headers as Record<string, string | undefined>)[n] ?? null;
    const forwarded = get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
    const realIp = get("x-real-ip")?.trim();
    if (realIp) return realIp;
  } catch {
    // caer al fallback
  }
  return "unknown";
}
