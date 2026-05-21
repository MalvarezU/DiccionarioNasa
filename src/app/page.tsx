"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
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
} from "lucide-react";
import { NavBar } from "@/components/navbar";
import { SearchBar } from "@/components/search-bar";
import { WordDetailCard } from "@/components/word-detail-card";
import { DownloadBanner } from "@/components/download-banner";
import { ExploreSection } from "@/components/explore-section";
import { WordOfDayCard } from "@/components/word-of-day-card";
import { FavoritesHistoryPanel } from "@/components/favorites-history-panel";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface FeaturedWord {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation: string | null;
  category: string | null;
  culturalContext: string | null;
}

type TabType = "featured" | "explore";

function HomeContent() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const [featuredWords, setFeaturedWords] = useState<FeaturedWord[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("featured");

  // Favorites/History panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"favorites" | "history">("favorites");

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

  // Open favorites/history panel
  const openPanel = useCallback((tab: "favorites" | "history") => {
    setPanelTab(tab);
    setPanelOpen(true);
  }, []);

  // Listen for custom events from NavBar to open the panel
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab: "favorites" | "history" }>;
      openPanel(customEvent.detail.tab);
    };
    window.addEventListener("open-panel", handler);
    return () => window.removeEventListener("open-panel", handler);
  }, [openPanel]);

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

        {/* Tabbed Section: Featured | Explore */}
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

      {/* Favorites & History panel */}
      <FavoritesHistoryPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        initialTab={panelTab}
        onWordSelect={handleWordSelect}
      />
    </div>
  );
}

export default function Home() {
  return <HomeContent />;
}
