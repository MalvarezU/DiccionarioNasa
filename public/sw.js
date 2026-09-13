/// <reference lib="webworker" />

// Piiyaak v2: app shell + offline + audios.
// - Navegaciones: network-first con fallback a /offline.
// - Estáticos mismo origen: stale-while-revalidate.
// - API: network-first (IndexedDB cubre la búsqueda offline).
// - Audios: cache-first con tope (evita llenar el dispositivo).

const SHELL_CACHE = "piiyaak-shell-v2"
const AUDIO_CACHE = "piiyaak-audio-v1"
const AUDIO_MAX_ENTRIES = 50

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
            .filter((n) => n !== SHELL_CACHE && n !== AUDIO_CACHE && !n.startsWith("nasa-yuwe-audio"))
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  )
})

async function trimAudioCache() {
  try {
    const cache = await caches.open(AUDIO_CACHE)
    const keys = await cache.keys()
    if (keys.length > AUDIO_MAX_ENTRIES) {
      await cache.delete(keys[0])
    }
  } catch {
    // ignorar: el audio sigue funcionando online
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (!url.protocol.startsWith("http")) return

  // Audios (mismo origen u otros, p. ej. Supabase): cache-first con tope
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
          if (res.ok) {
            await cache.put(req, res.clone())
            void trimAudioCache()
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
