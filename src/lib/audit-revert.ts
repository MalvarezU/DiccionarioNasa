/**
 * Helpers compartidos (browser-safe) para la bitácora y su reversión.
 *
 * - parseAuditChanges: normaliza los distintos shapes de `changes`
 *   (JSON string o null) a una lista de { label, before, after }.
 * - isRevertible: decisión de UI sobre si un log puede revertirse.
 *   El servidor valida igual (autoritativo); esto solo controla el botón.
 */

export interface AuditChangeRow {
  label: string
  before: unknown
  after: unknown
}

export interface ParsedAuditChanges {
  rows: AuditChangeRow[]
  summary: string | null // para CREATE/IMPORT/DELETE sin before/after
  responsable: string | null
}

export function parseAuditChanges(changes: string | null): ParsedAuditChanges {
  if (!changes) return { rows: [], summary: null, responsable: null }

  let parsed: unknown
  try {
    parsed = JSON.parse(changes)
  } catch {
    return { rows: [], summary: changes, responsable: null }
  }
  if (!parsed || typeof parsed !== "object") {
    return { rows: [], summary: String(parsed), responsable: null }
  }

  const obj = parsed as Record<string, unknown>
  const responsable = typeof obj.responsable === "string" ? obj.responsable : null

  const rows: AuditChangeRow[] = []

  // Shape 1: field-level { before, after }
  for (const [key, val] of Object.entries(obj)) {
    if (key === "responsable") continue
    if (val && typeof val === "object" && "before" in (val as object) && "after" in (val as object)) {
      rows.push({ label: key, before: (val as { before: unknown }).before, after: (val as { after: unknown }).after })
    }
  }

  // Shape 2: user role { field, from, to }
  if (typeof obj.field === "string" && "from" in obj && "to" in obj) {
    rows.push({ label: obj.field, before: obj.from, after: obj.to })
  }

  // Shape 3: bulk-status anidado { status: {before, after} } ya cubierto por Shape 1.

  // Summary para CREATE/IMPORT/DELETE/snapshot
  let summary: string | null = null
  if (obj.deleted && typeof obj.deleted === "object") {
    const d = obj.deleted as Record<string, unknown>
    summary = `Eliminada: ${d.spanish ?? "?"} / ${d.nasaYuwe ?? "?"}`
  } else if (typeof obj.spanish === "string" || typeof obj.nasaYuwe === "string") {
    summary = `Creada: ${obj.spanish ?? "?"} / ${obj.nasaYuwe ?? "?"}${obj.status ? ` (${obj.status})` : ""}`
  } else if (obj.restored && typeof obj.restored === "object") {
    summary = "Cambio revertido"
  }

  return { rows, summary, responsable }
}

export function isRevertible(log: { action: string; entity: string; changes: string | null }): boolean {
  if (log.entity === "DictionaryWord") {
    if (log.action === "CREATE" || log.action === "IMPORT") return true
    if (log.action === "DELETE") {
      // Solo si hay snapshot completo (versiones nuevas del log)
      try {
        const c = log.changes ? JSON.parse(log.changes) : null
        const d = c?.deleted
        return !!(d && typeof d.spanish === "string" && typeof d.nasaYuwe === "string" && Object.keys(d).length >= 4)
      } catch {
        return false
      }
    }
    if (log.action === "UPDATE" || log.action === "PUBLISH" || log.action === "ARCHIVE") return true
  }
  if (log.entity === "User" && log.action === "UPDATE") {
    try {
      const c = log.changes ? JSON.parse(log.changes) : null
      return c?.field === "role"
    } catch {
      return false
    }
  }
  return false
}

export function isReverted(changes: string | null): boolean {
  try {
    const c = changes ? JSON.parse(changes) : null
    return c?.action === "REVERT" || c?.originalLogId !== undefined
  } catch {
    return false
  }
}

export function revertedOriginalId(changes: string | null): string | null {
  try {
    const c = changes ? JSON.parse(changes) : null
    return typeof c?.originalLogId === "string" ? c.originalLogId : null
  } catch {
    return null
  }
}

