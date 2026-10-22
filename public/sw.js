/// <reference lib="webworker" />

// Piiyaak v3: app shell + offline + audios + imágenes R2.
// - Navegaciones: network-first con fallback a /offline.
// - Estáticos mismo origen: stale-while-revalidate.
// - API: network-first (IndexedDB cubre la búsqueda offline).
// - Audios e imágenes (mismo origen u otros, p. ej. R2): cache-first con tope.
//   OJO opacas: <audio>/<img> piden en modo no-cors y la respuesta es opaca
//   (status 0, ok === false). Si solo se guarda `res.ok`, el caché nunca se
//   llena: se acepta también `res.type === "opaque"`, con tope para acotar.

const SHELL_CACHE = "piiyaak-shell-v2"
const AUDIO_CACHE = "piiyaak-audio-v1"
const AUDIO_MAX_ENTRIES = 50
const IMAGE_CACHE = "piiyaak-image-v1"
const IMAGE_MAX_ENTRIES = 100

const SHELL_ASSETS = ["/", "/offline", "/manifest.webmanifest", "/icon-192.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch((err) => {
        console.warn("SW: fallo precache shell:", err)
      })
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== SHELL_CACHE && n !== AUDIO_CACHE && n !== IMAGE_CACHE && !n.startsWith("nasa-yuwe-audio"))
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  )
})

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    if (keys.length > maxEntries) {
      await cache.delete(keys[0])
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

  // Navegaciones: network-first con fallback offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((cache) => {
            if (res.ok) cache.put(req, copy).catch(() => {})
          })
          return res
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE)
          return (
            (await cache.match(req)) ||
            (await cache.match("/offline")) ||
            new Response("Sin conexión", { status: 503 })
          )
        })
    )
    return
  }

  // Estáticos: stale-while-revalidate
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const hit = await cache.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone()).catch(() => {})
          return res
        })
        .catch(() => hit)
      return hit || network
    })
  )
})
