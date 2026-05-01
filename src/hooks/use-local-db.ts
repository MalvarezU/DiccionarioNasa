"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import {
  isLocalDBReady,
  storeWords,
  getLocalDBStats,
  getLastSync,
  setLastSync,
  clearLocalDB,
} from "@/lib/local-db"

const PAGE_SIZE = 100

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
  forceResync: () => Promise<void>
  /** Refresh stats (word count + lastSync) from IndexedDB */
  refreshStats: () => Promise<void>
  /** Check and resume download if it was interrupted (call on mount) */
  checkAndResume: () => Promise<void>
}

export function useLocalDB(): UseLocalDBReturn {
  const isOnline = useOnlineStatus()
  const [isReady, setIsReady] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [localWordCount, setLocalWordCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSyncState] = useState<string | null>(null)

  // Ref to prevent concurrent downloads
  const downloadInProgressRef = useRef(false)

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
      throw new Error("Error al conectar con el servidor")
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

    // Show progress for already-completed pages
    if (pagesAlreadyDone > 0) {
      setDownloadProgress(Math.round((pagesAlreadyDone / totalPages) * 100))
    }

    // Store first page data
    if (firstData.words && firstData.words.length > 0) {
      await storeWords(firstData.words)
      setLocalWordCount((prev) => prev + firstData.words.length)
    }
    completedPages++
    setDownloadProgress(Math.round((completedPages / totalPages) * 100))

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
      setDownloadProgress(Math.round((completedPages / totalPages) * 100))
      currentPage++
    }

    // All pages downloaded successfully — update lastSync
    const syncTimestamp = new Date().toISOString()
    await setLastSync(syncTimestamp)
    setLastSyncState(syncTimestamp)
  }, [])

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

    setIsDownloading(true)
    setError(null)

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
  }, [downloadAllPages])

  /**
   * Force a full re-sync: clear the local DB and re-download everything.
   * Used by the "Sincronizar ahora" button in settings.
   */
  const forceResync = useCallback(async () => {
    // Prevent concurrent downloads
    if (downloadInProgressRef.current) return
    downloadInProgressRef.current = true

    setIsDownloading(true)
    setError(null)
    setDownloadProgress(0)
    setLocalWordCount(0)
    setLastSyncState(null)
    setIsReady(false)

    try {
      // Clear existing local data
      await clearLocalDB()

      // Re-download everything from scratch
      await downloadAllPages(1)

      // Mark as ready
      setIsReady(true)
      setDownloadProgress(100)

      // Update final word count from DB
      const finalStats = await getLocalDBStats()
      setLocalWordCount(finalStats.wordCount)
    } catch (err) {
      console.error("Force resync error:", err)
      setError(
        err instanceof Error ? err.message : "Error desconocido al sincronizar"
      )
    } finally {
      setIsDownloading(false)
      downloadInProgressRef.current = false
    }
  }, [downloadAllPages])

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
  }, [startDownload])

  // On mount, check and resume
  useEffect(() => {
    checkAndResume()
  }, [checkAndResume])

  // Auto-resume on reconnect: when browser goes online and DB is not ready
  useEffect(() => {
    if (isOnline && !isReady && !isDownloading) {
      startDownload()
    }
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
  }
}
