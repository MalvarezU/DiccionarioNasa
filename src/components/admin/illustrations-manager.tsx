"use client"

import { ImagePlus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "./confirm-dialog"
import { WordUploadDialog } from "./word-upload-dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MediaPicker } from "@/components/media/media-picker"
import { IllustrationLightbox } from "@/components/media/illustration-lightbox"
import { SearchResultsSkeleton } from "@/components/skeletons"
import { compressToIllustration } from "@/lib/media/compress-image"
import {
  useMediaWordsManager,
  type MediaManagerConfig,
} from "./use-media-words-manager"
import { MediaBulkCard, type MediaBulkCardTexts } from "./media-bulk-card"

const illustrationConfig: Extract<MediaManagerConfig, { field: "illustrationUrl" }> = {
  field: "illustrationUrl",
  filterParam: "illustration",
  uploadEndpoint: "/api/admin/upload-image",
  compress: compressToIllustration,
  readUploadedUrl: (body) => (typeof body.url === "string" ? body.url : undefined),
  buildSavePayload: (url) => ({ illustrationUrl: url }),
  savedToast: "Ilustración guardada",
  removedToast: "Ilustración quitada",
}

const illustrationBulkTexts: MediaBulkCardTexts = {
  description:
    "Seleccioná varias imágenes: el nombre (sin extensión) debe coincidir con el español o nasa yuwe de la ficha. Se recortan a cuadrado 512×512 y se comprimen a WebP de a una.",
  chooseLabel: "Elegir imágenes",
  fileAccept: "image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif",
  fileInputAriaLabel: "Elegir imágenes para el lote",
  policyLabel: "Si la ficha ya tiene imagen:",
  policySelectId: "bulk-policy-ilus",
  keepTitle: "Conservar la imagen actual",
  replaceTitle: "Reemplazar por la nueva imagen",
  existingBadge: "ya tiene ilustración",
  omittedWord: "omitidas",
  emptyHint: "Seleccioná archivos para previsualizar el lote y su estado.",
}

/**
 * Gestión de ilustraciones (/admin/ilustraciones): lista con filtros, subida
 * individual por ficha y subida en lote con matching por nombre de archivo.
 */
export function IllustrationsManager() {
  const {
    words,
    total,
    totalPages,
    page,
    setPage,
    search,
    setSearch,
    filter,
    setFilter,
    category,
    setCategory,
    loading,
    isInitialLoading,
    error,
    pendingWord,
    setPendingWord,
    confirmQuitar,
    setConfirmQuitar,
    saving,
    bulk,
    bulkPolicy,
    setBulkPolicy,
    bulkRunning,
    bulkDone,
    resetPage,
    saveMedia,
    prepareBulk,
    runBulk,
    setRowDecision,
    searchBulkWords,
    assignBulkWord,
    removeBulkRow,
  } = useMediaWordsManager(illustrationConfig)

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground" htmlFor="ilus-search">
            Buscar
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="ilus-search"
              className="pl-8"
              placeholder="español o nasa yuwe…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetPage()
              }}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground" htmlFor="ilus-filter">
            Ilustración
          </label>
          <select
            id="ilus-filter"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter)
              resetPage()
            }}
          >
            <option value="without">Sin ilustración</option>
            <option value="with">Con ilustración</option>
            <option value="all">Todas</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground" htmlFor="ilus-cat">
            Categoría
          </label>
          <Input
            id="ilus-cat"
            placeholder="sustantivo…"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              resetPage()
            }}
            className="w-36"
          />
        </div>
        <p className="pb-2 text-sm text-muted-foreground" aria-live="polite">
          {loading ? "Cargando…" : `${total} fichas`}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Lista */}
      {isInitialLoading ? (
        <div aria-busy="true" aria-label="Cargando fichas">
          <SearchResultsSkeleton count={5} />
        </div>
      ) : (
      <ul className="divide-y divide-outline-variant/20 rounded-2xl border border-outline-variant/30 bg-card">
        {words.map((w) => (
          <li key={w.id} className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/30 focus-within:bg-muted/30">
            {w.illustrationUrl ? (
              <IllustrationLightbox url={w.illustrationUrl} alt={`${w.spanish}`} thumbSize={64} />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-outline-variant/30 bg-tertiary/10 text-xs text-tertiary">
                sin imagen
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {w.spanish} <span className="font-normal text-muted-foreground">/ {w.nasaYuwe}</span>
              </p>
              <div className="mt-1 flex gap-1.5">
                {w.category ? <Badge variant="secondary" className="text-2xs">{w.category}</Badge> : null}
                {w.illustrationUrl ? (
                  <Badge variant="outline" className="bg-tertiary/10 text-tertiary text-2xs">con ilustración</Badge>
                ) : (
                  <Badge variant="destructive" className="text-2xs">sin ilustración</Badge>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPendingWord(w)} className="gap-1.5">
                <ImagePlus className="h-3.5 w-3.5" />
                {w.illustrationUrl ? "Reemplazar" : "Subir"}
              </Button>
              {w.illustrationUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => setConfirmQuitar({ id: w.id, spanish: w.spanish })}
                  aria-label={`Quitar la ilustración de ${w.spanish}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </li>
        ))}
        {!loading && words.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">
            No hay fichas con estos filtros.
          </li>
        ) : null}
      </ul>
      )}

      {/* Paginación */}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </Button>
      </div>

      {/* Subida individual */}
      {pendingWord ? (
        <WordUploadDialog
          open
          onOpenChange={(v) => {
            if (!v) setPendingWord(null)
          }}
          titulo={`Ilustración para ${pendingWord.spanish} / ${pendingWord.nasaYuwe}`}
          saving={saving}
        >
          <MediaPicker
            variant="illustration"
            etiqueta={`Elegir imagen (cuadrada 1:1 · ${pendingWord.spanish})`}
            onSubida={(url) => void saveMedia(pendingWord.id, url)}
            onCancelar={() => setPendingWord(null)}
          />
        </WordUploadDialog>
      ) : null}

      {/* Lote */}
      <MediaBulkCard
        bulk={bulk}
        bulkPolicy={bulkPolicy}
        bulkRunning={bulkRunning}
        bulkDone={bulkDone}
        onChooseFiles={(files) => void prepareBulk(files)}
        onPolicyChange={setBulkPolicy}
        onRun={() => void runBulk()}
        onRowDecision={setRowDecision}
        onSearchWords={searchBulkWords}
        onAssignWord={assignBulkWord}
        onRemoveRow={removeBulkRow}
        texts={illustrationBulkTexts}
        tone="tertiary"
      />
          <ConfirmDialog
        open={confirmQuitar !== null}
        onOpenChange={(v) => !v && setConfirmQuitar(null)}
        titulo={confirmQuitar ? `¿Quitar la ilustración de "${confirmQuitar.spanish}"?` : ""}
        descripcion="La ilustración se desasocia de la palabra. Esta acción no se puede deshacer."
        accionLabel="Quitar"
        onConfirm={() => {
          if (confirmQuitar) void saveMedia(confirmQuitar.id, null)
          setConfirmQuitar(null)
        }}
      />
</div>
  )
}
