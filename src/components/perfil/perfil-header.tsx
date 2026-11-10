"use client";

import { BookOpenCheck, Clock, GraduationCap, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PerfilStats } from "./use-perfil-data";

interface PerfilHeaderProps {
  name: string | null;
  email: string;
  role?: string;
  loading: boolean;
  stats: PerfilStats;
}

const STAT_ITEMS = [
  { key: "favorites", label: "Favoritas", icon: Heart },
  { key: "views", label: "Vistas", icon: Clock },
  { key: "coursesInProgress", label: "Cursos en curso", icon: GraduationCap },
  { key: "lessonsCompleted", label: "Lecciones completadas", icon: BookOpenCheck },
] as const;

/**
 * Cabecera de Mi espacio: avatar con inicial, nombre, email,
 * rol y 4 stats derivados de las mismas llamadas de los tabs (sin costo extra).
 */
export function PerfilHeader({
  name,
  email,
  role,
  loading,
  stats,
}: PerfilHeaderProps) {
  const displayName = name?.trim() || email.split("@")[0] || "Usuario";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <section aria-labelledby="perfil-titulo" className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
        >
          {initial}
        </div>
        <div className="min-w-0">
          <h1
            id="perfil-titulo"
            className="truncate font-serif text-2xl font-semibold tracking-tight"
          >
            {displayName}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
          {role && (
            <Badge variant="secondary" className="mt-1.5 capitalize">
              {role}
            </Badge>
          )}
        </div>
      </div>

      <dl
        className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
        aria-label="Tu actividad"
      >
        {STAT_ITEMS.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-outline-variant/30 bg-background px-3 py-3 text-center"
          >
            <item.icon
              className="mx-auto h-4 w-4 text-secondary"
              aria-hidden="true"
            />
            <dd className="mt-1 text-xl font-bold tabular-nums">
              {loading ? (
                <Skeleton className="mx-auto h-6 w-8" aria-label="Cargando" />
              ) : (
                stats[item.key]
              )}
            </dd>
            <dt className="mt-0.5 text-xs text-muted-foreground">
              {item.label}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
