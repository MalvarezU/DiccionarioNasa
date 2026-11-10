"use client"

import { Mic, Search, Trash2, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "./confirm-dialog"
import { WordUploadDialog } from "./word-upload-dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AudioPicker } from "@/components/media/audio-picker"
import { SearchResultsSkeleton } from "@/components/skeletons"
import { compressToOpus } from "@/lib/audio/compress-audio"
import {
  useMediaWordsManager,
  type MediaManagerConfig,
} from "./use-media-words-manager"
import { MediaBulkCard, type MediaBulkCardTexts } from "./media-bulk-card"

const audioConfig: Extract<MediaManagerConfig, { field: "audioUrl" }> = {
  field: "audioUrl",
  filterParam: "audio",
  uploadEndpoint: "/api/admin/upload-audio",
  compress: async (file) => (await compressToOpus(file)).file,
  readUploadedUrl: (body) => (typeof body.audioUrl === "string" ? body.audioUrl : undefined),
  buildSavePayload: (url) => ({ audioUrl: url }),
  savedToast: "Audio guardado",
  removedToast: "Audio quitado",
}

const audioBulkTexts: MediaBulkCardTexts = {
  description:
    "Seleccioná varios audios: el nombre (sin extensión) debe coincidir con el español o nasa yuwe de la ficha. Se comprimen a Ogg 24kbps de a uno.",
  chooseLabel: "Elegir archivos",
  fileAccept: "audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg",
  fileInputAriaLabel: "Elegir audios para el lote",
  policyLabel: "Si la ficha ya tiene audio:",
  policySelectId: "bulk-policy-aud",
  keepTitle: "Conservar el audio actual",
  replaceTitle: "Reemplazar por el nuevo audio",
  existingBadge: "ya tiene audio",
  omittedWord: "omitidos",
  emptyHint: "Seleccioná archivos para previsualizar el lote y su estado.",
}

/**
 * Gestión de audios (/admin/audios): lista con filtros, mini-reproductor,
 * subida individual y subida en lote con matching por nombre de archivo.
 * Espejo del panel de ilustraciones; el audio se comprime a Ogg Opus
 * 24kbps mono en el cliente antes de subir.
 */
export function AudiosManager() {
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
  } = useMediaWordsManager(audioConfig)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground" htmlFor="audios-search">
            Buscar
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="audios-search"
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
          <label className="mb-1 block text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground" htmlFor="audios-filter">
            Audio
          </label>
          <select
            id="audios-filter"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter)
              resetPage()
            }}
          >
            <option value="without">Sin audio</option>
            <option value="with">Con audio</option>
            <option value="all">Todos</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground" htmlFor="audios-cat">
            Categoría
          </label>
          <Input
            id="audios-cat"
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

      {isInitialLoading ? (
        <div aria-busy="true" aria-label="Cargando fichas">
          <SearchResultsSkeleton count={5} />
        </div>
      ) : (
      <ul className="divide-y divide-outline-variant/20 rounded-2xl border border-outline-variant/30 bg-card">
        {words.map((w) => (
          <li key={w.id} className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/30 focus-within:bg-muted/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant/30 bg-primary/10">
              <Mic className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {w.spanish} <span className="font-normal text-muted-foreground">/ {w.nasaYuwe}</span>
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                {w.category ? <Badge variant="secondary" className="text-2xs">{w.category}</Badge> : null}
                {w.audioUrl ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary text-2xs">con audio</Badge>
                ) : (
                  <Badge variant="destructive" className="text-2xs">sin audio</Badge>
                )}
              </div>
              {w.audioUrl ? (
                <audio controls preload="none" src={w.audioUrl} className="mt-2 h-8 w-full max-w-xs" />
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPendingWord(w)} className="gap-1.5">
                <Volume2 className="h-3.5 w-3.5" />
                {w.audioUrl ? "Reemplazar" : "Subir"}
              </Button>
              {w.audioUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => setConfirmQuitar({ id: w.id, spanish: w.spanish })}
                  aria-label={`Quitar el audio de ${w.spanish}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </li>
        ))}
        {!loading && words.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">
            No hay fichas con estos filtros
          </li>
        ) : null}
      </ul>
      )}

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

      {pendingWord ? (
        <WordUploadDialog
          open
          onOpenChange={(v) => {
            if (!v) setPendingWord(null)
          }}
          titulo={`Audio para ${pendingWord.spanish} / ${pendingWord.nasaYuwe}`}
          saving={saving}
        >
          <AudioPicker
            onSubida={(url) => void saveMedia(pendingWord.id, url)}
            onCancelar={() => setPendingWord(null)}
          />
        </WordUploadDialog>
      ) : null}

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
        texts={audioBulkTexts}
        tone="primary"
      />
      <ConfirmDialog
        open={confirmQuitar !== null}
        onOpenChange={(v) => !v && setConfirmQuitar(null)}
        titulo={confirmQuitar ? `¿Quitar el audio de "${confirmQuitar.spanish}"?` : ""}
        descripcion="El audio se desasocia de la palabra. Esta acción no se puede deshacer."
        accionLabel="Quitar"
        onConfirm={() => {
          if (confirmQuitar) void saveMedia(confirmQuitar.id, null)
          setConfirmQuitar(null)
        }}
      />
    </div>
  )
}
