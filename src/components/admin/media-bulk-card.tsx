"use client"

import { Loader2, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  bulkActionFor,
  type BulkPolicy,
  type BulkRowDecision,
} from "@/lib/media/bulk-policy"
import type { MediaBulkDone, MediaBulkRow } from "./use-media-words-manager"

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
  texts,
  tone = "primary",
}: MediaBulkCardProps) {
  const toneChip = tone === "tertiary" ? "bg-tertiary/10 text-tertiary" : "bg-primary/10 text-primary"
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
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="border-t px-5 py-4 text-xs text-muted-foreground">{texts.emptyHint}</p>
      )}
    </div>
  )
}
