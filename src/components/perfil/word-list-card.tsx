"use client";

import Link from "next/link";
import { Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PerfilWord } from "./types";

interface WordListCardProps {
  word: PerfilWord;
  /** Línea de meta bajo el contenido (p. ej. "Guardada el 12 de mar"). */
  meta: string;
  /** Acción a la derecha del título (p. ej. botón Quitar). */
  action?: React.ReactNode;
}

/**
 * Tarjeta de palabra para /perfil (variant="page"): misma estética que las
 * del panel del diccionario (panel-content.tsx), pero con datos del SERVIDOR.
 * El panel NO usa este componente a propósito: lee de almacenamiento local
 * con fallback y su hook ya está cubierto por tests de regresión finos;
 * unificar la UI arriesgaba romperlo por ahorrar unas líneas. Si algún día
 * se extrae, este es el candidato a componente compartido presentacional.
 */
export function WordListCard({ word, meta, action }: WordListCardProps) {
  return (
    <Card className="group bg-surface-container-low border border-outline-variant/30 shadow-sm transition-all duration-200 hover:shadow-lg hover:border-primary/40">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-serif text-lg text-primary">
            <Link
              href={`/diccionario?palabra=${word.id}`}
              className="rounded-sm hover:text-primary/80 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {word.nasaYuwe}
            </Link>
          </CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            {word.category && (
              <Badge
                variant="secondary"
                className="text-2xs shrink-0 px-2 py-0.5 h-5 bg-secondary-container text-montana border border-secondary/30"
              >
                {word.category}
              </Badge>
            )}
            {action}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm font-medium text-foreground">{word.spanish}</p>
        {word.pronunciation && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Volume2 className="h-3 w-3" aria-hidden="true" />[
            {word.pronunciation}]
          </p>
        )}
        <p className="mt-2 text-2xs text-muted-foreground">{meta}</p>
      </CardContent>
    </Card>
  );
}
