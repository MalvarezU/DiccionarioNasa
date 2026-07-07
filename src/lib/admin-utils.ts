import { useSyncExternalStore } from "react"

export interface AuditLogEntry {
  id: string
  action: string
  entity: string
  entityId: string | null
  changes: string | null
  userId: string | null
  createdAt: string
}

export interface AdminStats {
  totalWords: number
  draftCount: number
  publishedCount: number
  archivedCount: number
  wordsWithAudio: number
  publishedWithoutAudio: number
  totalUsers: number
  totalFavorites: number
  recentWords: number
  recentAuditLogs: AuditLogEntry[]
}

const emptySubscribe = () => () => {}

export function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

export function formatNumber(n: number): string {
  return n.toLocaleString("es-CO")
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatTimeAgo(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "ahora"
  if (diffMin < 60) return `hace ${diffMin} min`
  if (diffHr < 24) return `hace ${diffHr}h`
  if (diffDay < 7) return `hace ${diffDay}d`
  return formatDateShort(iso)
}

export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE: "Creación",
    UPDATE: "Edición",
    DELETE: "Eliminación",
    IMPORT: "Importación",
    SUGGEST: "Sugerencia",
    STATUS_CHANGE: "Cambio estado",
    PUBLISH: "Publicación",
    ARCHIVE: "Archivación",
    BATCH_PUBLISH: "Publicación lote",
    BATCH_ARCHIVE: "Archivación lote",
  }
  return labels[action] || action
}

export function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    CREATE: "text-secondary bg-secondary/10",
    UPDATE: "text-primary bg-primary/10",
    DELETE: "text-destructive bg-destructive/10",
    IMPORT: "text-primary bg-primary/10",
    SUGGEST: "text-tertiary bg-tertiary/10",
    STATUS_CHANGE: "text-primary bg-primary/10",
    PUBLISH: "text-secondary bg-secondary/10",
    ARCHIVE: "text-muted-foreground bg-muted/50",
    BATCH_PUBLISH: "text-secondary bg-secondary/10",
    BATCH_ARCHIVE: "text-muted-foreground bg-muted/50",
  }
  return colors[action] || "text-muted-foreground bg-muted/50"
}

export function getEntityLabel(entity: string): string {
  const labels: Record<string, string> = {
    DictionaryWord: "Palabra",
    User: "Usuario",
    Favorite: "Favorito",
    AuditLog: "Log",
  }
  return labels[entity] || entity
}

export function getResponsible(userId: string | null): string {
  return "admin (MVP)"
}

export const WORD_CATEGORIES = [
  { value: "sustantivo", label: "Sustantivo" },
  { value: "verbo", label: "Verbo" },
  { value: "adjetivo", label: "Adjetivo" },
  { value: "adverbio", label: "Adverbio" },
  { value: "pronombre", label: "Pronombre" },
  { value: "interjección", label: "Interjección" },
  { value: "conjunción", label: "Conjunción" },
  { value: "preposición", label: "Preposición" },
  { value: "numeral", label: "Numeral" },
  { value: "frase", label: "Frase / Expresión" },
]

export const WORD_STATUSES = [
  { value: "DRAFT", label: "Borrador" },
  { value: "PUBLISHED", label: "Publicada" },
  { value: "ARCHIVED", label: "Archivada" },
]

export const VALID_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav", "audio/ogg", "audio/vorbis"]
export const VALID_AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg"]
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10 MB