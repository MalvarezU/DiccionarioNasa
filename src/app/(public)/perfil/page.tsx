"use client";

import { Suspense, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookOpenCheck, Clock, Heart } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PerfilHeader } from "@/components/perfil/perfil-header";
import { FavoritesTab } from "@/components/perfil/favorites-tab";
import { HistoryTab } from "@/components/perfil/history-tab";
import { ProgressTab } from "@/components/perfil/progress-tab";
import { AccountCard } from "@/components/perfil/account-card";
import { usePerfilData } from "@/components/perfil/use-perfil-data";
import { parsePerfilTab, type PerfilTab } from "@/components/perfil/types";

const TAB_ITEMS = [
  { value: "favorites", label: "Favoritos", icon: Heart },
  { value: "history", label: "Historial", icon: Clock },
  { value: "progress", label: "Mi avance", icon: BookOpenCheck },
] as const satisfies ReadonlyArray<{ value: PerfilTab; label: string; icon: typeof Heart }>;

/**
 * /perfil — "Mi espacio" (fase 2): header con avatar y stats, tabs
 * Favoritos / Historial / Mi avance (datos del servidor) y tarjeta de
 * cuenta colapsada al pie. `?tab=favorites|history|progress` permite
 * entrada directa desde la navbar.
 */
function PerfilContent() {
  const { status, data: session } = useSession();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<PerfilTab>(() =>
    parsePerfilTab(searchParams.get("tab"))
  );

  const {
    profile,
    favorites,
    history,
    searches,
    courses,
    loading,
    stats,
    removeFavorite,
    removingId,
    clearHistory,
    clearingHistory,
    clearSearches,
    clearingSearches,
    setProfile,
  } = usePerfilData();

  const handleTabChange = (value: string) => {
    const next = parsePerfilTab(value);
    setTab(next);
    // Shallow: refleja el tab en la URL sin recargar (deep-link copiable).
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", next);
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    }
  };

  const sessionUser = session?.user as
    | { name?: string | null; email?: string; role?: string }
    | undefined;

  return (
    <main id="contenido" className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-8">
      {loading || status === "loading" ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Cargando tu espacio">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : status === "unauthenticated" ? (
        <div className="rounded-2xl border p-6 text-center">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            Mi espacio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inicia sesión para ver tus favoritas, tu historial y tu avance.
          </p>
          <Button className="mt-4 min-h-[44px]" onClick={() => setAuthOpen(true)}>
            Iniciar sesión
          </Button>
          <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
        </div>
      ) : (
        <div className="grid gap-6 anim-page-reveal">
          <PerfilHeader
            name={profile?.name ?? sessionUser?.name ?? null}
            email={profile?.email ?? sessionUser?.email ?? ""}
            role={sessionUser?.role}
            loading={loading}
            stats={stats}
          />

          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList
              aria-label="Secciones de Mi espacio"
              className="h-auto w-full justify-start gap-1 overflow-x-auto p-1 sm:w-fit"
            >
              {TAB_ITEMS.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="min-h-[44px] flex-1 gap-2 px-4 sm:flex-none"
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="favorites" className="mt-4">
              <h2 className="sr-only">Favoritos</h2>
              <FavoritesTab
                favorites={favorites}
                loading={loading}
                removingId={removingId}
                onRemove={removeFavorite}
              />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <h2 className="sr-only">Historial</h2>
              <HistoryTab
                history={history}
                searches={searches}
                loading={loading}
                clearingHistory={clearingHistory}
                clearingSearches={clearingSearches}
                onClearHistory={clearHistory}
                onClearSearches={clearSearches}
              />
            </TabsContent>
            <TabsContent value="progress" className="mt-4">
              <h2 className="sr-only">Mi avance</h2>
              <ProgressTab courses={courses} loading={loading} />
            </TabsContent>
          </Tabs>

          {profile && (
            <AccountCard
              profile={profile}
              onProfileChange={(p) =>
                setProfile((prev) => (prev ? { ...prev, ...p } : prev))
              }
            />
          )}
        </div>
      )}
    </main>
  );
}

export default function PerfilPage() {
  return (
      <Suspense
        fallback={
          <main id="contenido" className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-8">
            <div className="grid gap-4" aria-busy="true" aria-label="Cargando tu espacio">
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </main>
        }
      >
        <PerfilContent />
      </Suspense>
  );
}
