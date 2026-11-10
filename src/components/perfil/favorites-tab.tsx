"use client";

import { ArrowRight, Heart, HeartOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FavoritesGridSkeleton } from "@/components/skeletons";
import { WordListCard } from "./word-list-card";
import type { PerfilFavorite } from "./types";

interface FavoritesTabProps {
  favorites: PerfilFavorite[];
  loading: boolean;
  removingId: string | null;
  onRemove: (wordId: string) => void;
}

/** Tab Favoritos: lista del servidor, quitar con 1 click, abrir en diccionario. */
export function FavoritesTab({
  favorites,
  loading,
  removingId,
  onRemove,
}: FavoritesTabProps) {
  if (loading) return <FavoritesGridSkeleton />;

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted/30">
          <Heart className="h-7 w-7 text-muted-foreground/40" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">
          No tienes palabras favoritas
        </p>
        <p className="text-xs text-muted-foreground max-w-sm text-center">
          Explora el diccionario y marca palabras como favoritas para verlas
          aquí.
        </p>
        <Button asChild className="gap-2 min-h-[44px]">
          <Link href="/diccionario">
            Explorar el diccionario
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="anim-stagger-children grid grid-cols-1 sm:grid-cols-2 gap-3">
      {favorites.map((fav) => (
        <WordListCard
          key={fav.id}
          word={fav.word}
          meta={`Guardada el ${new Date(fav.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}`}
          action={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
              disabled={removingId === fav.wordId}
              onClick={() => onRemove(fav.wordId)}
              aria-label={`Quitar ${fav.word.nasaYuwe} de favoritas`}
            >
              {removingId === fav.wordId ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <HeartOff className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          }
        />
      ))}
    </div>
  );
}
