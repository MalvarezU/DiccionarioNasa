"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Heart, Users, Globe } from "lucide-react";
import { NavBar } from "@/components/navbar";
import { InstallBanner } from "@/components/pwa/install-banner";
import { SiteFooter } from "@/components/site-footer";
import { InstallSectionLazy } from "@/components/pwa/install-section-lazy";
import { HeroWordOfDay } from "@/components/hero-word";
import { ModuleSwitcher } from "@/components/module-switcher";
import { SearchBar } from "@/components/search-bar";
import { WordDetailCard } from "@/components/word-detail-card";
import { useWordOfDay } from "@/hooks/use-word-of-day";

function HeroWordSkeleton() {
  return (
    <div aria-hidden="true" className="motion-safe:animate-pulse">
      <div className="h-3 w-40 rounded bg-white/20" />
      <div className="mt-4 h-24 w-3/4 rounded bg-white/10 sm:h-28" />
      <div className="mt-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-white/20" />
        <div className="h-6 w-1/3 rounded bg-white/10" />
      </div>
    </div>
  );
}

function HomeContent() {
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { word, date, isLoading, isFromCache } = useWordOfDay();

  const handleWordSelect = useCallback((wordId: string) => {
    setSelectedWordId(wordId);
    setDetailOpen(true);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <InstallBanner destino="/#instalar" />

      <main id="contenido" className="flex-1">
        {/* Hero palabra-primero: la palabra del día absorbe el WOTD */}
        <section className="relative isolate overflow-hidden bg-[#1B2733]">
          {/* Mobile / tablet: foto de fondo + velo pizarra */}
          <div className="absolute inset-0 lg:hidden" aria-hidden="true">
            <Image
              src="/banner.webp"
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-[#1B2733]/80" />
          </div>
          {/* Desktop: foto a la derecha con máscara pizarra izq → transparente */}
          <div
            className="absolute inset-y-0 right-0 hidden w-5/12 lg:block"
            aria-hidden="true"
          >
            <Image
              src="/banner.webp"
              alt=""
              fill
              sizes="42vw"
              className="object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1B2733] via-[#1B2733]/25 to-transparent" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
            <div className="lg:grid lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-7">
                {isLoading ? (
                  <HeroWordSkeleton />
                ) : (
                  <HeroWordOfDay
                    word={word}
                    date={date}
                    isFromCache={isFromCache}
                    onVerFicha={handleWordSelect}
                  />
                )}

                <p className="mt-6 text-base text-white/85 sm:text-lg">
                  Diccionario bilingüe, juegos y una ruta paso a paso
                </p>

                <div className="mt-6 max-w-xl">
                  <ModuleSwitcher />
                </div>

                <div className="mt-4 max-w-xl">
                  <SearchBar variant="inline" onWordSelect={handleWordSelect} />
                </div>
              </div>
            </div>
          </div>
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
                  Creado en colaboración con hablantes nativos y lingüistas
                  especializados en lenguas indígenas.
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
      <InstallSectionLazy />
      </main>

      <SiteFooter />

      {/* Ficha de palabra (desde la palabra del día) */}
      <WordDetailCard
        key={selectedWordId ?? "none"}
        wordId={selectedWordId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

export default function Home() {
  return <HomeContent />;
}
