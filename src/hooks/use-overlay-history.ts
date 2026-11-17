"use client";

import { useCallback, useEffect, useId, useRef } from "react";

/**
 * Historial para overlays públicos (Dialog/Sheet/AlertDialog de Radix).
 *
 * Problema: Radix no empuja entrada de historial al abrir, así que el gesto
 * "atrás" en la PWA instalada sale de la app (o salta de ruta) con el modal
 * abierto. Patrón ya probado en el player de cursos
 * (`use-lesson-navigation.ts`): entrada de historial + `popstate`.
 *
 * Contrato:
 * - Al abrir (`open` false → true): `history.pushState` con el MISMO URL
 *   (solo añade estado + marcador; Next no navega y su estado se preserva —
 *   su `pushState` parcheado solo despacha al router cuando cambia la URL, y
 *   copia los internals `__NA`/`__PRIVATE_NEXTJS_INTERNALS_TREE` a la entrada
 *   nueva, así que su `onPopState` tampoco recarga al atravesarla).
 * - En `popstate` (atrás del navegador/gesto): si hay overlay abierto se
 *   cierra el de arriba de la pila, sin cambiar de ruta.
 * - Al cerrar desde la UI (X / Escape / seleccionar / clic fuera): si nuestra
 *   entrada sigue viva se hace `history.back()` para retirarla — el próximo
 *   atrás navega de verdad, sin entradas basura.
 * - Pila a nivel módulo: anidados (ficha → login) cierran el de arriba
 *   primero, cada uno con su propia entrada.
 * - Sin overlay abierto: el `popstate` se ignora y el atrás es navegación
 *   normal del navegador.
 *
 * Dos formas de cerrar, sin carreras:
 * - `handleOpenChange(false)` (retornada): cierre iniciado por la UI con
 *   limpieza de `back()`. Usarla en `onOpenChange` de Radix y en botones de
 *   cierre explícito (X custom, "Cancelar", "Entendido", Escape manual).
 * - Setter original (`setOpen(false)` directo): cierre silencioso SIN
 *   tocar el historial. Usarlo SOLO en transiciones overlay → overlay del
 *   mismo gesto (elegir resultado del buscador abre la ficha; "Sugerir" abre
 *   su modal): la entrada huérfana queda enterrada y la cadena de
 *   `skip` la salta al salir, sin `back()`+`push()` en la misma tarea
 *   (esa combinación tiene orden no garantizado entre navegadores).
 */

export const OVERLAY_HISTORY_MARKER = "__piiyaakOverlay" as const;

interface OverlayRecord {
  id: string;
  /** Cierra el overlay sin tocar el historial (el popstate ya atravesó). */
  close: () => void;
  /** true si el registro ya fue retirado por un popstate de usuario. */
  popped: boolean;
}

/** Pila de overlays abiertos; el último es el de arriba. */
const overlayStack: OverlayRecord[] = [];
/**
 * `back()` de limpieza en vuelo. Cada uno produce exactamente un `popstate`
 * que se consume sin cerrar nada (el overlay ya se cerró desde la UI).
 */
let pendingCleanups = 0;
let popListenerInstalled = false;

function hasRecord(id: string): boolean {
  return overlayStack.some((record) => record.id === id);
}

function removeRecord(id: string): void {
  const index = overlayStack.findIndex((record) => record.id === id);
  if (index >= 0) overlayStack.splice(index, 1);
}

function readMarker(): string | null {
  if (typeof window === "undefined" || window.history.state == null) return null;
  const marker = (window.history.state as Record<string, unknown>)[
    OVERLAY_HISTORY_MARKER
  ];
  return typeof marker === "string" ? marker : null;
}

function onOverlayPopState(): void {
  if (pendingCleanups > 0) {
    pendingCleanups -= 1;
    // La entrada donde aterrizamos puede ser huérfana (overlay cerrado por
    // transición silenciosa): seguir atrás hasta una entrada viva o sin
    // marcador. La URL nunca cambia, así que es invisible para el usuario.
    const marker = readMarker();
    if (marker !== null && !hasRecord(marker)) {
      pendingCleanups += 1;
      window.history.back();
    }
    return;
  }
  const top = overlayStack[overlayStack.length - 1];
  if (!top) return; // Sin overlay: atrás = navegación normal.
  top.popped = true;
  removeRecord(top.id);
  top.close();
}

function ensurePopListener(): void {
  if (popListenerInstalled || typeof window === "undefined") return;
  popListenerInstalled = true;
  window.addEventListener("popstate", onOverlayPopState);
}

/**
 * Sincroniza un overlay controlado (`open` + `onOpenChange`) con el
 * historial. Retorna el `handleOpenChange` a pasar al `onOpenChange` de
 * Radix (y a cierres explícitos de la UI). Ver contrato arriba.
 */
export function useOverlayHistory(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  options?: { id?: string },
): (next: boolean) => void {
  const fallbackId = useId();
  const id = options?.id ?? fallbackId;
  const onOpenChangeRef = useRef(onOpenChange);
  // Último callback sin re-suscribir efectos (patrón useLatest).
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    ensurePopListener();
  }, []);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const actual = readMarker();
    // Adoptar si la entrada actual ya es la nuestra (remount en StrictMode
    // en dev, o doble efecto): no empujar dos veces.
    if (actual !== id) {
      const state = window.history.state as Record<string, unknown> | null;
      if (actual !== null && !hasRecord(actual)) {
        // Entrada huérfana nuestra (cerrada por transición silenciosa en el
        // mismo gesto, p. ej. elegir resultado del buscador → ficha):
        // reciclarla en vez de enterrarla. Sin `back()`+`push()` en la misma
        // tarea (orden no garantizado) y sin entradas basura: el próximo
        // atrás navega de verdad.
        window.history.replaceState(
          { ...(state ?? {}), [OVERLAY_HISTORY_MARKER]: id },
          "",
        );
      } else {
        window.history.pushState(
          { ...(state ?? {}), [OVERLAY_HISTORY_MARKER]: id },
          "",
        );
      }
    }
    removeRecord(id);
    overlayStack.push({
      id,
      close: () => onOpenChangeRef.current(false),
      popped: false,
    });
    return () => {
      removeRecord(id);
    };
  }, [open, id]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next || typeof window === "undefined") {
        onOpenChange(next);
        return;
      }
      const record = overlayStack.find((entry) => entry.id === id);
      if (record && !record.popped) {
        // Cierre desde la UI con entrada propia viva: retirarla para que el
        // próximo atrás navegue en vez de caer en una entrada muerta.
        removeRecord(id);
        pendingCleanups += 1;
        onOpenChange(false);
        window.history.back();
      } else {
        // Ya lo cerró un popstate (o nunca empujó): solo sincronizar estado.
        onOpenChange(false);
      }
    },
    [id, onOpenChange],
  );

  return handleOpenChange;
}

/** Solo tests: vacía pila y contadores entre casos (el listener persiste). */
export function __resetOverlayHistoryForTests(): void {
  overlayStack.length = 0;
  pendingCleanups = 0;
}
