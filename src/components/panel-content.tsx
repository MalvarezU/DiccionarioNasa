"use client";

import {
  Heart,
  Clock,
  Volume2,
  Trash2,
  Loader2,
  LogIn,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AuthModal } from "@/components/auth-modal";
import { usePanelContent } from "./use-panel-content";
import { type PanelTab } from "./panel-data";

interface PanelContentProps {
  initialTab: PanelTab;
  onWordSelect: (wordId: string) => void;
  onClose: () => void;
}

export function PanelContent({
  initialTab,
  onWordSelect,
  onClose,
}: PanelContentProps) {
  const {
    isAuthenticated,
    activeTab,
    setActiveTab,
    authModalOpen,
    setAuthModalOpen,
    favorites,
    isLoadingFavorites,
    history,
    isLoadingHistory,
    groupedHistory,
    handleClearHistory,
    handleWordClick,
  } = usePanelContent({ initialTab, onWordSelect, onClose });

  // ─── Not authenticated state ─────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
          {activeTab === "favorites" ? (
            <Heart className="h-8 w-8 text-primary/60" />
          ) : (
            <Clock className="h-8 w-8 text-primary/60" />
          )}
        </div>
        <p className="text-sm font-medium text-foreground">
          {activeTab === "favorites"
            ? "Inicia sesión para ver tus favoritos"
            : "Inicia sesión para ver tu historial"}
        </p>
        <p className="text-xs text-muted-foreground max-w-sm text-center">
          {activeTab === "favorites"
            ? "Guarda palabras como favoritas y accede a ellas desde cualquier dispositivo."
            : "Las palabras que consultes se registrarán en tu historial personal."}
        </p>
        <Button onClick={() => setAuthModalOpen(true)} className="gap-2">
          <LogIn className="h-4 w-4" />
          Iniciar sesión
        </Button>
        <AuthModal
          open={authModalOpen}
          onOpenChange={setAuthModalOpen}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex items-center gap-2 mb-5">
        <button
          type="button"
          onClick={() => setActiveTab("favorites")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "favorites"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
          aria-pressed={activeTab === "favorites"}
        >
          <Heart className="h-4 w-4" />
          Favoritos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "history"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
          aria-pressed={activeTab === "history"}
        >
          <Clock className="h-4 w-4" />
          Historial
        </button>
      </div>

      <Separator className="mb-4" />

      {/* Favorites tab */}
      {activeTab === "favorites" && (
        <div className="flex-1 overflow-y-auto max-h-[60vh] pr-1">
          {isLoadingFavorites ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : favorites.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {favorites.map((fav) => (
                <Card
                  key={fav.id}
                  className="group cursor-pointer transition-all duration-200 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 shadow-sm hover:shadow-md hover:border-primary/40"
                  onClick={() => handleWordClick(fav.word.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-serif text-lg text-primary group-hover:text-primary/80 transition-colors">
                        {fav.word.nasaYuwe}
                      </CardTitle>
                      {fav.word.category && (
                        <Badge
                          variant="secondary"
                          className="text-2xs shrink-0 bg-surface-container-highest text-foreground hover:bg-tertiary-fixed transition-colors"
                        >
                          {fav.word.category}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm font-medium text-foreground">
                      {fav.word.spanish}
                    </p>
                    {fav.word.pronunciation && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Volume2 className="h-3 w-3" />
                        [{fav.word.pronunciation}]
                      </p>
                    )}
                    <p className="mt-2 text-2xs text-muted-foreground">
                      Guardada el{" "}
                      {new Date(fav.createdAt).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted/30">
                <Heart className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No tienes palabras favoritas
              </p>
              <p className="text-xs text-muted-foreground max-w-sm text-center">
                Explora el diccionario y marca palabras como favoritas para
                verlas aquí.
              </p>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === "history" && (
        <div className="flex-1 overflow-y-auto max-h-[60vh] pr-1">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-6">
              {/* Clear button */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearHistory}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpiar historial
                </Button>
              </div>

              {Object.entries(groupedHistory).map(([date, items]) => (
                <div key={date}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 capitalize">
                    {date}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map((item) => (
                      <Card
                        key={item.id}
                        className="group cursor-pointer transition-all duration-200 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 shadow-sm hover:shadow-md hover:border-primary/40"
                        onClick={() => handleWordClick(item.word.id)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="font-serif text-lg text-primary group-hover:text-primary/80 transition-colors">
                              {item.word.nasaYuwe}
                            </CardTitle>
                            {item.word.category && (
                              <Badge
                                variant="secondary"
                                className="text-2xs shrink-0 bg-surface-container-highest text-foreground hover:bg-tertiary-fixed transition-colors"
                              >
                                {item.word.category}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm font-medium text-foreground">
                            {item.word.spanish}
                          </p>
                          {item.word.pronunciation && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Volume2 className="h-3 w-3" />
                              [{item.word.pronunciation}]
                            </p>
                          )}
                          <p className="mt-2 text-2xs text-muted-foreground">
                            Consultada a las{" "}
                            {new Date(item.createdAt).toLocaleTimeString(
                              "es-CO",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted/30">
                <Clock className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No tienes historial de consultas
              </p>
              <p className="text-xs text-muted-foreground max-w-sm text-center">
                Las palabras que consultes aparecerán aquí agrupadas por fecha.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
