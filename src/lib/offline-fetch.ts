/**
 * offlineFetch: red → snapshot IndexedDB → vacío. Nunca lanza (salvo abort):
 * si la red falla (p. ej. el 503 offline del SW) se sirve el snapshot
 * guardado por una visita anterior; si no hay nada, `empty` y la UI muestra
 * su estado vacío junto al banner global "Sin conexión".
 */

export type OfflineSource = "network" | "snapshot" | "empty"

export interface SnapshotStore<T> {
  read: () => Promise<T | null>
  write: (data: T) => Promise<void>
}

function isAbort(err: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) return true
  return err instanceof DOMException && err.name === "AbortError"
}

export async function offlineFetch<T>(
  input: string,
  init: RequestInit | undefined,
  store: SnapshotStore<T>,
  empty: T
): Promise<{ data: T; source: OfflineSource }> {
  try {
    const res = await fetch(input, init)
    if (res.ok) {
      try {
        const data = (await res.json()) as T
        try {
          await store.write(data)
        } catch {
          // Snapshot best-effort: la red ya respondió bien.
        }
        return { data, source: "network" }
      } catch {
        // JSON roto: caer al snapshot como si fuera fallo de red.
      }
    }
  } catch (err) {
    if (isAbort(err, init?.signal as AbortSignal | null)) throw err
    // Red caída (incluido el 503 offline del SW): snapshot.
  }
  try {
    const snap = await store.read()
    if (snap !== null) return { data: snap, source: "snapshot" }
  } catch {
    // Snapshot ilegible: vacío.
  }
  if ((init?.signal as AbortSignal | null)?.aborted) {
    throw new DOMException("Aborted", "AbortError")
  }
  return { data: empty, source: "empty" }
}
