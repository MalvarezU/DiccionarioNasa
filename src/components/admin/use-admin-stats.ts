"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { type AdminStats, useMounted } from "@/lib/admin-utils"

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes (HU3.5.6)

/**
 * Estadísticas del panel admin: carga, auto-refresh cada 5 min y derivados.
 * La UI vive en dashboard-stats.tsx, dashboard-activity.tsx y AdminDashboard.tsx.
 */
export function useAdminStats() {
  const mounted = useMounted()

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStats = useCallback(async (showRefresh = false, silent = false) => {
    if (showRefresh && !silent) {
      setIsRefreshing(true)
    } else if (!silent) {
      setIsLoading(true)
    }
    if (!silent) setError(null)

    try {
      const res = await fetch("/api/admin/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        setLastRefreshed(new Date())
      } else if (!silent) {
        setError("Error al cargar las estadísticas")
      }
    } catch {
      if (!silent) {
        setError("Error de conexión al servidor")
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      fetchStats(true, true)
    }, AUTO_REFRESH_INTERVAL)

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
      }
    }
  }, [fetchStats])

  const handleRefresh = useCallback(() => {
    fetchStats(true)
  }, [fetchStats])

  const refreshAfterMutation = useCallback(() => {
    fetchStats(true)
  }, [fetchStats])

  const statusSum = useMemo(() => {
    if (!stats) return 0
    return stats.publishedCount + stats.draftCount + stats.archivedCount
  }, [stats])

  const sumMatchesTotal = useMemo(() => {
    if (!stats) return true
    return statusSum === stats.totalWords
  }, [stats, statusSum])

  const publishedWithAudio = useMemo(() => {
    if (!stats) return 0
    return stats.publishedCount - stats.publishedWithoutAudio
  }, [stats])

  return {
    mounted,
    stats,
    isLoading,
    isRefreshing,
    error,
    lastRefreshed,
    statusSum,
    sumMatchesTotal,
    publishedWithAudio,
    handleRefresh,
    refreshAfterMutation,
  }
}
