/// <reference lib="webworker" />

// Piiyaak v6: app shell + fallback independiente de la ruta + medios R2.
// - Navegaciones: network-first. Offline: HTML de la MISMA ruta si esta en
//   cache, si no el fallback estatico /offline.html (cero JS: nunca hidrata,
//   nunca descuadra). JAMAS se sirve el HTML de otra ruta (ese era el bug que
//   mataba la app con "Application error").
// - Precache generado por el build (public/sw-precache.js, versionado con el
//   BUILD_ID): install por asset con allSettled, sin todo-o-nada.
// - Payloads RSC (?_rsc= del prefetcher de Next): cache aparte con dedupe por
//   pathname y tope, para que no inunden el shell.
// - API: network-first (IndexedDB cubre la busqueda offline).
// - Audios e imagenes (mismo origen u otros, p. ej. R2): cache-first con tope.
//   OJO opacas: <audio>/<img> piden en modo no-cors y la respuesta es opaca
//   (status 0, ok === false). Si solo se guarda `res.ok`, el cache nunca se
//   llena: se acepta tambien `res.type === "opaque"`, con tope para acotar.

const PRECACHE_CACHE = "piiyaak-precache-v6"
const SHELL_CACHE = "piiyaak-shell-v6"
const SHELL_MAX_ENTRIES = 60
const RSC_CACHE = "piiyaak-rsc-v1"
const RSC_MAX_ENTRIES = 40
const AUDIO_CACHE = "piiyaak-audio-v1"
const AUDIO_MAX_ENTRIES = 400
const IMAGE_CACHE = "piiyaak-image-v1"
const IMAGE_MAX_ENTRIES = 120

// Presupuestos por bytes (Fase 3 fija 50MB de medios auto: ~10MB audios +
// ~40MB ilustraciones; el SW los hace cumplir aunque el ledger se pierda).
const AUDIO_MAX_BYTES = 10 * 1024 * 1024
const IMAGE_MAX_BYTES = 40 * 1024 * 1024
// R2 no envia CORS: los medios cross-origin son opacos (sin Content-Length).
// Estimaciones medidas: audios ~25KB c/u (343 ≈ 8.4MB), PNGs ~333KB c/u.
const AUDIO_OPAQUE_BYTES = 25 * 1024
const IMAGE_OPAQUE_BYTES = 333 * 1024

const BUDGETS = {
  [SHELL_CACHE]: { maxEntries: SHELL_MAX_ENTRIES, maxBytes: 0, opaqueBytes: 0 },
  [RSC_CACHE]: { maxEntries: RSC_MAX_ENTRIES, maxBytes: 0, opaqueBytes: 0 },
  [AUDIO_CACHE]: { maxEntries: AUDIO_MAX_ENTRIES, maxBytes: AUDIO_MAX_BYTES, opaqueBytes: AUDIO_OPAQUE_BYTES },
  [IMAGE_CACHE]: { maxEntries: IMAGE_MAX_ENTRIES, maxBytes: IMAGE_MAX_BYTES, opaqueBytes: IMAGE_OPAQUE_BYTES },
}

// Respaldo minimo si el build no genero sw-precache.js (p. ej. dev).
// OJO: solo assets estaticos, nunca HTML de rutas.
const FALLBACK_ASSETS = ["/offline.html", "/manifest.webmanifest", "/icon-192.png", "/apple-touch-icon-180.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        importScripts("/sw-precache.js")
      } catch {
        // Sin manifiesto del build (dev): se usa el respaldo.
      }
      const manifest = self.__PIIYAAK_PRECACHE
      const assets =
        manifest && Array.isArray(manifest.assets) && manifest.assets.length > 0
          ? manifest.assets
          : FALLBACK_ASSETS
      const cache = await caches.open(PRECACHE_CACHE)
      // Por asset (F6): un 404 no tumba todo el precache.
      const results = await Promise.allSettled(
        assets.map((url) =>
          cache.add(url).catch((err) => {
            throw new Error(`${url}: ${err?.message ?? err}`)
          })
        )
      )
      const failed = results.filter((r) => r.status === "rejected")
      if (failed.length > 0) {
        console.warn(
          "SW: precache parcial:",
          failed.map((r) => r.reason?.message ?? r.reason).join("; ")
        )
      }
      // Primera instalacion: tomar control rapido. Con version previa
      // instalada, NO skipWaiting (el aviso de version lo maneja la pagina).
      const names = await caches.keys()
      const hadPrior = names.some((n) => n !== PRECACHE_CACHE && n.startsWith("piiyaak-precache-"))
      if (!hadPrior) await self.skipWaiting()
    })().catch((err) => {
      console.warn("SW: fallo precache shell:", err)
    })
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (n) =>
                n !== PRECACHE_CACHE &&
                n !== SHELL_CACHE &&
                n !== RSC_CACHE &&
                n !== AUDIO_CACHE &&
                n !== IMAGE_CACHE &&
                !n.startsWith("nasa-yuwe-audio")
            )
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  )
})

/** Guarda respuestas ok Y opacas (ver nota arriba). */
function isCacheable(res) {
  return res.ok || res.type === "opaque"
}

// Libro contable de bytes por cache (vive lo que viva el worker; los topes
// de entradas son el respaldo duro ante un ledger frio tras reinicio).
const byteLedger = new Map()

function ledgerFor(name) {
  let m = byteLedger.get(name)
  if (!m) {
    m = new Map()
    byteLedger.set(name, m)
  }
  return m
}

function sizeOf(res, estimate) {
  if (res.type === "opaque") return estimate
  const len = parseInt(res.headers.get("Content-Length") || "", 10)
  return Number.isFinite(len) && len > 0 ? len : estimate
}

function isQuotaError(err) {
  return !!err && (err.name === "QuotaExceededError" || err.code === 22)
}

async function notifyClients(message) {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true })
    clients.forEach((c) => {
      try {
        c.postMessage(message)
      } catch {
        // Cliente ido: nada que avisar.
      }
    })
  } catch {
    // Sin clientes: nada que avisar.
  }
}

/**
 * put con presupuesto LRU (entradas + bytes). Ante QuotaExceededError recorta
 * a la mitad, reintenta UNA vez y avisa al cliente (PIIYAAK_SW_QUOTA): nunca
 * se traga el error en silencio.
 */
async function putWithBudget(cacheName, req, res, budget) {
  const cache = await caches.open(cacheName)
  const url = typeof req === "string" ? new URL(req, self.location.origin).href : req.url
  const size = sizeOf(res, budget.opaqueBytes || 0)
  const ledger = ledgerFor(cacheName)
  const est = budget.opaqueBytes || 0
  try {
    const keys = await cache.keys()
    let bytes = 0
    for (const k of keys) bytes += ledger.get(k.url) ?? est
    let idx = 0
    while (
      (keys.length - idx + 1 > budget.maxEntries ||
        (budget.maxBytes > 0 && bytes + size > budget.maxBytes)) &&
      idx < keys.length
    ) {
      const victim = keys[idx++]
      bytes -= ledger.get(victim.url) ?? est
      ledger.delete(victim.url)
      await cache.delete(victim)
    }
    await cache.put(req, res)
    ledger.set(url, size)
  } catch (err) {
    if (!isQuotaError(err)) return
    try {
      const keys = await cache.keys()
      const drop = Math.ceil(keys.length / 2)
      for (let i = 0; i < drop; i++) {
        ledger.delete(keys[i].url)
        await cache.delete(keys[i])
      }
      await cache.put(req, res)
      ledger.set(url, size)
    } catch {
      // Sin espacio ni tras recortar: se avisa igual abajo.
    }
    void notifyClients({ type: "PIIYAAK_SW_QUOTA", cache: cacheName })
  }
}

// Actualizacion bajo control del usuario: la pagina avisa "nueva version"
// y manda SKIP_WAITING solo cuando el usuario acepta.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") void self.skipWaiting()
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (!url.protocol.startsWith("http")) return

  // APKs: descarga directa del navegador, sin interceptar ni cachear.
  // Un Response de cache/opaco rompe la descarga ("Failed to convert value
  // to 'Response'") y el instalador espera el binario intacto.
  if (url.pathname.endsWith(".apk")) return

  // Audios (mismo origen u otros, p. ej. R2): cache-first con tope
  const isAudio =
    req.destination === "audio" ||
    /\.(mp3|wav|ogg)(\?|$)/.test(url.pathname)
  if (isAudio) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        try {
          const res = await fetch(req)
          if (isCacheable(res)) {
            await putWithBudget(AUDIO_CACHE, req, res.clone(), BUDGETS[AUDIO_CACHE])
          }
          return res
        } catch {
          return new Response("Audio no disponible sin conexión", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        }
      })
    )
    return
  }

  // Imágenes (mismo origen u otros, p. ej. R2; incluye /_next/image que pide
  // el componente WordIllustration): cache-first con tope.
  const isImage =
    req.destination === "image" ||
    /\.(png|jpe?g|webp|avif)(\?|$)/.test(url.pathname)
  if (isImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        try {
          const res = await fetch(req)
          if (isCacheable(res)) {
            await putWithBudget(IMAGE_CACHE, req, res.clone(), BUDGETS[IMAGE_CACHE])
          }
          return res
        } catch {
          // Sin imagen offline: el componente muestra su fallback.
          return new Response("Imagen no disponible sin conexión", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        }
      })
    )
    return
  }

  // API: network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ error: "offline", message: "Sin conexión" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    )
    return
  }

  // Payloads RSC (?_rsc=): el prefetcher de Next inunda el shell con
  // duplicados. Cache aparte, clave = pathname (dedupe), con tope.
  if (url.searchParams.has("_rsc")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RSC_CACHE)
        try {
          const res = await fetch(req)
          if (res.ok) {
            await putWithBudget(RSC_CACHE, url.pathname, res.clone(), BUDGETS[RSC_CACHE])
          }
          return res
        } catch {
          const hit = await cache.match(url.pathname)
          return (
            hit ||
            new Response("Sin conexión", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          )
        }
      })()
    )
    return
  }

  // Navegaciones: network-first con fallback independiente de la ruta.
  // Offline: 1) HTML de la MISMA ruta (hidrata bien), 2) /offline.html
  // estatico (cero JS: imposible descuadrar), 3) 503 plano.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req)
          if (res.ok) {
            const copy = res.clone()
            // No bloquear la navegacion por el cacheo (con presupuesto y aviso).
            void putWithBudget(SHELL_CACHE, req, copy, BUDGETS[SHELL_CACHE]).catch(() => {})
          }
          return res
        } catch {
          const shell = await caches.open(SHELL_CACHE)
          const same = await shell.match(req)
          if (same) return same
          const precache = await caches.open(PRECACHE_CACHE)
          const precached = await precache.match(req)
          if (precached) return precached
          const fallback = await precache.match("/offline.html")
          if (fallback) return fallback
          return new Response("Sin conexión", {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
        }
      })()
    )
    return
  }

  // Estáticos: stale-while-revalidate (SHELL primero, PRECACHE del build
  // después). La revalidación corre en background vía waitUntil.
  event.respondWith(
    (async () => {
      const shell = await caches.open(SHELL_CACHE)
      const hit = await shell.match(req)
      const precache = await caches.open(PRECACHE_CACHE)
      const cached = hit || (await precache.match(req))
      const network = fetch(req)
        .then(async (res) => {
          // No cachear respuestas que el servidor marca no-store (dev).
          // Evita que un CSS/JS viejo quede en la caché del SW.
          const cc = (res.headers.get("Cache-Control") || "").toLowerCase()
          if (res.ok && !cc.includes("no-store")) {
            // Presupuesto y aviso de quota en vez de trim silencioso.
            await putWithBudget(SHELL_CACHE, req, res.clone(), BUDGETS[SHELL_CACHE])
          }
          return res
        })
        .catch(() => undefined)
      if (cached) {
        event.waitUntil(network)
        return cached
      }
      const net = await network
      return (
        net ||
        new Response("Sin conexión", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      )
    })()
  )
})
