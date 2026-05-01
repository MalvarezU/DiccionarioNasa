"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
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
  Tag,
  LogIn,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AudioPlayer } from "@/components/audio-player";
import { AuthModal } from "@/components/auth-modal";
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

// Category display labels (Spanish)
const CATEGORY_LABELS: Record<string, string> = {
  sustantivo: "Sustantivo",
  verbo: "Verbo",
  adjetivo: "Adjetivo",
  numeral: "Numeral",
  adverbio: "Adverbio",
  pronombre: "Pronombre",
  preposicion: "Preposición",
  conjuncion: "Conjunción",
  interjeccion: "Interjección",
};

/**
 * Parse category string that may contain multiple categories
 * separated by commas (e.g., "sustantivo, verbo")
 */
function parseCategories(category: string | null): string[] {
  if (!category) return [];
  return category
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Get display label for a category key
 */
function getCategoryDisplay(cat: string): string {
  return CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

export function WordDetailCard({
  wordId,
  open,
  onOpenChange,
}: WordDetailCardProps) {
  const [word, setWord] = useState<WordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFav, setIsTogglingFav] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const isAuthenticated = !!session?.user;

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

  // Check favorite status when word loads and user is authenticated
  useEffect(() => {
    if (!wordId || !open || !isAuthenticated) {
      setIsFavorite(false);
      return;
    }

    const checkFavorite = async () => {
      try {
        const response = await fetch(
          `/api/dictionary/favorites?wordId=${wordId}`
        );
        if (response.ok) {
          const data = await response.json();
          setIsFavorite(data.isFavorite);
        }
      } catch {
        // Silently fail
      }
    };

    checkFavorite();
  }, [wordId, open, isAuthenticated]);

  const handleToggleFavorite = useCallback(async () => {
    // HU1.2.8 — If not authenticated, show login modal
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    if (!wordId || isTogglingFav) return;

    setIsTogglingFav(true);
    try {
      const response = await fetch("/api/dictionary/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId }),
      });

      if (response.status === 401) {
        setAuthModalOpen(true);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setIsFavorite(data.isFavorite);

        if (data.isFavorite) {
          toast({
            title: "Añadido a favoritos",
            description: "La palabra se ha guardado en tus favoritos.",
          });
        } else {
          toast({
            title: "Eliminado de favoritos",
            description: "La palabra se ha eliminado de tus favoritos.",
          });
        }
      }
    } catch {
      toast({
        title: "Error",
        description: "No se pudo actualizar favoritos. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingFav(false);
    }
  }, [wordId, isAuthenticated, isTogglingFav, toast]);

  const categories = parseCategories(word?.category ?? null);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : word ? (
            <>
              <SheetHeader className="pb-0">
                {/* HU1.2.6 — Category badges */}
                {categories.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {categories.map((cat) => (
                      <Badge
                        key={cat}
                        variant="secondary"
                        className="text-xs gap-1"
                      >
                        <Tag className="h-3 w-3" />
                        {getCategoryDisplay(cat)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <Badge
                    variant="outline"
                    className="w-fit mb-2 text-xs text-muted-foreground"
                  >
                    Categoría desconocida
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

                {/* HU1.2.5 — Cultural context (always show section) */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    Contexto cultural
                  </h3>
                  {word.culturalContext ? (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {word.culturalContext}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Sin información contextual disponible
                    </p>
                  )}
                </div>

                {/* HU1.2.5 — Examples (always show section) */}
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
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No hay ejemplos de uso disponibles
                    </p>
                  )}
                </div>

                <Separator />

                {/* HU1.2.7 + HU1.2.8 — Favorite button */}
                <div className="flex flex-col gap-2">
                  <Button
                    variant={isFavorite ? "default" : "outline"}
                    className="w-full gap-2"
                    onClick={handleToggleFavorite}
                    disabled={isTogglingFav}
                  >
                    {isTogglingFav ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Heart
                        className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`}
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
                      onClick={() => setAuthModalOpen(true)}
                    >
                      <LogIn className="h-3 w-3" />
                      Inicia sesión para guardar favoritos
                    </button>
                  )}

                  {/* Offline download notice */}
                  {isFavorite && word.audioUrl && (
                    <p className="text-xs text-muted-foreground text-center">
                      💾 El audio se descargará para uso sin conexión
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">No se encontró la palabra</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* HU1.2.8 — Auth modal for non-authenticated users */}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </>
  );
}
