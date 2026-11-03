import { describe, it, expect } from "vitest"
import {
  parseAuditChanges,
  isRevertible,
  revertedOriginalId,
} from "@/lib/audit-revert"

describe("audit-revert helpers", () => {
  it("parsea shape field-level {before, after}", () => {
    const c = JSON.stringify({ category: { before: "sustantivo", after: "verbo" }, responsable: "admin" })
    const r = parseAuditChanges(c)
    expect(r.rows).toEqual([{ label: "category", before: "sustantivo", after: "verbo" }])
    expect(r.responsable).toBe("admin")
    expect(r.summary).toBeNull()
  })

  it("parsea shape user role {field, from, to}", () => {
    const c = JSON.stringify({ field: "role", from: "user", to: "editor", responsable: "admin" })
    const r = parseAuditChanges(c)
    expect(r.rows).toEqual([{ label: "role", before: "user", after: "editor" }])
  })

  it("parsea bulk-status anidado {status:{before,after}}", () => {
    const c = JSON.stringify({ status: { before: "DRAFT", after: "PUBLISHED" }, responsable: "admin" })
    const r = parseAuditChanges(c)
    expect(r.rows).toEqual([{ label: "status", before: "DRAFT", after: "PUBLISHED" }])
  })

  it("summary para CREATE/IMPORT", () => {
    const c = JSON.stringify({ spanish: "Casa", nasaYuwe: "Yat", status: "DRAFT" })
    const r = parseAuditChanges(c)
    expect(r.rows).toEqual([])
    expect(r.summary).toContain("Casa")
    expect(r.summary).toContain("DRAFT")
  })

  it("summary para DELETE con snapshot", () => {
    const c = JSON.stringify({ deleted: { spanish: "Sol", nasaYuwe: "Sek", status: "PUBLISHED" }, responsable: "admin" })
    const r = parseAuditChanges(c)
    expect(r.summary).toContain("Eliminada")
    expect(r.summary).toContain("Sol")
  })

  it("summary para REVERT", () => {
    const c = JSON.stringify({ originalLogId: "abc", restored: { category: "sustantivo" }, responsable: "admin" })
    const r = parseAuditChanges(c)
    expect(r.summary).toBe("Cambio revertido")
  })

  it("JSON malformado devuelve el texto crudo como summary", () => {
    const r = parseAuditChanges("{bad")
    expect(r.rows).toEqual([])
    expect(r.summary).toBe("{bad")
  })

  it("null devuelve vacío", () => {
    const r = parseAuditChanges(null)
    expect(r.rows).toEqual([])
    expect(r.summary).toBeNull()
    expect(r.responsable).toBeNull()
  })

  it("isRevertible: UPDATE/PUBLISH/ARCHIVE de palabra", () => {
    for (const a of ["UPDATE", "PUBLISH", "ARCHIVE"]) {
      expect(isRevertible({ action: a, entity: "DictionaryWord", changes: "{}" })).toBe(true)
    }
  })

  it("isRevertible: CREATE/IMPORT", () => {
    expect(isRevertible({ action: "CREATE", entity: "DictionaryWord", changes: "{}" })).toBe(true)
    expect(isRevertible({ action: "IMPORT", entity: "DictionaryWord", changes: "{}" })).toBe(true)
  })

  it("isRevertible: DELETE solo con snapshot completo", () => {
    const full = JSON.stringify({ deleted: { spanish: "S", nasaYuwe: "N", status: "D", category: "c" } })
    const partial = JSON.stringify({ deleted: { spanish: "S", nasaYuwe: "N" } })
    expect(isRevertible({ action: "DELETE", entity: "DictionaryWord", changes: full })).toBe(true)
    expect(isRevertible({ action: "DELETE", entity: "DictionaryWord", changes: partial })).toBe(false)
    expect(isRevertible({ action: "DELETE", entity: "DictionaryWord", changes: null })).toBe(false)
  })

  it("isRevertible: User UPDATE solo si es rol", () => {
    const role = JSON.stringify({ field: "role", from: "user", to: "editor" })
    const other = JSON.stringify({ field: "name", from: "a", to: "b" })
    expect(isRevertible({ action: "UPDATE", entity: "User", changes: role })).toBe(true)
    expect(isRevertible({ action: "UPDATE", entity: "User", changes: other })).toBe(false)
  })

  it("isRevertible: User DELETE no reversible", () => {
    expect(isRevertible({ action: "DELETE", entity: "User", changes: "{}" })).toBe(false)
  })

  it("isRevertible: REVERT no reversible (ya es reversión)", () => {
    expect(isRevertible({ action: "REVERT", entity: "DictionaryWord", changes: "{}" })).toBe(false)
  })

  it("revertedOriginalId extrae el id original de un log REVERT", () => {
    const c = JSON.stringify({ originalLogId: "abc-123", restored: {} })
    expect(revertedOriginalId(c)).toBe("abc-123")
    expect(revertedOriginalId(null)).toBeNull()
    expect(revertedOriginalId("{bad")).toBeNull()
  })
})

