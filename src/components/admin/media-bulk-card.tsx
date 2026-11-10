"use client"

import { useState } from "react"
import { Loader2, Search, UploadCloud, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  bulkActionFor,
  type BulkPolicy,
  type BulkRowDecision,
} from "@/lib/media/bulk-policy"
import { normalizeStem } from "@/lib/media/bulk-match"
import type { BulkAssignCandidate, MediaBulkDone, MediaBulkRow } from "./use-media-words-manager"

export interface MediaBulkCardTexts {
  description: string
  chooseLabel: string
  fileAccept: string
  fileInputAriaLabel: string
  policyLabel: string
  policySelectId: string
  keepTitle: string
  replaceTitle: string
  /** "omitidos" (audios) u "omitidas" (ilustraciones): el copy de cada panel. */
  omittedWord: string
  /** "ya tiene audio" / "ya tiene ilustración": badge en los candidatos del modal. */
  existingBadge: string
  emptyHint: string
}

export interface MediaBulkCardProps {
  bulk: MediaBulkRow[]
  bulkPolicy: BulkPolicy
  bulkRunning: boolean
  bulkDone: MediaBulkDone | null
  onChooseFiles: (files: FileList | null) => void
  onPolicyChange: (policy: BulkPolicy) => void
  onRun: () => void
  onRowDecision: (index: number, decision: BulkRowDecision) => void
  /** Búsqueda del modal de asignación (filtrada por el hook, en memoria). */
  onSearchWords: (query: string) => BulkAssignCandidate[]
  /** Elección del modal: index de la fila + id de la ficha elegida. */
  onAssignWord: (index: number, wordId: string) => void
  /** Quita una fila del lote (archivo que no corresponde). */
  onRemoveRow: (index: number) => void
  texts: MediaBulkCardTexts
  /**
   * Section identity tone, derived from the manager's config.field
   * (audioUrl → "primary", illustrationUrl → "tertiary"). Optional to
   * keep existing callers working; defaults to "primary".
   */
  tone?: "primary" | "tertiary"
}

/**
 * Tarjeta de subida en lote compartida por los paneles de audios e
 * ilustraciones: mismos tokens de estado (secondary/destructive/primary/
 * tertiary), solo cambian los textos que recibe por props y el tono de
 * identidad del header (`tone`, derivado del config.field de cada panel).
 *
 * Las filas sin coincidencia (o ambiguas) ofrecen asignación manual: un
 * modal con buscador sobre el diccionario; la fila elegida entra al mismo
 * "Subir lote" con la política vigente.
 */
export function MediaBulkCard({
  bulk,
  bulkPolicy,
  bulkRunning,
  bulkDone,
  onChooseFiles,
  onPolicyChange,
  onRun,
  onRowDecision,
  onSearchWords,
  onAssignWord,
  onRemoveRow,
  texts,
  tone = "primary",
}: MediaBulkCardProps) {
  const toneChip = tone === "tertiary" ? "bg-tertiary/10 text-tertiary" : "bg-primary/10 text-primary"

  // Índice de la fila que está asignando (null = modal cerrado).
  const [assignIndex, setAssignIndex] = useState<number | null>(null)
  const [query, setQuery] = useState("")
  const asignando = assignIndex !== null ? bulk[assignIndex] : null
  const candidatos = assignIndex !== null ? onSearchWords(query) : []

  function abrirModal(index: number) {
    // Precarga la búsqueda con el stem del archivo: en filas ambiguas los
    // candidatos conflictivos aparecen primero; en sin coincidencia ayuda
    // si el nombre se parece a la ficha.
    setQuery(normalizeStem(bulk[index]?.file.name ?? ""))
    setAssignIndex(index)
  }

  function elegir(wordId: string) {
    if (assignIndex !== null) onAssignWord(assignIndex, wordId)
    setAssignIndex(null)
    setQuery("")
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 border-b bg-muted/30 px-5 py-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneChip}`}>
          <UploadCloud className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Subida en lote</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{texts.description}</p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-muted/20 px-3 py-2 text-xs font-medium transition-colors hover:bg-muted/40">
          <UploadCloud className="h-4 w-4 text-muted-foreground" />
          <span>{texts.chooseLabel}</span>
          <input
            type="file"
            accept={texts.fileAccept}
            multiple
            onChange={(e) => void onChooseFiles(e.target.files)}
            className="sr-only"
            aria-label={texts.fileInputAriaLabel}
            disabled={bulkRunning}
          />
        </label>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor={texts.policySelectId}>
            {texts.policyLabel}
          </label>
          <select
            id={texts.policySelectId}
            className="h-9 rounded-md border bg-background px-2 text-xs"
            value={bulkPolicy}
            onChange={(e) => onPolicyChange(e.target.value as BulkPolicy)}
            disabled={bulkRunning}
          >
            <option value="skip-existing">Omitir (no toca lo existente)</option>
            <option value="replace-all">Reemplazar todos</option>
            <option value="per-row">Decidir uno por uno</option>
          </select>
        </div>

        <Button
          type="button"
          size="sm"
          disabled={
            bulkRunning ||
            !bulk.some((b) => bulkActionFor(b, bulkPolicy) === "subir" && b.status !== "ok")
          }
          onClick={() => void onRun()}
          className="ml-auto"
        >
          {bulkRunning ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
          Subir lote
        </Button>
      </div>

      {/* Lista */}
      {bulk.length > 0 ? (
        <div className="border-t">
          <ul className="max-h-72 divide-y divide-border overflow-auto">
            {bulk.map((b, i) => {
              const accion = bulkActionFor(b, bulkPolicy)
              return (
                <li key={`${b.file.name}-${i}`} className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-muted/30">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{b.file.name}</span>
                  {b.wordLabel ? (
                    <span className="truncate text-xs text-muted-foreground">→ {b.wordLabel}</span>
                  ) : (
                    <span className="text-xs font-medium text-destructive">→ {b.reason}</span>
                  )}
                  {b.reason !== null ? (
                    <span className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => abrirModal(i)}
                        aria-label={`Asignar ${b.file.name}`}
                      >
                        Asignar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => onRemoveRow(i)}
                        aria-label={`Quitar ${b.file.name} del lote`}
                        title="Quitar del lote"
                      >
                        Quitar
                      </Button>
                    </span>
                  ) : b.assigned ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-2 text-xs"
                      onClick={() => abrirModal(i)}
                      aria-label={`Cambiar asignación de ${b.file.name}`}
                    >
                      Cambiar
                    </Button>
                  ) : null}
                  {b.wordId && b.hasExisting && bulkPolicy === "per-row" && b.status === "pendiente" ? (
                    <span className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant={b.decision === "omitir" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => onRowDecision(i, "omitir")}
                        title={texts.keepTitle}
                      >
                        Omitir
                      </Button>
                      <Button
                        type="button"
                        variant={b.decision === "subir" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => onRowDecision(i, "subir")}
                        title={texts.replaceTitle}
                      >
                        Reemplazar
                      </Button>
                    </span>
                  ) : null}
                  <span
                    className={
                      "w-24 shrink-0 text-right text-xs font-medium " +
                      (b.status === "ok"
                        ? "text-secondary"
                        : b.status === "error"
                          ? "text-destructive"
                          : b.status === "subiendo"
                            ? "text-primary"
                            : accion === "omitir" && b.wordId
                              ? "text-tertiary"
                              : "text-muted-foreground")
                    }
                  >
                    {b.status === "ok"
                      ? "✓ listo"
                      : b.status === "error"
                        ? `✗ ${b.detail ?? ""}`
                        : b.status === "subiendo"
                          ? "…subiendo"
                          : accion === "omitir" && b.wordId
                            ? "⊘ ya tiene"
                            : "pendiente"}
                  </span>
                </li>
              )
            })}
          </ul>

          {bulkDone ? (
            <div className="border-t bg-muted/30 px-5 py-3 text-sm" aria-live="polite">
              <p className="text-sm">
                Lote terminado: {bulkDone.ok} subidas, {bulkDone.omitidos} {texts.omittedWord},{" "}
                {bulkDone.errores} errores.
                {bulkDone.sinAsignar > 0 ? (
                  <span className="font-medium text-destructive"> {bulkDone.sinAsignar} sin asignar.</span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="border-t px-5 py-4 text-xs text-muted-foreground">{texts.emptyHint}</p>
      )}

      {/* Modal de asignación manual */}
      <Dialog open={assignIndex !== null} onOpenChange={(v) => (!v ? setAssignIndex(null) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar ficha</DialogTitle>
            <DialogDescription className="truncate font-mono text-xs">
              {asignando?.file.name ?? ""}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nasa Yuwe o Español…"
              className="pl-9"
              aria-label="Buscar ficha para asignar"
              autoFocus
            />
          </div>

          {query.trim().length > 0 && candidatos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resultados para “{query.trim()}”.</p>
          ) : null}

          {candidatos.length > 0 ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {candidatos.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => elegir(c.id)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-container-high"
                  >
                    <span className="font-serif font-bold text-primary">{c.nasaYuwe}</span>
                    <span className="text-muted-foreground">⇄ {c.spanish}</span>
                    {c.category ? <Badge variant="secondary">{c.category}</Badge> : null}
                    {c.hasExisting ? <Badge variant="outline">{texts.existingBadge}</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-xs text-muted-foreground"
            onClick={() => setAssignIndex(null)}
          >
            <X className="mr-1 h-3 w-3" /> Cancelar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
