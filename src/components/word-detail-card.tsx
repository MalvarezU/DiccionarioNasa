"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BookOpen,
  Volume2,
  Heart,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AudioPlayer } from "@/components/audio-player";
import { useToast } from "@/hooks/use-toast";

interface WordDetail {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation: string | null;
  audioUrl: string | null;
  culturalContext: string | null;
  category: string | null;
  examples: Array<{ spanish: string; nasaYuwe: string }> | null;
}

interface WordDetailCardProps {
  wordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WordDetailCard({
  wordId,
  open,
  onOpenChange,
}: WordDetailCardProps) {
  const [word, setWord] = useState<WordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const { toast } = useToast();

  // Fetch word details when opened
  useEffect(() => {
    if (!wordId || !open) {
      setWord(null);
      return;
    }

    const fetchWord = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/dictionary/words/${wordId}`);
        if (response.ok) {
          const data = await response.json();
          setWord(data);
        } else {
          setWord(null);
        }
      } catch {
        setWord(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWord();
  }, [wordId, open]);

  const handleToggleFavorite = useCallback(async () => {
    // For now, toggle locally. Will be connected to auth in Epic 2.
    setIsFavorite((prev) => !prev);

    if (!isFavorite) {
      toast({
        title: "Añadido a favoritos",
        description: "La palabra se guardará en tu perfil cuando inicies sesión.",
      });
    } else {
      toast({
        title: "Eliminado de favoritos",
        description: "La palabra se eliminará de tus favoritos.",
      });
    }
  }, [isFavorite, toast]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : word ? (
          <>
            <SheetHeader className="pb-0">
              {/* Category badge */}
              {word.category && (
                <Badge
                  variant="secondary"
                  className="w-fit mb-2 text-xs"
                >
                  {word.category}
                </Badge>
              )}

              {/* HU1.2.1 — Spanish word as MAIN title */}
              <SheetTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                {word.spanish}
              </SheetTitle>

              {/* HU1.2.1 — Nasa Yuwe translation prominently displayed */}
              <div className="mt-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground">Nasa Yuwe:</span>
                <span className="text-xl font-semibold text-primary">
                  {word.nasaYuwe || "Traducción no disponible aún"}
                </span>
              </div>
            </SheetHeader>

            <div className="mt-6 flex flex-col gap-5 px-1">
              {/* HU1.2.2 — Phonetic pronunciation */}
              {word.pronunciation ? (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <Volume2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
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

              {/* HU1.2.3 — Audio player */}
              <AudioPlayer
                src={word.audioUrl}
                wordLabel={word.nasaYuwe}
              />

              <Separator />

              {/* Cultural context */}
              {word.culturalContext && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    Contexto cultural
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {word.culturalContext}
                  </p>
                </div>
              )}

              {/* Examples */}
              {word.examples && word.examples.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Ejemplos de uso
                  </h3>
                  <div className="flex flex-col gap-2">
                    {word.examples.map((ex, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-muted/30 border border-border/30"
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
                </div>
              )}

              <Separator />

              {/* HU1.2.4 — Favorite button */}
              <Button
                variant={isFavorite ? "default" : "outline"}
                className="w-full gap-2"
                onClick={handleToggleFavorite}
              >
                <Heart
                  className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`}
                />
                {isFavorite
                  ? "Eliminado de favoritos"
                  : "Añadir a favoritos"}
              </Button>

              {isFavorite && word.audioUrl && (
                <p className="text-xs text-muted-foreground text-center -mt-3">
                  💾 El audio se descargará para uso sin conexión
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">No se encontró la palabra</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
