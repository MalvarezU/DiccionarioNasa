"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
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
import { Button } from "@/components/ui/button";

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
  const [featuredError, setFeaturedError] = useState(false);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredRetry, setFeaturedRetry] = useState(0);

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
    const controller = new AbortController();
    const fetchFeatured = async () => {
      setFeaturedLoading(true);
      setFeaturedError(false);
      try {
        const res = await fetch("/api/dictionary/featured", { signal: controller.signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        setFeaturedWords(data.words ?? []);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setFeaturedError(true);
      } finally {
        if (!controller.signal.aborted) setFeaturedLoading(false);
      }
    };
    fetchFeatured();
    return () => controller.abort();
  }, [featuredRetry]);

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

    const userId = (session?.user as { id?: string } | undefined)?.id || 'demo-user';

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

  // Open the tab from a ?tab= query param (entry from search "Ver todas")
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "explore" || tab === "featured") {
      setActiveTab(tab);
      window.history.replaceState(null, "", window.location.pathname);
    }
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

  // Deep-link desde /perfil (?palabra=<wordId>): abre el detalle de la
  // palabra sin pasar por el buscador. Solo lee el param y limpia la URL;
  // el registro de historial de vistas del efecto de arriba sigue intacto.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const palabra = params.get("palabra");
    if (palabra) {
      setSelectedWordId(palabra);
      setDetailOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main id="contenido" className="flex-1">
        {/* Hero del diccionario — foto banner2 con overlay pizarra (mismo
            tratamiento que el hero home; stops reforzados porque la foto
            es clara: muro blanco sobreexpuesto). data-hero: el header
            frosted mide este hero para mutar a sólido al salir de él.
            min-h-svh + flex-col con el wrapper centrado en sm+
            (sm:my-auto) y anclado arriba en móvil: el panel queda
            centrado en desktop sin saltos al escribir
            (marco de resultados fijo, cero CLS). En móvil el panel va
            primero en el DOM junto al navbar. */}
        <section data-hero className="relative isolate overflow-hidden bg-background pb-10 sm:pb-14 pt-16 sm:pt-20 min-h-svh flex flex-col">
          <Image
            src="/banner2.jpg"
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover object-[50%_35%] z-0"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-montana-deep/70 via-montana-deep/55 to-montana-deep/30 z-10" />
          <div
            className="absolute inset-0 opacity-[0.08] z-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23173f35' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4H2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 z-20 sm:my-auto">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-12">
              {/* Panel de búsqueda PRIMERO en el DOM: en móvil aparece junto
                  al navbar; en lg se reordena a la derecha (order). */}
              <div className="order-1 mx-auto w-full max-w-xl rounded-2xl border border-crema/25 bg-montana-deep/30 p-4 sm:p-5 backdrop-blur-md shadow-2xl lg:order-2">
                <SearchBar variant="hero-panel" onWordSelect={handleWordSelect} />
              </div>
              {/* Copy de bienvenida: segundo en el DOM, a la izquierda en lg */}
              <div className="order-2 text-center lg:text-left lg:order-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-crema/30 bg-montana-deep/30 px-3 py-1 text-xs font-medium text-crema backdrop-blur-md">
                  <BookOpen className="h-3 w-3 text-crema" aria-hidden="true" />
                  Diccionario bilingüe
                </span>
                <h1
                  className="mt-4 text-2xl sm:text-4xl md:text-5xl font-semibold font-serif tracking-tight text-crema"
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.7), 0 8px 32px rgba(0,0,0,0.5)" }}
                >
                  Diccionario Nasa Yuwe
                </h1>
                <p
                  className="mt-3 text-lg sm:text-xl font-medium text-crema"
                  style={{ textShadow: "0 2px 6px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6)" }}
                >
                  Busca palabras, pronunciaciones y contexto cultural
                </p>
                <div
                  className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm sm:text-base text-crema/90 lg:justify-start"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)" }}
                >
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-crema" />
                    <span>Palabras de la comunidad</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-crema" />
                    <span>Pronunciación guiada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-crema" />
                    <span>Español ↔ Nasa Yuwe</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <InstallBanner destino="/#instalar" />

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

              {featuredLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {Array.from({ length: 6 }, (_, i) => (
                    <WordCardSkeleton key={i} />
                  ))}
                </div>
              ) : featuredError ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-3">No pudimos cargar las palabras destacadas.</p>
                  <Button variant="outline" size="sm" onClick={() => setFeaturedRetry((r) => r + 1)}>
                    Reintentar
                  </Button>
                </div>
              ) : featuredWords.length > 0 ? (
                <div
                  ref={featuredGridRef}
                  className="anim-stagger-children grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
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
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No hay palabras destacadas por ahora.
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
