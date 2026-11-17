"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import {
  isLocalDBReady,
  storeWords,
  getAllLocalWords,
  getLocalDBStats,
  getLastSync,
  setLastSync,
  clearLocalDB,
} from "@/lib/local-db"
import {
  downloadMediaQueue,
  planMediaDownloads,
  isMeteredConnection,
  requestPersistence,
  getMediaUsage,
  clearMediaCaches,
  MEDIA_BUDGET_BYTES,
  type MediaUsage,
} from "@/lib/media-sync"

const PAGE_SIZE = 100
/** Del progreso total: palabras 0-70, medios 70-100. */
const WORDS_PROGRESS_CAP = 70

interface UseLocalDBReturn {
  /** Whether the local DB has been fully downloaded and is ready for offline use */
  isReady: boolean
  /** Whether a download is currently in progress */
  isDownloading: boolean
  /** Download progress percentage (0-100) */
  downloadProgress: number
  /** Total number of words in local DB */
  localWordCount: number
  /** Error message if download failed */
  error: string | null
  /** ISO timestamp of last successful sync */
  lastSync: string | null
  /** Start or resume the download */
  startDownload: () => Promise<void>
  /** Force a full re-sync: clear local DB and re-download everything */
  forceResync: () => Promise<boolean>
  /** Refresh stats (word count + lastSync) from IndexedDB */
  refreshStats: () => Promise<void>
  /** Check and resume download if it was interrupted (call on mount) */
  checkAndResume: () => Promise<void>
  /** Uso real de medios (null hasta la primera medición) */
  mediaUsage: MediaUsage | null
  /** Re-mide el uso de medios (estimate + conteo de cachés) */
  refreshMediaUsage: () => Promise<void>
  /** Libera audios + ilustraciones cacheados (no toca palabras) */
  clearMedia: () => Promise<void>
}

export function useLocalDB(): UseLocalDBReturn {
  const isOnline = useOnlineStatus()
  const [isReady, setIsReady] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [localWordCount, setLocalWordCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSyncState] = useState<string | null>(null)
  const [mediaUsage, setMediaUsage] = useState<MediaUsage | null>(null)

  // Ref to prevent concurrent downloads
  const downloadInProgressRef = useRef(false)
  // Abort del sync en curso (unload/offline): corta palabras y medios.
  const syncAbortRef = useRef<AbortController | null>(null)

  /** Re-mide el uso real de medios (estimate del origen + conteo). */
  const refreshMediaUsage = useCallback(async () => {
    try {
      setMediaUsage(await getMediaUsage())
    } catch {
      // Sin APIs de storage: queda null (la UI lo oculta).
    }
  }, [])

  /** Libera audios + ilustraciones y re-mide. No toca palabras. */
  const clearMedia = useCallback(async () => {
    await clearMediaCaches()
    await refreshMediaUsage()
  }, [refreshMediaUsage])

  /**
   * Fase de medios: audios + ilustraciones con prioridad y presupuesto
   * (planMediaDownloads: TODOS los audios primero, luego ilustraciones hasta
   * ~50MB). En conexión medida (saveData/2G) se salta: solo palabras.
   * Mapea su progreso al tramo 70-100.
   */
  const downloadMediaPhase = useCallback(
    async (signal?: AbortSignal) => {
      if (isMeteredConnection()) {
        setDownloadProgress(100)
        return { downloaded: 0, failed: 0, skippedBudget: 0, skippedMetered: true as const }
      }
      const words = await getAllLocalWords()
      const plan = planMediaDownloads(words)
      const urls = [...plan.audios, ...plan.illustrations]
      if (urls.length === 0) {
        setDownloadProgress(100)
        return { downloaded: 0, failed: 0, skippedBudget: 0, skippedMetered: false as const }
      }
      const res = await downloadMediaQueue(urls, {
        signal,
        budgetBytes: MEDIA_BUDGET_BYTES,
        onProgress: (done, total) => {
          const pct =
            WORDS_PROGRESS_CAP +
            Math.round(((total === 0 ? 1 : done / total) * (100 - WORDS_PROGRESS_CAP)))
          setDownloadProgress(Math.min(100, pct))
        },
      })
      setDownloadProgress(100)
      return { ...res, skippedMetered: false as const }
    },
    []
  )

  /**
   * Core download logic shared between startDownload and forceResync.
   * Fetches all pages from the server and stores them in IndexedDB.
   */
  const downloadAllPages = useCallback(async (startPage: number = 1) => {
    // Fetch first page to get total count
    const firstRes = await fetch(
      `/api/dictionary/export?page=${startPage}&pageSize=${PAGE_SIZE}`
    )
    if (!firstRes.ok) {
      throw new Error("Error al conectar con el servidor (status " + firstRes.status + ")")
    }
    const firstData = await firstRes.json()
    const totalWords: number = firstData.total ?? 0

    if (totalWords === 0) {
      return
    }

    const totalPages = Math.ceil(totalWords / PAGE_SIZE)

    // Calculate already-completed pages for progress
    const pagesAlreadyDone = startPage - 1
    let completedPages = pagesAlreadyDone

    // Show progress for already-completed pages (tramo palabras: 0-70)
    if (pagesAlreadyDone > 0) {
      setDownloadProgress(Math.round((pagesAlreadyDone / totalPages) * WORDS_PROGRESS_CAP))
    }

    // Store first page data
    if (firstData.words && firstData.words.length > 0) {
      await storeWords(firstData.words)
      setLocalWordCount((prev) => prev + firstData.words.length)
    }
    completedPages++
    setDownloadProgress(Math.round((completedPages / totalPages) * WORDS_PROGRESS_CAP))

    // Fetch remaining pages sequentially
    let currentPage = startPage + 1
    while (firstData.hasMore && currentPage <= totalPages) {
      const res = await fetch(
        `/api/dictionary/export?page=${currentPage}&pageSize=${PAGE_SIZE}`
      )
      if (!res.ok) {
        throw new Error(`Error al descargar página ${currentPage}`)
      }
      const data = await res.json()

      if (data.words && data.words.length > 0) {
        await storeWords(data.words)
        setLocalWordCount((prev) => prev + data.words.length)
      }

      completedPages++
      setDownloadProgress(Math.round((completedPages / totalPages) * WORDS_PROGRESS_CAP))
      currentPage++
    }

    // Fase de medios (tramo 70-100): audios + ilustraciones a caché del SW.
    await downloadMediaPhase(syncAbortRef.current?.signal)

    // All pages downloaded successfully — update lastSync
    const syncTimestamp = new Date().toISOString()
    await setLastSync(syncTimestamp)
    setLastSyncState(syncTimestamp)
  }, [downloadMediaPhase])

  /**
   * Start or resume downloading the dictionary into IndexedDB.
   *
   * Resume logic:
   * 1. Check getLocalDBStats() to see how many words are already stored.
   * 2. Calculate startPage from existing word count.
   * 3. Fetch remaining pages and store them.
   * 4. On completion, mark DB as ready.
   */
  const startDownload = useCallback(async () => {
    // Prevent concurrent downloads
    if (downloadInProgressRef.current) return
    downloadInProgressRef.current = true
    syncAbortRef.current = new AbortController()

    setIsDownloading(true)
    setError(null)
    // Gesto del usuario: pedir persistencia para que el SO no evictee.
    void requestPersistence()

    try {
      // Check how many words are already stored (for resume)
      const stats = await getLocalDBStats()
      const alreadyStored = stats.wordCount

      // Update lastSync from DB if available
      if (stats.lastSync) {
        setLastSyncState(stats.lastSync)
      }

      // Calculate which page to resume from
      const pagesAlreadyDone = alreadyStored > 0 ? Math.floor(alreadyStored / PAGE_SIZE) : 0
      const startPage = pagesAlreadyDone + 1

      // Set initial state from already-downloaded words
      setLocalWordCount(alreadyStored)

      // If already complete, just mark as ready
      const ready = await isLocalDBReady()
      if (ready && alreadyStored > 0) {
        setIsReady(true)
        setDownloadProgress(100)
        setIsDownloading(false)
        downloadInProgressRef.current = false
        return
      }

      await downloadAllPages(startPage)

      // Mark as ready
      setIsReady(true)
      setDownloadProgress(100)

      // Update final word count from DB
      const finalStats = await getLocalDBStats()
      setLocalWordCount(finalStats.wordCount)
      // Medir el uso real de medios tras la descarga.
      void refreshMediaUsage()
    } catch (err) {
      console.error("Download error:", err)
      setError(
        err instanceof Error ? err.message : "Error desconocido al descargar"
      )
      // Keep progress as-is for resume capability
    } finally {
      setIsDownloading(false)
      downloadInProgressRef.current = false
    }
  }, [downloadAllPages, refreshMediaUsage])

  /**
   * Force a full re-sync: clear the local DB and re-download everything.
   * Used by the "Sincronizar ahora" button in settings.
   */
  const forceResync = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent downloads
    if (downloadInProgressRef.current) return false
    downloadInProgressRef.current = true
    syncAbortRef.current = new AbortController()

    setIsDownloading(true)
    setError(null)
    setDownloadProgress(0)
    setLastSyncState(null)
    // Gesto del usuario: pedir persistencia para que el SO no evictee.
    void requestPersistence()
    // NO borramos todavía: si la descarga falla, el IndexedDB previo queda
    // intacto y el usuario no se queda sin diccionario por un intento fallido.

    try {
      // 1) Descargar todo a memoria primero (sin tocar IndexedDB).
      const firstRes = await fetch(
        `/api/dictionary/export?page=1&pageSize=${PAGE_SIZE}`
      )
      if (!firstRes.ok) {
        throw new Error("Error al conectar con el servidor (status " + firstRes.status + ")")
      }
      const firstData = await firstRes.json()
      const totalWords: number = firstData.total ?? 0

      if (totalWords === 0) {
        throw new Error("El servidor no devolvió palabras")
      }

      const totalPages = Math.ceil(totalWords / PAGE_SIZE)
      const collected: unknown[] = []
      if (firstData.words && firstData.words.length > 0) {
        collected.push(...firstData.words)
      }
      setDownloadProgress(Math.round((1 / totalPages) * WORDS_PROGRESS_CAP))

      let currentPage = 2
      let hasMore = firstData.hasMore
      while (hasMore && currentPage <= totalPages) {
        const res = await fetch(
          `/api/dictionary/export?page=${currentPage}&pageSize=${PAGE_SIZE}`
        )
        if (!res.ok) {
          throw new Error(`Error al descargar página ${currentPage}`)
        }
        const data = await res.json()
        if (data.words && data.words.length > 0) {
          collected.push(...data.words)
        }
        setDownloadProgress(Math.round((currentPage / totalPages) * WORDS_PROGRESS_CAP))
        hasMore = data.hasMore
        currentPage++
      }

      // 2) Solo si todo se descargó OK: reemplazar IndexedDB.
      await clearLocalDB()
      await storeWords(collected as never)
      // 3) Fase de medios (tramo 70-100).
      await downloadMediaPhase(syncAbortRef.current?.signal)
      const syncTimestamp = new Date().toISOString()
      await setLastSync(syncTimestamp)
      setLastSyncState(syncTimestamp)
      setIsReady(true)
      setDownloadProgress(100)
      const finalStats = await getLocalDBStats()
      setLocalWordCount(finalStats.wordCount)
      // Medir el uso real de medios tras la descarga.
      void refreshMediaUsage()
      return true
    } catch (err) {
      console.error("Force resync error:", err)
      setError(
        err instanceof Error ? err.message : "Error desconocido al sincronizar"
      )
      // El IndexedDB previo queda intacto (no se limpió).
      return false
    } finally {
      setIsDownloading(false)
      downloadInProgressRef.current = false
    }
  }, [downloadAllPages, downloadMediaPhase, refreshMediaUsage])

  /**
   * Refresh stats (word count + lastSync) from IndexedDB.
   * Useful after the dialog opens to show the latest data.
   */
  const refreshStats = useCallback(async () => {
    try {
      const stats = await getLocalDBStats()
      setLocalWordCount(stats.wordCount)
      setLastSyncState(stats.lastSync)
      const ready = await isLocalDBReady()
      setIsReady(ready)
      if (ready) {
        setDownloadProgress(100)
      }
    } catch {
      // Silently fail
    }
  }, [])

  /**
   * Check if the local DB is ready. If not and we're online, auto-start
   * the download. If offline, wait for reconnection.
   */
  const checkAndResume = useCallback(async () => {
    try {
      const ready = await isLocalDBReady()
      if (ready) {
        setIsReady(true)
        setDownloadProgress(100)
        const stats = await getLocalDBStats()
        setLocalWordCount(stats.wordCount)
        setLastSyncState(stats.lastSync)
        void refreshMediaUsage()
        return
      }

      // Not ready — if online, start download automatically
      if (navigator.onLine) {
        await startDownload()
      }
      // If offline, do nothing (the online event listener will handle it)
    } catch (err) {
      console.error("checkAndResume error:", err)
    }
  }, [startDownload, refreshMediaUsage])

  // On mount, check and resume
  useEffect(() => {
    checkAndResume()
  }, [checkAndResume])

  // Auto-resume acotado: arranca solo al montar online o al reconectar,
  // con tope de intentos. Sin tope, un servidor caído provocaría un loop
  // infinito de reintentos (cada fallo deja isReady=false y el efecto
  // redispara). Lo manual (startDownload/forceResync) no tiene tope.
  const prevOnlineRef = useRef(isOnline)
  const autoAttemptsRef = useRef(0)
  const MAX_AUTO_ATTEMPTS = 2
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current
    prevOnlineRef.current = isOnline
    if (!isOnline || isReady || isDownloading) return
    if (!wasOffline && autoAttemptsRef.current > 0) return
    if (autoAttemptsRef.current >= MAX_AUTO_ATTEMPTS) return
    autoAttemptsRef.current++
    startDownload()
  }, [isOnline, isReady, isDownloading, startDownload])

  return {
    isReady,
    isDownloading,
    downloadProgress,
    localWordCount,
    error,
    lastSync,
    startDownload,
    forceResync,
    refreshStats,
    checkAndResume,
    mediaUsage,
    refreshMediaUsage,
    clearMedia,
  }
}
