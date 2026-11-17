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

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName)
    // Borrar TODOS los excedentes (antes solo 1 por llamada: con descargas
    // masivas el cache crecia sin cota entre trims).
    let keys = await cache.keys()
    while (keys.length > maxEntries) {
      await cache.delete(keys[0])
      keys = await cache.keys()
    }
  } catch {
    // ignorar: el contenido sigue funcionando online
  }
}

/** Guarda respuestas ok Y opacas (ver nota arriba). */
function isCacheable(res) {
  return res.ok || res.type === "opaque"
}

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
            await cache.put(req, res.clone())
            void trimCache(AUDIO_CACHE, AUDIO_MAX_ENTRIES)
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
            await cache.put(req, res.clone())
            void trimCache(IMAGE_CACHE, IMAGE_MAX_ENTRIES)
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
            await cache.put(url.pathname, res.clone())
            void trimCache(RSC_CACHE, RSC_MAX_ENTRIES)
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
            const cache = await caches.open(SHELL_CACHE)
            // No bloquear la navegacion por el cacheo.
            void cache
              .put(req, copy)
              .then(() => trimCache(SHELL_CACHE, SHELL_MAX_ENTRIES))
              .catch(() => {})
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

  // Estáticos: stale-while-revalidate
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const hit = await cache.match(req)
      const network = fetch(req)
        .then((res) => {
          // No cachear respuestas que el servidor marca no-store (dev).
          // Evita que un CSS/JS viejo quede en la caché del SW.
          const cc = (res.headers.get("Cache-Control") || "").toLowerCase()
          if (res.ok && !cc.includes("no-store")) {
            cache.put(req, res.clone()).catch(() => {})
            void trimCache(SHELL_CACHE, SHELL_MAX_ENTRIES)
          }
          return res
        })
        .catch(() => hit)
      return hit || network
    })
  )
})
