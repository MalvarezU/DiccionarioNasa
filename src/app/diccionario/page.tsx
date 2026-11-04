"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Leaf,
  BookOpen,
  Volume2,
  Star,
  List,
} from "lucide-react";
import { NavBar } from "@/components/navbar";
import { InstallBanner } from "@/components/pwa/install-banner";
import { SearchBar } from "@/components/search-bar";
import { WordDetailCard } from "@/components/word-detail-card";
import { SiteFooter } from "@/components/site-footer";
import { ExploreSection } from "@/components/explore-section";
import { WordOfDayCard } from "@/components/word-of-day-card";
import { WordCard } from "@/components/word-card";
import { FavoritesHistoryPanel } from "@/components/favorites-history-panel";
import { recordLocalHistory } from "@/lib/demo-storage";

import { WordCardSkeleton } from "@/components/skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FeaturedWord {
  id: string;
  spanish: string;
  nasaYuwe: string;
  pronunciation: string | null;
  category: string | null;
  culturalContext: string | null;
  audioUrl: string | null;
}

type TabType = "featured" | "explore";

function DiccionarioContent() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const [featuredWords, setFeaturedWords] = useState<FeaturedWord[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("featured");

  // Favorites/History panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"favorites" | "history">("favorites");

  // Single audio at a time across featured cards
  const [playingId, setPlayingId] = useState<string | null>(null);
  const featuredGridRef = useRef<HTMLDivElement | null>(null);

  const pauseGridAudio = useCallback((exceptId: string | null) => {
    featuredGridRef.current
      ?.querySelectorAll("audio")
      .forEach((el) => {
        if (el.getAttribute("data-word-id") !== exceptId) el.pause();
      });
  }, []);

  const handlePlayState = useCallback(
    (id: string | null) => {
      setPlayingId(id);
      // Pause every other card. Their own onPause handler syncs the icon
      // locally without notifying back, so there is no feedback loop.
      if (id) pauseGridAudio(id);
    },
    [pauseGridAudio]
  );

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

  const handleWordClick = (wordId: string) => {
    // Stop featured audio before opening the detail modal
    if (playingId) {
      pauseGridAudio(null);
      setPlayingId(null);
    }
    setSelectedWordId(wordId);
    setDetailOpen(true);
  };

  const handleWordSelect = useCallback((wordId: string) => {
    setSelectedWordId(wordId);
    setDetailOpen(true);
  }, []);

  // Record view history when a word detail is opened
  useEffect(() => {
    if (!selectedWordId || !detailOpen || !isAuthenticated) return;

    const userId = (session?.user as any)?.id || 'demo-user';

    const recordHistory = async () => {
      try {
        const res = await fetch("/api/dictionary/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wordId: selectedWordId }),
        });
        if (!res.ok) throw new Error('API error')
      } catch {
        // Fallback to localStorage for demo mode
        recordLocalHistory(userId, selectedWordId);
      }
    };
    recordHistory();
  }, [selectedWordId, detailOpen, isAuthenticated, session]);

  // Open favorites/history panel
  const openPanel = useCallback((tab: "favorites" | "history") => {
    setPanelTab(tab);
    setPanelOpen(true);
  }, []);

  // Open the panel from a ?panel= query param (cross-page entry from NavBar)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const panel = params.get("panel");
    if (panel === "favorites" || panel === "history") {
      setPanelTab(panel);
      setPanelOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
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
      <InstallBanner destino="/#instalar" />

      <main id="contenido" className="flex-1">
        {/* Hero del diccionario */}
        <section className="relative isolate overflow-hidden bg-background pb-12 sm:pb-16 pt-12 sm:pt-16">
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232F3E4E' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-background/60 px-3 py-1 text-xs font-medium text-[#2F3E4E]/70">
              <BookOpen className="h-3 w-3 text-primary" aria-hidden="true" />
              Diccionario bilingüe
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-semibold font-serif tracking-tight text-primary">
              Diccionario Nasa Yuwe
            </h1>
            <p className="mt-3 text-lg sm:text-xl font-medium text-foreground">
              Busca palabras, pronunciaciones y contexto cultural
            </p>

            <div className="mt-8 sm:mt-10">
              <SearchBar variant="hero-light" />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm sm:text-base text-muted-foreground">
              <div className="flex items-center gap-2">
                <Leaf className="h-4 w-4 text-primary" />
                <span>Palabras de la comunidad</span>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                <span>Pronunciación guiada</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
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
                <div
                  ref={featuredGridRef}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
                >
                  {featuredWords.map((word) => (
                    <WordCard
                      key={word.id}
                      word={word}
                      variant="grid"
                      onOpen={handleWordClick}
                      onPlayState={handlePlayState}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {Array.from({ length: 6 }, (_, i) => (
                    <WordCardSkeleton key={i} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="explore">
              <ExploreSection onWordSelect={handleWordSelect} />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <SiteFooter />

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

export default function DiccionarioPage() {
  return <DiccionarioContent />;
}
