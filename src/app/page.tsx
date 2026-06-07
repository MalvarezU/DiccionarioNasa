"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [totalWords, setTotalWords] = useState<number>(0);
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
          setTotalWords(data.totalWords ?? 0);
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
        <section className="relative pb-12 sm:pb-16 pt-16 sm:pt-24">
          {/* Dark overlay base */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/50 z-10" />
          
          {/* Decorative pattern */}
          <div
            className="absolute inset-0 opacity-[0.06] z-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232563eb' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
            }}
            aria-hidden="true"
          />
          
          {/* Background image */}
          <Image
            src="/banner.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-[0.6] z-0"
            aria-hidden="true"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />

          {/* Content */}
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 text-center z-20">            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.6)' }}>
              Nasa Yuwe
            </h1>
            <p className="mt-3 text-lg sm:text-xl text-white font-medium" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}>
              Diccionario Bilingüe
            </p>
            <p className="mt-4 max-w-xl mx-auto text-base sm:text-lg text-white/90 leading-relaxed" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              Preservando y compartiendo la lengua del pueblo Nasa (Páez) de Colombia.
              Busca palabras, pronunciaciones y contexto cultural.
            </p>

            <div className="mt-8 sm:mt-10">
              <SearchBar variant="hero" />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-8">
              <div className="flex items-center gap-2 text-sm sm:text-base text-white/90" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                <BookOpen className="h-4 w-4 text-white" />
                <span>{totalWords > 0 ? `${totalWords} palabras` : "Palabras"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm sm:text-base text-white/90" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                <Volume2 className="h-4 w-4 text-white" />
                <span>Pronunciación guiada</span>
              </div>
              <div className="flex items-center gap-2 text-sm sm:text-base text-white/90" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                <Globe className="h-4 w-4 text-white" />
                <span>Español ↔ Nasa Yuwe</span>
              </div>
            </div>
          </div>
        </section>

        {/* Word of the Day */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
          <WordOfDayCard onWordSelect={handleWordSelect} />
        </section>

        {/* Tabbed Section: Featured | Explore */}
        <section id="explorar" className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="w-full">
            <div className="flex items-center justify-center mb-8">
              <TabsList className="gap-2">
                <TabsTrigger value="featured" className="gap-2">
                  <Star className="h-4 w-4" />
                  Destacadas
                </TabsTrigger>
                <TabsTrigger value="explore" className="gap-2">
                  <List className="h-4 w-4" />
                  Explorar A-Z
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="featured">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-primary">
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
                      className="group cursor-pointer transition-all duration-200 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 shadow-sm hover:shadow-md hover:border-primary/40"
                      onClick={() => handleWordClick(word)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="font-serif text-lg text-primary group-hover:text-primary/80 transition-colors">
                            {word.nasaYuwe}
                          </CardTitle>
                          {word.category && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] shrink-0 bg-tertiary/10 text-tertiary border border-tertiary/20 hover:bg-tertiary-fixed hover:text-foreground transition-colors"
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
                            <Volume2 className="h-3 w-3 text-secondary" />
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
            </TabsContent>

            <TabsContent value="explore">
              <ExploreSection onWordSelect={handleWordSelect} />
            </TabsContent>
          </Tabs>
        </section>

        {/* About Section */}
        <section id="acerca" className="bg-surface-container-high">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-serif font-semibold text-foreground">
                  Preservación Cultural
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Cada palabra registrada es un paso más en la conservación del
                  patrimonio lingüístico del pueblo Nasa.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10 border border-secondary/20">
                  <Users className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-serif font-semibold text-foreground">
                  Comunidad Nasa
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Diccionario creado en colaboración con hablantes nativos y
                  lingüistas especializados en lenguas indígenas.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tertiary/10 border border-tertiary/20">
                  <Globe className="h-6 w-6 text-tertiary" />
                </div>
                <h3 className="font-serif font-semibold text-foreground">
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
      <footer className="mt-auto bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Logo + Brand */}
            <div className="flex flex-col items-center md:items-start gap-3">
              <div className="flex items-center gap-4">
                <Image
                  src="/ybc.jpg"
                  alt="YBC Logo"
                  width={72}
                  height={72}
                  className="rounded-full border-2 border-white/30"
                />
                <div>
                  <p className="font-serif text-lg font-bold text-white">
                    Grupo YBC
                  </p>
                  <p className="text-xs text-white/70">
                    Nasa Yuwe · Diccionario Bilingüe
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-1">
                Navegación
              </p>
              <nav className="flex flex-col items-center gap-2">
                <Link
                  href="/#explorar"
                  className="text-xs text-white/70 hover:text-white transition-colors duration-200"
                >
                  Explorar A-Z
                </Link>
                <Link
                  href="/#acerca"
                  className="text-xs text-white/70 hover:text-white transition-colors duration-200"
                >
                  Acerca del proyecto
                </Link>
                <Link
                  href="/admin"
                  className="text-xs text-white/70 hover:text-white transition-colors duration-200"
                >
                  Administración
                </Link>
              </nav>
            </div>

            {/* Acknowledgment + Version */}
            <div className="flex flex-col items-center md:items-end gap-3">
              <p className="text-xs text-white/70 text-center md:text-right max-w-xs leading-relaxed">
                Este diccionario es una herramienta de preservación lingüística y cultural.
              </p>
              <p className="text-[10px] text-white/50">
                Versión 1.0.0
              </p>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 pt-6 border-t border-white/20">
            <p className="text-center text-[10px] text-white/50" suppressHydrationWarning>
              © {new Date().getFullYear()} Nasa Yuwe · Proyecto de preservación lingüística
            </p>
          </div>
        </div>
      </footer>

      {/* Word detail card */}
      <WordDetailCard
        key={selectedWordId ?? "none"}
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
