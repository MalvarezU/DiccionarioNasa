"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Leaf,
  BookOpen,
  Volume2,
  Globe,
  Heart,
  Users,
  Star,
  List,
  Clock,
  LogIn,
  Trash2,
  Loader2,
} from "lucide-react";
import { NavBar } from "@/components/navbar";
import { SearchBar } from "@/components/search-bar";
import { WordDetailCard } from "@/components/word-detail-card";
import { DownloadBanner } from "@/components/download-banner";
import { ExploreSection } from "@/components/explore-section";
import { WordOfDayCard } from "@/components/word-of-day-card";
import { AuthModal } from "@/components/auth-modal";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface FeaturedWord {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation: string | null;
  category: string | null;
  culturalContext: string | null;
}

interface FavoriteWord {
  id: string;
  wordId: string;
  createdAt: string;
  word: {
    id: string;
    spanish: string;
    nasaYuwe: string;
    pronunciation: string | null;
    category: string | null;
    audioUrl: string | null;
  };
}

interface HistoryWord {
  id: string;
  wordId: string;
  createdAt: string;
  word: {
    id: string;
    spanish: string;
    nasaYuwe: string;
    pronunciation: string | null;
    category: string | null;
    audioUrl: string | null;
  };
}

type TabType = "featured" | "explore" | "favorites" | "history";

function HomeContent() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const searchParams = useSearchParams();

  const [featuredWords, setFeaturedWords] = useState<FeaturedWord[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("featured");

  // Favorites state
  const [favorites, setFavorites] = useState<FavoriteWord[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryWord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Handle URL tab param from NavBar dropdown links
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "favorites" || tab === "history") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Fetch featured words
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch("/api/dictionary/featured");
        if (res.ok) {
          const data = await res.json();
          setFeaturedWords(data.words ?? []);
        }
      } catch {
        // Silently fail
      }
    };
    fetchFeatured();
  }, []);

  // Fetch favorites when tab is active and user is authenticated
  useEffect(() => {
    if (activeTab !== "favorites" || !isAuthenticated) return;

    const fetchFavorites = async () => {
      setIsLoadingFavorites(true);
      try {
        const res = await fetch("/api/dictionary/favorites");
        if (res.ok) {
          const data = await res.json();
          setFavorites(data.favorites ?? []);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoadingFavorites(false);
      }
    };
    fetchFavorites();
  }, [activeTab, isAuthenticated]);

  // Fetch history when tab is active and user is authenticated
  useEffect(() => {
    if (activeTab !== "history" || !isAuthenticated) return;

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await fetch("/api/dictionary/history");
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history ?? []);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [activeTab, isAuthenticated]);

  const handleWordClick = (word: FeaturedWord) => {
    setSelectedWordId(word.id);
    setDetailOpen(true);
  };

  const handleWordSelect = useCallback((wordId: string) => {
    setSelectedWordId(wordId);
    setDetailOpen(true);
  }, []);

  // Record view history when a word detail is opened
  useEffect(() => {
    if (!selectedWordId || !detailOpen || !isAuthenticated) return;

    const recordHistory = async () => {
      try {
        await fetch("/api/dictionary/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wordId: selectedWordId }),
        });
      } catch {
        // Silently fail
      }
    };
    recordHistory();
  }, [selectedWordId, detailOpen, isAuthenticated]);

  const handleClearHistory = async () => {
    try {
      const res = await fetch("/api/dictionary/history", { method: "DELETE" });
      if (res.ok) {
        setHistory([]);
      }
    } catch {
      // Silently fail
    }
  };

  // Group history by date
  const groupedHistory = history.reduce<Record<string, HistoryWord[]>>((acc, item) => {
    const date = new Date(item.createdAt).toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1">
        {/* Download Banner */}
        <DownloadBanner />

        {/* Hero Section with Search Bar */}
        <section className="relative overflow-hidden pb-8">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.06]">
            <Image
              src="/nasa-pattern.png"
              alt=""
              fill
              className="object-cover"
              aria-hidden="true"
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-12 sm:pt-20 pb-6 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              <Leaf className="h-7 w-7 text-primary" />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Nasa Yuwe
            </h1>
            <p className="mt-2 text-base sm:text-lg text-accent font-medium">
              Diccionario Bilingüe
            </p>
            <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
              Preservando y compartiendo la lengua del pueblo Nasa (Páez) de Colombia.
              Busca palabras, pronunciaciones y contexto cultural.
            </p>

            <div className="mt-8">
              <SearchBar variant="hero" />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-5 sm:gap-6">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span>69 palabras</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                <Volume2 className="h-3.5 w-3.5 text-primary" />
                <span>Pronunciación guiada</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>Español ↔ Nasa Yuwe</span>
              </div>
            </div>
          </div>
        </section>

        <Separator className="mx-auto max-w-7xl" />

        {/* Word of the Day */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
          <WordOfDayCard onWordSelect={handleWordSelect} />
        </section>

        <Separator className="mx-auto max-w-7xl" />

        {/* Tabbed Section: Featured | Explore | Favorites | History */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
          {/* Tab buttons */}
          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            <button
              onClick={() => setActiveTab("featured")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "featured"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              aria-pressed={activeTab === "featured"}
            >
              <Star className="h-4 w-4" />
              Destacadas
            </button>
            <button
              onClick={() => setActiveTab("explore")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "explore"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              aria-pressed={activeTab === "explore"}
            >
              <List className="h-4 w-4" />
              Explorar A-Z
            </button>
            {isAuthenticated && (
              <>
                <button
                  onClick={() => setActiveTab("favorites")}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
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
                  onClick={() => setActiveTab("history")}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "history"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                  aria-pressed={activeTab === "history"}
                >
                  <Clock className="h-4 w-4" />
                  Historial
                </button>
              </>
            )}
          </div>

          {/* Featured Words Tab */}
          {activeTab === "featured" && (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Palabras Destacadas
                </h2>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                  Descubre algunas de las palabras fundamentales del Nasa Yuwe
                </p>
              </div>

              {featuredWords.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {featuredWords.map((word) => (
                    <Card
                      key={word.id}
                      className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                      onClick={() => handleWordClick(word)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg text-primary group-hover:text-primary/80 transition-colors">
                            {word.nasaYuwe}
                          </CardTitle>
                          {word.category && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] shrink-0"
                            >
                              {word.category}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm font-medium text-foreground">
                          {word.spanish}
                        </p>
                        {word.pronunciation && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Volume2 className="h-3 w-3" />
                            [{word.pronunciation}]
                          </p>
                        )}
                        {word.culturalContext && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {word.culturalContext}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Cargando palabras...</p>
                </div>
              )}
            </>
          )}

          {/* Explore Tab */}
          {activeTab === "explore" && (
            <ExploreSection onWordSelect={handleWordSelect} />
          )}

          {/* Favorites Tab */}
          {activeTab === "favorites" && isAuthenticated && (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
                  <Heart className="h-7 w-7 text-primary" />
                  Mis Favoritos
                </h2>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                  Palabras que has guardado para consultar fácilmente
                </p>
              </div>

              {isLoadingFavorites ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              ) : favorites.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {favorites.map((fav) => (
                    <Card
                      key={fav.id}
                      className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                      onClick={() => handleWordSelect(fav.word.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg text-primary group-hover:text-primary/80 transition-colors">
                            {fav.word.nasaYuwe}
                          </CardTitle>
                          {fav.word.category && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {fav.word.category}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm font-medium text-foreground">{fav.word.spanish}</p>
                        {fav.word.pronunciation && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Volume2 className="h-3 w-3" />
                            [{fav.word.pronunciation}]
                          </p>
                        )}
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          Guardada el {new Date(fav.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/30">
                    <Heart className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No tienes palabras favoritas</p>
                  <p className="text-xs text-muted-foreground max-w-sm text-center">
                    Explora el diccionario y marca palabras como favoritas para verlas aquí.
                  </p>
                </div>
              )}
            </>
          )}

          {/* History Tab */}
          {activeTab === "history" && isAuthenticated && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div className="text-center flex-1">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
                    <Clock className="h-7 w-7 text-primary" />
                    Mi Historial
                  </h2>
                  <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                    Palabras que has consultado recientemente
                  </p>
                </div>
                {history.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearHistory}
                    className="gap-1.5 text-destructive hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Limpiar</span>
                  </Button>
                )}
              </div>

              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              ) : history.length > 0 ? (
                <div className="space-y-8">
                  {Object.entries(groupedHistory).map(([date, items]) => (
                    <div key={date}>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3 capitalize">
                        {date}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((item) => (
                          <Card
                            key={item.id}
                            className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                            onClick={() => handleWordSelect(item.word.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-lg text-primary group-hover:text-primary/80 transition-colors">
                                  {item.word.nasaYuwe}
                                </CardTitle>
                                {item.word.category && (
                                  <Badge variant="secondary" className="text-[10px] shrink-0">
                                    {item.word.category}
                                  </Badge>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-sm font-medium text-foreground">{item.word.spanish}</p>
                              {item.word.pronunciation && (
                                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                  <Volume2 className="h-3 w-3" />
                                  [{item.word.pronunciation}]
                                </p>
                              )}
                              <p className="mt-2 text-[10px] text-muted-foreground">
                                Consultada a las {new Date(item.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/30">
                    <Clock className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No tienes historial de consultas</p>
                  <p className="text-xs text-muted-foreground max-w-sm text-center">
                    Las palabras que consultes aparecerán aquí agrupadas por fecha.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Not authenticated — prompt to login for favorites/history */}
          {activeTab === "favorites" && !isAuthenticated && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                <Heart className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground">Inicia sesión para ver tus favoritos</p>
              <p className="text-xs text-muted-foreground max-w-sm text-center">
                Guarda palabras como favoritas y accede a ellas desde cualquier dispositivo.
              </p>
              <Button onClick={() => setAuthModalOpen(true)} className="gap-2">
                <LogIn className="h-4 w-4" />
                Iniciar sesión
              </Button>
            </div>
          )}

          {activeTab === "history" && !isAuthenticated && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                <Clock className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground">Inicia sesión para ver tu historial</p>
              <p className="text-xs text-muted-foreground max-w-sm text-center">
                Las palabras que consultes se registrarán en tu historial personal.
              </p>
              <Button onClick={() => setAuthModalOpen(true)} className="gap-2">
                <LogIn className="h-4 w-4" />
                Iniciar sesión
              </Button>
            </div>
          )}
        </section>

        {/* About Section */}
        <section className="bg-muted/30 border-y">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">
                  Preservación Cultural
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Cada palabra registrada es un paso más en la conservación del
                  patrimonio lingüístico del pueblo Nasa.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">
                  Comunidad Nasa
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Diccionario creado en colaboración con hablantes nativos y
                  lingüistas especializados en lenguas indígenas.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">
                  Acceso Universal
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Disponible en línea y sin conexión, para que la lengua Nasa
                  Yuwe llegue a todas partes.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Nasa Yuwe — Diccionario Bilingüe
              </span>
            </div>
            <p className="text-xs text-muted-foreground text-center sm:text-right">
              Con respeto y gratitud al pueblo Nasa (Páez) de Colombia.
              <br />
              Este diccionario es una herramienta de preservación lingüística y cultural.
            </p>
          </div>
        </div>
      </footer>

      {/* Word detail card */}
      <WordDetailCard
        wordId={selectedWordId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* Auth modal */}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
