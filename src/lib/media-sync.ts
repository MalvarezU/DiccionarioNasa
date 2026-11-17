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
  /** Tope de bytes a descargar en esta corrida (los ya cacheados no suman). */
  budgetBytes?: number
  /** Estimación por URL para el control de presupuesto. Default estimateBytes. */
  estimateBytes?: (url: string) => number
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
  /** No intentadas por tope de presupuesto: quedan para on-demand/resume. */
  skippedBudget: number
}

/**
 * Presupuesto de medios auto-descargados (decision 50MB):
 * ~10MB audios (todos entran: 343 x ~25KB ≈ 8.4MB) + ~40MB ilustraciones
 * (~120 de ~333KB). Los topes de entradas son el respaldo duro cuando el
 * tamaño real es ilegible (opacos R2 sin CORS).
 */
export const MEDIA_BUDGET_BYTES = 50 * 1024 * 1024
export const AUDIO_BUDGET_BYTES = 10 * 1024 * 1024
export const IMAGE_BUDGET_BYTES = 40 * 1024 * 1024
export const AUDIO_ENTRY_CAP = 400
export const IMAGE_ENTRY_CAP = 120
const AUDIO_OPAQUE_BYTES = 25 * 1024
const IMAGE_OPAQUE_BYTES = 333 * 1024
const API_MEDIA_BYTES = 150 * 1024

const AUDIO_RE = /\.(mp3|wav|ogg)(\?|$)/i
const IMAGE_RE = /\.(png|jpe?g|webp|avif|gif)(\?|$)/i

/** Estimación de peso por URL (mediciones reales, ver presupuesto arriba). */
export function estimateBytes(url: string): number {
  if (AUDIO_RE.test(url)) return AUDIO_OPAQUE_BYTES
  if (IMAGE_RE.test(url)) return IMAGE_OPAQUE_BYTES
  return API_MEDIA_BYTES
}

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

function isSameOrigin(url: string): boolean {
  try {
    if (url.startsWith("/")) return true
    if (typeof location !== "undefined" && url.startsWith(location.origin)) return true
    return false
  } catch {
    return false
  }
}

async function fetchOne(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ ok: boolean; bytes: number }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)

  // Propagar abort externo al interno
  const onOuterAbort = () => ctrl.abort()
  signal?.addEventListener("abort", onOuterAbort, { once: true })

  // Mismo origen en modo cors: la respuesta es legible y trae
  // Content-Length real. Cross-origin (R2 sin CORS) sigue no-cors/opaco.
  const sameOrigin = isSameOrigin(url)
  const fallbackBytes = estimateBytes(url)

  try {
    // no-cors: R2 responde opaco sin importar CORS; el SW lo cachea igual.
    // cache: "reload" evita contar como "descargado" algo que solo quedó
    // en el HTTP cache del navegador y se evapora.
    const res = await fetch(url, {
      mode: sameOrigin ? "cors" : "no-cors",
      cache: "reload",
      signal: ctrl.signal,
    })
    let bytes = fallbackBytes
    if (sameOrigin) {
      try {
        const len = parseInt(res.headers.get("Content-Length") || "", 10)
        if (Number.isFinite(len) && len > 0) bytes = len
      } catch {
        // Header ilegible: vale la estimación.
      }
    }
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
    return { ok: true, bytes }
  } catch {
    return { ok: false, bytes: 0 }
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
    budgetBytes,
    estimateBytes: estimate = estimateBytes,
  } = opts

  const total = urls.length
  if (total === 0) {
    onProgress?.(0, 0, 0)
    return { total: 0, downloaded: 0, skippedCached: 0, failed: 0, skippedBudget: 0 }
  }

  let downloaded = 0
  let skippedCached = 0
  let failed = 0
  let skippedBudget = 0
  let completed = 0
  // Bytes ya comprometidos: lo descargado en esta corrida (real cuando es
  // legible, estimado si no) + lo que ya estaba en caché (estimado). Así el
  // tope se respeta aunque el resume encuentre medio trabajo hecho.
  let spentBytes = 0

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

  const overBudget = (url: string) =>
    budgetBytes !== undefined && spentBytes + estimate(url) > budgetBytes

  // Puntero compartido por los workers + pausa global por batch.
  let nextIdx = 0
  let sinceLastPause = 0
  let stopped = false

  async function worker(): Promise<void> {
    while (!signal?.aborted && !stopped) {
      const i = nextIdx++
      if (i >= total) return
      const url = urls[i]

      // 1. Skip si ya está en caché (resume barato): cuenta al presupuesto.
      if (await isUrlCached(url)) {
        skippedCached++
        spentBytes += estimate(url)
        completed++
        reportProgress()
        continue
      }

      // 2. Tope de presupuesto: no se intenta (queda para on-demand/resume).
      if (overBudget(url)) {
        skippedBudget++
        completed++
        reportProgress()
        continue
      }

      // 3. Descargar con timeout
      const res = await fetchOne(url, timeoutMs, signal)
      if (signal?.aborted || stopped) {
        // Abort externo: cortar a todos sin contar este ítem
        stopped = true
        return
      }
      if (res.ok) {
        downloaded++
        spentBytes += res.bytes
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
  return { total, downloaded, skippedCached, failed, skippedBudget }
}

/**
 * Extrae las URLs únicas de medios de una lista de palabras.
 * Acepta http(s) (R2/prod), rutas relativas con extensión de media y el
 * redirect legacy `/api/media/<id>` (302 a R2, sin extensión).
 */
export function extractMediaUrls(
  words: Array<{ audioUrl?: string | null; illustrationUrl?: string | null }>
): string[] {
  const { audios, illustrations } = extractMediaByKind(words)
  return [...audios, ...illustrations]
}

export interface MediaByKind {
  audios: string[]
  illustrations: string[]
}

/** Clasificación de medios por tipo (misma regla de aceptación que arriba). */
export function extractMediaByKind(
  words: Array<{ audioUrl?: string | null; illustrationUrl?: string | null }>
): MediaByKind {
  const audios = new Set<string>()
  const illustrations = new Set<string>()
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
      if (!isHttp && !isMediaRel && !isApiMedia) continue
      if (AUDIO_RE.test(v)) audios.add(v)
      else illustrations.add(v)
    }
  }
  return { audios: [...audios], illustrations: [...illustrations] }
}

export interface MediaPlan {
  /** TODOS los audios primero (entran en ~10MB: 343 x ~25KB ≈ 8.4MB). */
  audios: string[]
  /** Ilustraciones hasta ~40MB / 120 entradas. */
  illustrations: string[]
  estimatedBytes: number
}

/**
 * Plan de descarga con prioridad palabras > audios > ilustraciones hasta el
 * presupuesto. Determinista (mismo orden de entrada, mismo plan): el resume
 * de una descarga interrumpida no reordena.
 */
export function planMediaDownloads(
  words: Array<{ audioUrl?: string | null; illustrationUrl?: string | null }>
): MediaPlan {
  const { audios, illustrations } = extractMediaByKind(words)
  const pickedAudios: string[] = []
  let audioBytes = 0
  for (const u of audios) {
    const s = estimateBytes(u)
    if (pickedAudios.length >= AUDIO_ENTRY_CAP || audioBytes + s > AUDIO_BUDGET_BYTES) break
    pickedAudios.push(u)
    audioBytes += s
  }
  const pickedImages: string[] = []
  let imageBytes = 0
  for (const u of illustrations) {
    const s = estimateBytes(u)
    if (pickedImages.length >= IMAGE_ENTRY_CAP || imageBytes + s > IMAGE_BUDGET_BYTES) break
    pickedImages.push(u)
    imageBytes += s
  }
  return { audios: pickedAudios, illustrations: pickedImages, estimatedBytes: audioBytes + imageBytes }
}

/** "8,4 MB" (es-CO). Para el display del presupuesto de medios. */
export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`
}

/** Conexión medida (saveData o 2G): solo palabras, sin medios. */
export function isMeteredConnection(): boolean {
  try {
    const conn = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }).connection
    if (!conn) return false
    return conn.saveData === true || conn.effectiveType === "2g"
  } catch {
    return false
  }
}

/**
 * Pide almacenamiento persistente (llamar desde el gesto del usuario:
 * banner/banner-settings). Best-effort: false si el navegador lo niega.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export interface MediaUsage {
  /** Bytes usados por TODO el origen (real, navigator.storage.estimate). */
  bytes: number
  quota: number
  audios: number
  illustrations: number
}

/** Uso real de medios (estimate del origen + conteo de entradas por caché). */
export async function getMediaUsage(): Promise<MediaUsage> {
  const usage: MediaUsage = { bytes: 0, quota: 0, audios: 0, illustrations: 0 }
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      usage.bytes = est.usage ?? 0
      usage.quota = est.quota ?? 0
    }
  } catch {
    // estimate no disponible: conteos igual sirven.
  }
  try {
    if (typeof caches !== "undefined") {
      const audio = await caches.open(AUDIO_CACHE_NAME)
      usage.audios = (await audio.keys()).length
      const image = await caches.open(IMAGE_CACHE_NAME)
      usage.illustrations = (await image.keys()).length
    }
  } catch {
    // Cache API no disponible.
  }
  return usage
}

/** Libera los medios cacheados (audios + ilustraciones). No toca palabras. */
export async function clearMediaCaches(): Promise<void> {
  try {
    if (typeof caches === "undefined") return
    await caches.delete(AUDIO_CACHE_NAME)
    await caches.delete(IMAGE_CACHE_NAME)
  } catch {
    // Best-effort.
  }
}
