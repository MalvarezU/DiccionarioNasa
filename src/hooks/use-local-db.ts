"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import {
  isLocalDBReady,
  storeWords,
  getLocalDBStats,
  setLastSync,
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
  /** Start or resume the download */
  startDownload: () => Promise<void>
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

  // Ref to prevent concurrent downloads
  const downloadInProgressRef = useRef(false)

  /**
   * Start or resume downloading the dictionary into IndexedDB.
   *
   * Resume logic:
   * 1. Check getLocalDBStats() to see how many words are already stored.
   * 2. Calculate startPage = Math.floor(localWordCount / pageSize) + 1
   * 3. Fetch pages from startPage using the /api/dictionary/export endpoint.
   * 4. Store each page's words and update progress.
   * 5. On completion, set lastSync timestamp and mark DB as ready.
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

      // Calculate which page to resume from
      const pagesAlreadyDone = alreadyStored > 0 ? Math.floor(alreadyStored / PAGE_SIZE) : 0
      const startPage = pagesAlreadyDone + 1

      // Set initial state from already-downloaded words
      setLocalWordCount(alreadyStored)

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
        setIsReady(true)
        setDownloadProgress(100)
        setIsDownloading(false)
        downloadInProgressRef.current = false
        return
      }

      const totalPages = Math.ceil(totalWords / PAGE_SIZE)

      // Show progress for already-completed pages
      if (pagesAlreadyDone > 0) {
        setDownloadProgress(Math.round((pagesAlreadyDone / totalPages) * 100))
      }

      // Track pages completed
      let completedPages = pagesAlreadyDone

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

      // All pages downloaded successfully
      await setLastSync(new Date().toISOString())
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
    startDownload,
    checkAndResume,
  }
}
