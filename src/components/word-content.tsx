"use client";

import {
  BookOpen,
  Volume2,
  Heart,
  Loader2,
  MessageCircle,
  Tag,
  LogIn,
  Download,
  CloudOff,
  HardDrive,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WordDetailSkeleton } from "@/components/skeletons"
import { WordIllustration } from "@/components/dictionary/word-illustration"
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AudioPlayer } from "@/components/audio-player";
import { getCategoryDisplay, type WordDetail } from "./word-detail";

interface WordContentProps {
  word: WordDetail | null;
  isLoading: boolean;
  categories: string[];
  isFavorite: boolean;
  isTogglingFav: boolean;
  isAuthenticated: boolean;
  isOnline: boolean;
  audioSrc: string | null;
  isCached: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  storageInfo: { percentUsed: number; usedMB: number; quotaMB: number } | null;
  onToggleFavorite: () => void;
  onLoginClick: () => void;
}

export function WordContent({
  word,
  isLoading,
  categories,
  isFavorite,
  isTogglingFav,
  isAuthenticated,
  isOnline,
  audioSrc,
  isCached,
  isDownloading,
  downloadProgress,
  storageInfo,
  onToggleFavorite,
  onLoginClick,
}: WordContentProps) {
  if (isLoading) {
    return <WordDetailSkeleton layout="wide" />;
  }

  if (!word) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">No se encontró la palabra</p>
      </div>
    );
  }

  // Sin ilustración la grilla colapsa a una sola columna: WordIllustration
  // retorna null y no se reserva su hueco (misma regla que el skeleton).
  const hasIllustration = Boolean(word.illustrationUrl);

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:max-h-[88dvh]",
        hasIllustration && "md:grid-cols-[5fr_7fr]"
      )}
    >
      {/* Columna izquierda (desktop): ilustración grande y fija. En móvil
          sigue apilada arriba con el mismo tamaño de antes. */}
      {hasIllustration && (
        <div className="md:sticky md:top-0 md:self-start md:p-8 md:pr-4">
          <WordIllustration
            url={word.illustrationUrl}
            alt={word.spanish}
            sizes="(max-width: 768px) 100vw, 480px"
            className="mx-auto mb-4 w-full max-w-[16rem] md:mb-0 md:max-w-none"
          />
        </div>
      )}

      {/* Columna derecha: la ficha. Solo scrollea como red de seguridad
          (contexto largo, muchos ejemplos); la ficha típica entra sin scroll. */}
      <div className="md:min-h-0 md:overflow-y-auto md:p-8 md:pl-4">
      {/* Category badges */}
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant="secondary"
              className="text-xs gap-1 bg-surface-container-highest text-foreground hover:bg-secondary-container transition-colors cursor-pointer"
            >
              <Tag className="h-3 w-3" />
              {getCategoryDisplay(cat)}
            </Badge>
          ))}
        </div>
      ) : (
        <Badge
          variant="outline"
          className="w-fit mb-2 text-xs text-muted-foreground bg-surface-container-highest"
        >
          Categoría desconocida
        </Badge>
      )}

      {/* Spanish word as MAIN title */}
      <div className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-primary">
        {word.spanish}
      </div>

      {/* Nasa Yuwe translation prominently displayed */}
      <div className="mt-2 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm text-muted-foreground">Nasa Yuwe:</span>
        <span className="font-serif text-xl font-semibold text-primary">
          {word.nasaYuwe || "Traducción no disponible aún"}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-5">
        {/* Phonetic pronunciation */}
        {word.pronunciation ? (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/5 border border-secondary/20">
            <Volume2 className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                Pronunciación fonética
              </p>
              <p className="text-lg font-medium text-foreground tracking-wide">
                [{word.pronunciation}]
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Pronunciación no disponible
            </p>
          </div>
        )}

        {/* Audio player (uses offline audio src if cached) */}
        <AudioPlayer
          src={audioSrc}
          wordLabel={word.nasaYuwe}
          isCached={isCached}
        />

        {/* Offline audio cache status */}
        {word.audioUrl && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-gradient-to-br from-surface-container-high to-surface-container-low border border-outline-variant/30">
            {isDownloading ? (
              <>
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary animate-bounce" />
                  <span className="text-xs text-muted-foreground">
                    Descargando audio para uso sin conexión...
                  </span>
                </div>
                <Progress value={downloadProgress} className="h-1.5" />
              </>
            ) : isCached ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                <span className="text-xs text-muted-foreground">
                  Audio disponible sin conexión
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CloudOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {!isOnline
                    ? "Audio disponible solo en línea o guardando como favorita cuando tengas conexión"
                    : "Audio no almacenado — marca como favorito para descargar"}
                </span>
              </div>
            )}

            {/* Storage warning when > 50% used */}
            {storageInfo && storageInfo.percentUsed > 50 && (
              <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border/30">
                <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={`text-2xs ${storageInfo.percentUsed > 80 ? "text-destructive" : "text-muted-foreground"}`}>
                  Almacenamiento: {storageInfo.usedMB.toFixed(1)} MB / {storageInfo.quotaMB.toFixed(0)} MB ({storageInfo.percentUsed.toFixed(0)}%)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Cultural context */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-tertiary" />
            Contexto cultural
          </h3>
          {word.culturalContext ? (
            <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-terracota pl-3">
              {word.culturalContext}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Sin información contextual disponible
            </p>
          )}
        </div>

        {/* Examples */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Ejemplos de uso
          </h3>
          {word.examples && word.examples.length > 0 ? (
            <div className="flex flex-col gap-2">
              {word.examples.map((ex, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-surface-container-high border-l-2 border-terracota"
                >
                  <p className="text-sm text-foreground font-medium">
                    {ex.spanish}
                  </p>
                  <p className="text-sm text-primary mt-0.5">
                    {ex.nasaYuwe}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No hay ejemplos de uso disponibles
            </p>
          )}
        </div>

        {/* Favorite button */}
        <div className="flex flex-col gap-2 pb-2">
          <Button
            key={isFavorite ? "favorito" : "no-favorito"}
            variant={isFavorite ? "default" : "outline"}
            className={`w-full gap-2 transition-colors ${isFavorite ? "bg-secondary hover:bg-secondary/90 anim-match-pop" : "hover:border-tertiary/50 hover:text-tertiary"}`}
            onClick={onToggleFavorite}
            disabled={isTogglingFav || isDownloading}
          >
            {isTogglingFav ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart
                className={`h-4 w-4 ${isFavorite ? "fill-terracota text-terracota" : ""}`}
              />
            )}
            {isFavorite
              ? "Quitar de favoritos"
              : "Guardar en favoritos"}
          </Button>

          {/* Show login hint for non-authenticated users */}
          {!isAuthenticated && (
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={onLoginClick}
            >
              <LogIn className="h-3 w-3" />
              Inicia sesión para guardar favoritos
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
