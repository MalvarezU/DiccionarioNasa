"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Volume2,
  Globe,
  GraduationCap,
  Gamepad2,
  Heart,
  Users,
  Sparkles,
} from "lucide-react";
import { NavBar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import { DownloadBanner } from "@/components/download-banner";
import { WordOfDayCard } from "@/components/word-of-day-card";
import { WordDetailCard } from "@/components/word-detail-card";

/** Los 3 módulos de la plataforma: se eligen desde el hero. */
const MODULES = [
  {
    href: "/diccionario",
    icon: BookOpen,
    title: "Diccionario",
    cta: "Explorar diccionario",
  },
  { href: "/juegos", icon: Gamepad2, title: "Juegos", cta: "Jugar ahora" },
  {
    href: "/cursos",
    icon: GraduationCap,
    title: "Cursos",
    cta: "Ver cursos",
  },
] as const;

function HomeContent() {
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleWordSelect = useCallback((wordId: string) => {
    setSelectedWordId(wordId);
    setDetailOpen(true);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1">
        {/* Hero — bienvenida a la plataforma */}
        <section className="relative isolate pb-12 sm:pb-16 pt-16 sm:pt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/50 z-10" />
          <div
            className="absolute inset-0 opacity-[0.06] z-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232563eb' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
            }}
            aria-hidden="true"
          />
          <Image
            src="/banner.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-[0.6] z-0"
            aria-hidden="true"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 text-center z-20">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/30 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Plataforma de la lengua Nasa Yuwe
            </span>
            <h1
              className="mt-4 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.6)" }}
            >
              Bienvenido a Piiyaak
            </h1>
            <p
              className="mt-3 text-lg sm:text-xl text-white font-medium"
              style={{ textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}
            >
              Diccionario, juegos y cursos para aprender y preservar el Nasa Yuwe
            </p>
            <p
              className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-white/90 leading-relaxed"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
            >
              Tres caminos en un solo lugar: consulta el diccionario bilingüe,
              practica con juegos didácticos y sigue una ruta de aprendizaje paso
              a paso.
            </p>

            {/* Los 3 módulos de la plataforma, integrados en el banner */}
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              {MODULES.map((m, i) => {
                const Icon = m.icon;
                const principal = i === 0;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    className={`group inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200 backdrop-blur-md ${
                      principal
                        ? "bg-white/95 text-primary shadow-lg hover:bg-white hover:shadow-xl sm:px-6"
                        : "border border-white/35 bg-black/25 text-white hover:bg-white/15 hover:border-white/60"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                        principal ? "" : "group-hover:scale-110"
                      }`}
                    />
                    {principal ? m.cta : m.title}
                  </Link>
                );
              })}
            </div>

            <div
              className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-8"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
            >
              <div className="flex items-center gap-2 text-sm sm:text-base text-white/90">
                <BookOpen className="h-4 w-4 text-white" />
                <span>Diccionario bilingüe</span>
              </div>
              <div className="flex items-center gap-2 text-sm sm:text-base text-white/90">
                <Volume2 className="h-4 w-4 text-white" />
                <span>Pronunciación guiada</span>
              </div>
              <div className="flex items-center gap-2 text-sm sm:text-base text-white/90">
                <Globe className="h-4 w-4 text-white" />
                <span>Español ↔ Nasa Yuwe</span>
              </div>
            </div>
          </div>
        </section>

        {/* Download para uso sin conexión */}
        <DownloadBanner />

        {/* Word of the Day */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-8 sm:pb-10">
          <WordOfDayCard onWordSelect={handleWordSelect} />
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
