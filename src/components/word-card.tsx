"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play, Volume2 } from "lucide-react"

interface WordCardProps {
  word: {
    id: string
    spanish: string
    nasaYuwe: string
    pronunciation: string | null
    category: string | null
    audioUrl?: string | null
  }
  variant: "grid" | "row"
  onOpen: (id: string) => void
  onPlayState?: (playingId: string | null) => void
}

const CARD_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5E6B45]"
const CARD_HOVER = "hover:shadow-md hover:border-secondary/40"

/**
 * Tarjeta de palabra del diccionario. La card completa abre la ficha;
 * el botón de play es local a la card y nunca propaga el clic.
 * El padre garantiza un solo audio a la vez escuchando `onPlayState`.
 */
export function WordCard({ word, variant, onOpen, onPlayState }: WordCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const hasAudio = Boolean(word.audioUrl)

  // Stop playback if the card unmounts while sounding.
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  const togglePlay = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      const audio = audioRef.current
      if (!audio) return
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
        onPlayState?.(null)
      } else {
        void audio
          .play()
          .then(() => {
            setIsPlaying(true)
            onPlayState?.(word.id)
          })
          .catch(() => {
            setIsPlaying(false)
          })
      }
    },
    [isPlaying, onPlayState, word.id]
  )

  // Sync local state when playback stops from outside (parent pausing
  // other cards, or the track ending). No parent notification here: the
  // card that started the new playback already reported it.
  const handleAudioPause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false)
    onPlayState?.(null)
  }, [onPlayState])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        onOpen(word.id)
      }
    },
    [onOpen, word.id]
  )

  const playLabel = isPlaying
    ? "Pausar"
    : `Escuchar pronunciación de ${word.nasaYuwe}`

  const audioElement = hasAudio ? (
    <audio
      ref={audioRef}
      data-word-id={word.id}
      src={word.audioUrl ?? undefined}
      preload="none"
      className="hidden"
      aria-hidden="true"
      onPause={handleAudioPause}
      onEnded={handleAudioEnded}
    />
  ) : null

  if (variant === "row") {
    return (
      <article
        tabIndex={0}
        role="button"
        aria-label={`Ver ficha de ${word.nasaYuwe}`}
        onClick={() => onOpen(word.id)}
        onKeyDown={handleKeyDown}
        className={`flex cursor-pointer items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 ${CARD_HOVER} ${CARD_FOCUS}`}
      >
        {hasAudio && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playLabel}
            aria-pressed={isPlaying}
            className={`flex min-h-8 min-w-8 items-center justify-center rounded-full bg-secondary/10 transition-colors hover:bg-secondary/20 ${CARD_FOCUS}`}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-secondary" aria-hidden="true" />
            ) : (
              <Play
                className="ml-0.5 h-4 w-4 text-secondary"
                aria-hidden="true"
              />
            )}
          </button>
        )}
        <p className="min-w-0 flex-1 truncate">
          <span className="font-serif text-[17px] font-semibold text-primary">
            {word.nasaYuwe}
          </span>{" "}
          <span className="text-[13px] font-medium text-foreground">
            {word.spanish}
          </span>
        </p>
        {word.category && (
          <span className="inline-flex shrink-0 items-center rounded-full border border-tertiary/20 bg-tertiary-container px-1.5 py-px text-2xs font-medium text-tertiary">
            {word.category}
          </span>
        )}
        {audioElement}
      </article>
    )
  }

  return (
    <article
      tabIndex={0}
      role="button"
      aria-label={`Ver ficha de ${word.nasaYuwe}`}
      onClick={() => onOpen(word.id)}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer rounded-xl border border-outline-variant/30 bg-surface-container-low p-5 ${CARD_HOVER} ${CARD_FOCUS}`}
    >
      {(word.category || hasAudio) && (
        <div className="flex items-start justify-between gap-2">
          {word.category ? (
            <span className="inline-flex items-center rounded-full border border-tertiary/20 bg-tertiary-container px-2 py-0.5 text-2xs font-medium text-tertiary">
              {word.category}
            </span>
          ) : (
            <span />
          )}
          {hasAudio && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playLabel}
              aria-pressed={isPlaying}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-full bg-secondary/10 transition-colors hover:bg-secondary/20 ${CARD_FOCUS}`}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 text-secondary" aria-hidden="true" />
              ) : (
                <Play
                  className="ml-0.5 h-5 w-5 text-secondary"
                  aria-hidden="true"
                />
              )}
            </button>
          )}
        </div>
      )}
      <h3 className="mt-3 font-serif text-[28px] font-semibold leading-tight text-primary">
        {word.nasaYuwe}
      </h3>
      <p className="mt-1 text-[15px] font-medium text-foreground">
        {word.spanish}
      </p>
      {word.pronunciation && (
        <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground">
          <Volume2 className="h-3 w-3" aria-hidden="true" />[
          {word.pronunciation}]
        </p>
      )}
      {audioElement}
    </article>
  )
}
