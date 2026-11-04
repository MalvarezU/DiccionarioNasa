"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WordOfDayData } from "@/hooks/use-word-of-day";

interface HeroWordOfDayProps {
  word: WordOfDayData | null;
  date: string | null;
  /** Passed through from useWordOfDay; the hero stays badge-free by design. */
  isFromCache: boolean;
  onVerFicha: (id: string) => void;
}

function formatShortDate(date: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

const eyebrowClass =
  "font-sans text-xs font-semibold tracking-wide text-[#F6EEDC]/80";

function HeroAudioButton({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Keyed by src from the parent, so state resets with each new word.
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      const pending = audio.play();
      if (pending && typeof pending.then === "function") {
        pending.then(
          () => setIsPlaying(true),
          () => setIsPlaying(false),
        );
      } else {
        setIsPlaying(true);
      }
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying]);

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onEnded={() => setIsPlaying(false)}
      />
      <button
        type="button"
        onClick={toggleAudio}
        aria-label={label}
        aria-pressed={isPlaying}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F6EEDC] text-[#2F3E4E] shadow-lg transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Play className="ml-0.5 h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </>
  );
}

/**
 * Word-first hero block. The visible H1 doubles as the eyebrow so the page
 * heading stays stable ("Palabra del día") while the date rides along as
 * decorative, screen-reader-hidden text. The giant Nasa Yuwe word is a
 * paragraph with a test id — never a second H1.
 */
export function HeroWordOfDay({
  word,
  date,
  onVerFicha,
}: HeroWordOfDayProps) {
  const fecha = formatShortDate(date);

  // Sober offline/empty state — never null, never a gap.
  if (!word) {
    return (
      <div>
        <h1 className={eyebrowClass}>Palabra del día</h1>
        <p className="mt-4 max-w-xl font-serif text-2xl font-semibold leading-snug text-[#F6EEDC] sm:text-3xl">
          Hoy la palabra descansa — explorá el diccionario
        </p>
        <Link
          href="/diccionario"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-[#F6EEDC] underline decoration-[#F6EEDC]/40 underline-offset-4 transition-colors hover:decoration-[#F6EEDC] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary-container"
        >
          Explorar el diccionario
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className={eyebrowClass}>
        Palabra del día
        {fecha ? (
          <>
            {" "}
            <span aria-hidden="true">· {fecha}</span>
          </>
        ) : null}
      </h1>

      <p
        data-testid="hero-word"
        aria-label={`Palabra del día en Nasa Yuwe: ${word.nasaYuwe}`}
        className="mt-3 max-w-full break-words font-serif text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-[#F6EEDC]"
      >
        {word.nasaYuwe}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        {word.audioUrl ? (
          <HeroAudioButton
            key={word.audioUrl}
            src={word.audioUrl}
            label={`Escuchar pronunciación de ${word.nasaYuwe}`}
          />
        ) : null}

        <div className="min-w-0">
          <p className="text-xl font-medium leading-snug text-white">
            {word.spanish}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/70">
            {word.pronunciation ? (
              <span>[{word.pronunciation}]</span>
            ) : null}
            {word.category ? (
              <Badge
                variant="outline"
                className="border-[#F6EEDC]/40 bg-transparent text-xs font-medium text-[#F6EEDC]"
              >
                {word.category}
              </Badge>
            ) : null}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onVerFicha(word.id)}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-[#F6EEDC] underline decoration-[#F6EEDC]/40 underline-offset-4 transition-colors hover:decoration-[#F6EEDC] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary-container"
      >
        Ver ficha completa
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
