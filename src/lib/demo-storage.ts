"use client"

export interface DemoFavorite {
  id: string
  userId: string
  wordId: string
  createdAt: string
}

export interface DemoHistoryEntry {
  id: string
  userId: string
  wordId: string
  createdAt: string
}

const FAVORITES_KEY = 'demo_favorites'
const HISTORY_KEY = 'demo_history'

function getLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function setLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

// ─── Favorites ─────────────────────────────────────────────

function getAllFavorites(): DemoFavorite[] {
  return getLocalStorage<DemoFavorite[]>(FAVORITES_KEY, [])
}

function saveAllFavorites(favs: DemoFavorite[]): void {
  setLocalStorage(FAVORITES_KEY, favs)
}

export function getLocalFavorites(userId: string): DemoFavorite[] {
  return getAllFavorites().filter(f => f.userId === userId)
}

export function toggleLocalFavorite(userId: string, wordId: string): boolean {
  const all = getAllFavorites()
  const idx = all.findIndex(f => f.userId === userId && f.wordId === wordId)

  if (idx !== -1) {
    all.splice(idx, 1)
    saveAllFavorites(all)
    return false
  }

  all.push({
    id: `fav-${Date.now()}`,
    userId,
    wordId,
    createdAt: new Date().toISOString(),
  })
  saveAllFavorites(all)
  return true
}

export function isLocalFavorite(userId: string, wordId: string): boolean {
  return getAllFavorites().some(f => f.userId === userId && f.wordId === wordId)
}

export function getLocalFavoritesWithWord(userId: string, getWord: (id: string) => any): Array<{
  id: string
  wordId: string
  createdAt: string
  word: any
}> {
  return getAllFavorites()
    .filter(f => f.userId === userId)
    .map(f => ({
      id: f.id,
      wordId: f.wordId,
      createdAt: f.createdAt,
      word: getWord(f.wordId),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ─── History ────────────────────────────────────────────────

function getAllHistory(): DemoHistoryEntry[] {
  return getLocalStorage<DemoHistoryEntry[]>(HISTORY_KEY, [])
}

function saveAllHistory(hist: DemoHistoryEntry[]): void {
  setLocalStorage(HISTORY_KEY, hist)
}

export function getLocalHistory(userId: string): DemoHistoryEntry[] {
  return getAllHistory()
    .filter(h => h.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function recordLocalHistory(userId: string, wordId: string): void {
  const all = getAllHistory()
  const idx = all.findIndex(h => h.userId === userId && h.wordId === wordId)

  if (idx !== -1) {
    all[idx] = { ...all[idx], createdAt: new Date().toISOString() }
  } else {
    all.push({
      id: `hist-${Date.now()}`,
      userId,
      wordId,
      createdAt: new Date().toISOString(),
    })
  }

  saveAllHistory(all)
}

export function clearLocalHistory(userId: string): void {
  const all = getAllHistory().filter(h => h.userId !== userId)
  saveAllHistory(all)
}

export function getLocalHistoryWithWord(userId: string, getWord: (id: string) => any): Array<{
  id: string
  wordId: string
  createdAt: string
  word: any
}> {
  return getAllHistory()
    .filter(h => h.userId === userId)
    .map(h => ({
      id: h.id,
      wordId: h.wordId,
      createdAt: h.createdAt,
      word: getWord(h.wordId),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ─── Sync helpers for demo mode ────────────────────────────

export function syncFavoritesToApi(userId: string): Promise<void> {
  return new Promise((resolve) => {
    const localFavs = getLocalFavorites(userId)
    Promise.all(
      localFavs.map(f =>
        fetch('/api/dictionary/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wordId: f.wordId }),
        }).catch(() => null)
      )
    ).then(() => resolve())
  })
}

export function syncHistoryToApi(userId: string): Promise<void> {
  return new Promise((resolve) => {
    const localHist = getLocalHistory(userId)
    Promise.all(
      localHist.map(h =>
        fetch('/api/dictionary/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wordId: h.wordId }),
        }).catch(() => null)
      )
    ).then(() => resolve())
  })
}