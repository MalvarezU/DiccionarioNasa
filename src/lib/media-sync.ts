/**
 * Descarga masiva de medios (audios + ilustraciones) para uso offline.
 *
 * Diseño anti-saturación (ver media-sync.test.ts para los contratos):
 * - Filtra lo ya-cacheado (cache.match): el resume de una descarga
 *   interrumpida es casi gratis (no re-descarga lo que ya está).
 * - Concurrencia baja (default 2): mobile-friendly, no satura R2 ni
 *   el pool de conexiones del navegador (max ~6 por origen).
 * - Timeout por ítem (default 15s): un medio colgado no congela el sync.
 * - Pausa entre batches (default 500ms cada 4): respira la red.
 * - Sin retry en bulk: 1 fallo → skip. El cache-first on-demand del SW
 *   lo reintenta naturalmente cuando el usuario abre esa ficha.
 * - Abortable: AbortSignal del llamador (unload, offline, cancel).
 * - Progreso throttled (default 100ms): no dispara re-render por ítem.
 *
 * Importante: los medios viven en R2 (Cloudflare CDN), NO en Hostinger.
 * Esta descarga no agrega carga al servidor de la app.
 *
 * El guardado en caché lo hace el Service Worker (isCacheable acepta
 * respuestas opacas de no-cors): este módulo solo dispara el fetch para
 * que el SW lo intercepte y guarde.
 */

export interface MediaSyncOptions {
  /** Descargas simultáneas. Default 2. */
  concurrency?: number
  /** Timeout por ítem en ms. Default 15000. */
  timeoutMs?: number
  /** Pausa entre batches de `batchSize` ítems. Default 500ms cada 4. */
  batchPauseMs?: number
  batchSize?: number
  /** Throttle del callback onProgress. Default 100ms. */
  progressThrottleMs?: number
  /** Señal externa para abortar (unload, offline, cancel). */
  signal?: AbortSignal
  /** Progreso: (completados, total, saltados-por-caché). */
  onProgress?: (done: number, total: number, skipped: number) => void
}

export interface MediaSyncResult {
  /** Total de URLs encoladas. */
  total: number
  /** Descargadas OK en esta corrida. */
  downloaded: number
  /** Ya estaban en caché (skip). */
  skippedCached: number
  /** Fallaron (timeout, red): quedan para on-demand. */
  failed: number
}

/** Un medio fallido no rompe el sync: queda para on-demand. */
const MEDIA_ERR = Symbol("media-sync-error")

async function isUrlCached(url: string): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false
    const keys = await caches.keys()
    for (const name of keys) {
      const cache = await caches.open(name)
      if (await cache.match(url)) return true
    }
    return false
  } catch {
    return false
  }
}

// Nombres de cache compartidos con public/sw.js (NO cambiarlos sin sincronizar
// ambos archivos): el sync guarda acá y el SW sirve offline desde acá.
const AUDIO_CACHE_NAME = "piiyaak-audio-v1"
const IMAGE_CACHE_NAME = "piiyaak-image-v1"

function cacheNameForUrl(url: string): string {
  return /\.(mp3|wav|ogg)(\?|$)/i.test(url) ? AUDIO_CACHE_NAME : IMAGE_CACHE_NAME
}

async function fetchOne(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<"ok" | typeof MEDIA_ERR> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)

  // Propagar abort externo al interno
  const onOuterAbort = () => ctrl.abort()
  signal?.addEventListener("abort", onOuterAbort, { once: true })

  try {
    // no-cors: R2 responde opaco sin importar CORS; el SW lo cachea igual.
    // cache: "reload" evita contar como "descargado" algo que solo quedó
    // en el HTTP cache del navegador y se evapora.
    const res = await fetch(url, { mode: "no-cors", cache: "reload", signal: ctrl.signal })
    // Cacheo explícito (además del SW): hace el sync determinista aunque el
    // SW aún no esté controlando la página. Guardar responses opacas en la
    // Cache API es legal y jugable offline.
    try {
      if (typeof caches !== "undefined") {
        const cache = await caches.open(cacheNameForUrl(url))
        await cache.put(url, res.clone())
      }
    } catch {
      // Si el cacheo falla, el SW (si está activo) puede haberlo cacheado
      // igual por su handler; no rompemos el sync por esto.
    }
    return "ok"
  } catch {
    return MEDIA_ERR
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onOuterAbort)
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      resolve()
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

/**
 * Cola de descarga con backpressure. Recibe URLs únicas (el llamador
 * deduplica), devuelve estadísticas de la corrida. Nunca lanza: los
 * fallos se reportan en `result.failed`.
 */
export async function downloadMediaQueue(
  urls: string[],
  opts: MediaSyncOptions = {}
): Promise<MediaSyncResult> {
  const {
    concurrency = 2,
    timeoutMs = 15_000,
    batchPauseMs = 500,
    batchSize = 4,
    progressThrottleMs = 100,
    signal,
    onProgress,
  } = opts

  const total = urls.length
  if (total === 0) {
    onProgress?.(0, 0, 0)
    return { total: 0, downloaded: 0, skippedCached: 0, failed: 0 }
  }

  let downloaded = 0
  let skippedCached = 0
  let failed = 0
  let completed = 0

  // Throttle del progreso: máx 1 callback cada N ms (+ reportes forzados).
  let lastProgressAt = 0
  const reportProgress = (force = false) => {
    const now = Date.now()
    if (force || now - lastProgressAt >= progressThrottleMs) {
      lastProgressAt = now
      onProgress?.(completed, total, skippedCached)
    }
  }

  reportProgress(true)

  // Puntero compartido por los workers + pausa global por batch.
  let nextIdx = 0
  let sinceLastPause = 0
  let stopped = false

  async function worker(): Promise<void> {
    while (!signal?.aborted && !stopped) {
      const i = nextIdx++
      if (i >= total) return
      const url = urls[i]

      // 1. Skip si ya está en caché (resume barato)
      if (await isUrlCached(url)) {
        skippedCached++
        completed++
        reportProgress()
        continue
      }

      // 2. Descargar con timeout
      const res = await fetchOne(url, timeoutMs, signal)
      if (signal?.aborted || stopped) {
        // Abort externo: cortar a todos sin contar este ítem
        stopped = true
        return
      }
      if (res === "ok") {
        downloaded++
      } else {
        failed++
      }
      completed++
      reportProgress()

      // 3. Pausa cada batchSize descargas (respiro para la red)
      sinceLastPause++
      if (sinceLastPause >= batchSize) {
        sinceLastPause = 0
        await sleep(batchPauseMs, signal)
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, total))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  reportProgress(true)
  return { total, downloaded, skippedCached, failed }
}

/**
 * Extrae las URLs únicas de medios de una lista de palabras.
 * Acepta http(s) (R2/prod), rutas relativas con extensión de media y el
 * redirect legacy `/api/media/<id>` (302 a R2, sin extensión).
 */
export function extractMediaUrls(
  words: Array<{ audioUrl?: string | null; illustrationUrl?: string | null }>
): string[] {
  const urls = new Set<string>()
  for (const w of words) {
    for (const u of [w.audioUrl, w.illustrationUrl]) {
      if (typeof u !== "string" || !u.trim()) continue
      const v = u.trim()
      // Aceptar URLs absolutas (R2/prod) y rutas relativas de mismo origen
      // con extensión de media (/audio/*.mp3, /images/*.png, etc.) para no
      // dejar medios sin cachear. Otras rutas relativas se ignoran.
      const isHttp = /^https?:\/\//i.test(v)
      const isMediaRel = /^\/.*\.(mp3|wav|ogg|png|jpe?g|webp|avif|gif)(\?|$)/i.test(v)
      const isApiMedia = v.startsWith("/api/media/")
      if (isHttp || isMediaRel || isApiMedia) {
        urls.add(v)
      }
    }
  }
  return [...urls]
}
