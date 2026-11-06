"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Gamepad2,
  Download,
  ChevronDown,
} from "lucide-react";
import { NavBar } from "@/components/navbar";
import { InstallBanner } from "@/components/pwa/install-banner";
import { SiteFooter } from "@/components/site-footer";
import { InstallSectionLazy } from "@/components/pwa/install-section-lazy";
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

      <main id="contenido" className="flex-1">
        {/* Hero — bienvenida a la plataforma */}
        <section data-hero className="relative isolate pb-12 sm:pb-16 pt-28 sm:pt-36 sm:flex sm:min-h-svh sm:flex-col sm:justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-montana-deep/60 via-montana-deep/35 to-montana-deep/10 z-10" />
          <div
            className="absolute inset-0 opacity-[0.08] z-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23173f35' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
            }}
            aria-hidden="true"
          />
          <Image
            src="/banner.webp"
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover sm:object-[50%_30%] opacity-100 z-0"
            aria-hidden="true"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {/* Tinte territorio sobre la foto (multiply): verdor notorio
              sin matar la foto. Orden: foto → tinte → scrim → texto. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 z-[1] bg-territorio/30 mix-blend-multiply"
          />

          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 text-center z-20">
            <h1
              className="mt-4 text-4xl sm:text-5xl md:text-6xl font-serif font-semibold tracking-tight text-crema"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.7), 0 8px 32px rgba(0,0,0,0.5)" }}
            >
              Bienvenido a Piiyaak
            </h1>
            <p
              className="mt-3 text-lg sm:text-xl text-crema font-medium"
              style={{ textShadow: "0 2px 6px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6)" }}
            >
              Plataforma para aprender y preservar el Nasa Yuwe
            </p>
            <p
              className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-crema/90 leading-relaxed"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)" }}
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
                    className={`group inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-sm font-medium transition-colors duration-200 backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema ${
                      principal
                        ? "bg-amarillo text-amarillo-foreground shadow-lg hover:bg-amarillo-oscuro hover:shadow-xl sm:px-6"
                        : "border border-crema/40 bg-territorio/50 text-crema hover:bg-crema/15 hover:border-crema/60"
                    }`}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0"
                    />
                    {principal ? m.cta : m.title}
                  </Link>
                );
              })}
            </div>

            {/* Baja a la sección de descargas */}
            <div className="mt-6 flex justify-center">
              <a
                href="#instalar"
                className="group inline-flex items-center gap-2 rounded-full border border-crema/40 bg-territorio/50 px-5 py-2.5 text-sm font-medium text-crema backdrop-blur-md transition-colors duration-200 hover:bg-crema/15 hover:border-crema/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema"
              >
                <Download className="h-4 w-4 shrink-0" />
                Descargar app
                <ChevronDown className="h-4 w-4 shrink-0 animate-bounce" />
              </a>
            </div>
          </div>
        </section>

        {/* Download para uso sin conexión */}
        <InstallBanner destino="/#instalar" />
        <DownloadBanner />

        {/* Word of the Day */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
          <WordOfDayCard onWordSelect={handleWordSelect} />
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
