"use client";

import { Clock, History, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HistorySkeleton } from "@/components/skeletons";
import { groupHistoryByDate, type PerfilHistoryEntry, type SearchHistoryEntry } from "./types";
import { WordListCard } from "./word-list-card";

interface HistoryTabProps {
  history: PerfilHistoryEntry[];
  searches: SearchHistoryEntry[];
  loading: boolean;
  clearingHistory: boolean;
  clearingSearches: boolean;
  onClearHistory: () => void;
  onClearSearches: () => void;
}

/**
 * Tab Historial: palabras vistas del servidor agrupadas por fecha + "limpiar
 * todo", y sub-sección "Búsquedas recientes" con su propia limpieza.
 */
export function HistoryTab({
  history,
  searches,
  loading,
  clearingHistory,
  clearingSearches,
  onClearHistory,
  onClearSearches,
}: HistoryTabProps) {
  if (loading) return <HistorySkeleton />;

  const grouped = groupHistoryByDate(history);

  return (
    <div className="space-y-8">
      <section aria-labelledby="perfil-historial-palabras">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3
            id="perfil-historial-palabras"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <History className="h-4 w-4 text-secondary" aria-hidden="true" />
            Palabras vistas
          </h3>
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearHistory}
              disabled={clearingHistory}
              className="gap-1.5 min-h-[44px] text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {clearingHistory ? "Borrando…" : "Limpiar todo"}
            </Button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-4 rounded-xl border border-dashed border-outline-variant/50">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted/30">
              <Clock className="h-7 w-7 text-muted-foreground/40" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No tienes historial de consultas
            </p>
            <p className="text-xs text-muted-foreground max-w-sm text-center">
              Las palabras que consultes aparecerán aquí agrupadas por fecha.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 capitalize">
                  {date}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((item) => (
                    <WordListCard
                      key={item.id}
                      word={item.word}
                      meta={`Consultada a las ${new Date(item.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section aria-labelledby="perfil-busquedas">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3
            id="perfil-busquedas"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <Search className="h-4 w-4 text-secondary" aria-hidden="true" />
            Búsquedas recientes
          </h3>
          {searches.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSearches}
              disabled={clearingSearches}
              className="gap-1.5 min-h-[44px] text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {clearingSearches ? "Borrando…" : "Limpiar"}
            </Button>
          )}
        </div>

        {searches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no buscaste nada. Lo que escribas en el diccionario
            aparecerá aquí.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {searches.map((s) => (
              <li
                key={s.id}
                className="rounded-full border border-outline-variant/30 bg-background px-3 py-2 text-sm"
                title={new Date(s.createdAt).toLocaleString("es-CO")}
              >
                {s.query}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
