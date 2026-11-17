"use client"

import { useCallback, useEffect, useState } from "react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import {
  getCachedSuggestedWords,
  setCachedSuggestedWords,
  type CachedSuggestedWords,
} from "@/lib/local-db"

export interface SuggestedWordData {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  illustrationUrl: string | null
  culturalContext: string | null
  category: string | null
  examples: Array<{ spanish: string; nasaYuwe: string }> | null
}

export interface UseSuggestedWordsResult {
  words: SuggestedWordData[] | null
  date: string | null
  isLoading: boolean
  isFromCache: boolean
  neverConnected: boolean
}

export function useSuggestedWords(): UseSuggestedWordsResult {
  const isOnline = useOnlineStatus()

  const [words, setWords] = useState<SuggestedWordData[] | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [neverConnected, setNeverConnected] = useState(false)

  const todayKey = useCallback(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    let alive = true

    const run = async () => {
      const today = todayKey()

      // 1) Cache primero: render inmediato si hay datos del día (sin skeleton).
      const cached = await getCachedSuggestedWords()
      const cacheFresh = Boolean(cached && cached.date === today && Array.isArray(cached.words) && cached.words.length > 0)

      if (cacheFresh && cached) {
        if (!alive) return
        setWords(cached.words)
        setDate(cached.date)
        setIsFromCache(true)
        setIsLoading(false)
        setNeverConnected(false)
      }

      // 2) Revalidación contra el servidor (si hay red).
      if (isOnline) {
        try {
          const res = await fetch("/api/dictionary/suggested-words")
          if (!alive) return
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data.words)) {
              setWords(data.words)
              setDate(data.date)
              setIsFromCache(false)
              setNeverConnected(false)
              setIsLoading(false)

              const cacheData: CachedSuggestedWords = {
                words: data.words,
                date: data.date,
                cachedAt: new Date().toISOString(),
              }
              await setCachedSuggestedWords(cacheData)
              return
            }
          }
        } catch {
          // fall through to cache handling below
        }

        if (!alive) return
        // Server falló: si no teníamos cache fresco, intentar cache (cualquier fecha).
        if (!cacheFresh) {
          const fallback = await getCachedSuggestedWords()
          if (!alive) return
          if (fallback) {
            setWords(fallback.words)
            setDate(fallback.date)
            setIsFromCache(true)
            setNeverConnected(false)
          } else {
            setWords(null)
            setNeverConnected(false)
          }
          setIsLoading(false)
        }
      } else {
        if (!alive) return
        // Offline: si no había cache fresco, marcar never-connected solo si no hay nada.
        if (!cacheFresh) {
          const fallback = await getCachedSuggestedWords()
          if (!alive) return
          if (fallback) {
            setWords(fallback.words)
            setDate(fallback.date)
            setIsFromCache(true)
            setNeverConnected(false)
          } else {
            setWords(null)
            setNeverConnected(true)
          }
          setIsLoading(false)
        }
      }
    }

    run()

    return () => {
      alive = false
    }
  }, [isOnline, todayKey])

  return { words, date, isLoading, isFromCache, neverConnected }
}
