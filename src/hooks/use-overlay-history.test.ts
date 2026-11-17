import { describe, it, expect, beforeEach, vi } from "vitest";
import { StrictMode } from "react";
import { renderHook, act } from "@testing-library/react";
import {
  useOverlayHistory,
  OVERLAY_HISTORY_MARKER,
  __resetOverlayHistoryForTests,
} from "./use-overlay-history";

function readMarker(): string | null {
  const state = window.history.state as Record<string, unknown> | null;
  const marker = state?.[OVERLAY_HISTORY_MARKER];
  return typeof marker === "string" ? marker : null;
}

function firePopState(state: unknown): void {
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  });
}

describe("useOverlayHistory", () => {
  beforeEach(() => {
    __resetOverlayHistoryForTests();
    window.history.replaceState({}, "");
  });

  it("al abrir empuja una entrada con marcador sin cambiar la URL", () => {
    const urlAntes = window.location.href;
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ open }) => useOverlayHistory(open, onOpenChange),
      { initialProps: { open: false } },
    );

    expect(readMarker()).toBeNull();

    rerender({ open: true });

    const marcador = readMarker();
    expect(typeof marcador).toBe("string");
    expect(window.location.href).toBe(urlAntes);
    expect(result.current).toBeTypeOf("function");
  });

  it("no empuja dos veces en remount con la misma entrada (StrictMode)", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    const onOpenChange = vi.fn();
    // StrictMode re-ejecuta efectos en la misma instancia (mismo id):
    // el segundo setup debe adoptar la entrada, no empujar otra.
    renderHook(({ open }) => useOverlayHistory(open, onOpenChange), {
      initialProps: { open: true },
      wrapper: StrictMode,
    });

    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("popstate con overlay abierto lo cierra sin tocar el historial", () => {
    const backSpy = vi.spyOn(window.history, "back");
    const onOpenChange = vi.fn();
    renderHook(({ open }) => useOverlayHistory(open, onOpenChange), {
      initialProps: { open: true },
    });

    firePopState({ [OVERLAY_HISTORY_MARKER]: "externo" });

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("cerrar con la X hace history.back() para retirar la entrada", () => {
    const backSpy = vi.spyOn(window.history, "back");
    const onOpenChange = vi.fn();
    const { result } = renderHook(
      ({ open }) => useOverlayHistory(open, onOpenChange),
      { initialProps: { open: true } },
    );

    act(() => {
      result.current(false);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("el popstate del back de limpieza no cierra el overlay de abajo", () => {
    const onPadre = vi.fn();
    const onHijo = vi.fn();
    renderHook(({ open }) => useOverlayHistory(open, onPadre), {
      initialProps: { open: true },
    });
    const hijo = renderHook(({ open }) => useOverlayHistory(open, onHijo), {
      initialProps: { open: true },
    });

    // X en el hijo: cierra + back de limpieza.
    act(() => {
      hijo.result.current(false);
    });
    expect(onHijo).toHaveBeenCalledWith(false);

    // Llega el popstate de esa limpieza sobre la entrada viva del padre.
    const marcadorPadre = readMarker();
    firePopState(
      marcadorPadre
        ? { [OVERLAY_HISTORY_MARKER]: marcadorPadre }
        : {},
    );

    expect(onPadre).not.toHaveBeenCalled();
  });

  it("al abrir sobre una entrada huérfana la recicla (sin entrada basura)", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const onDropdown = vi.fn();
    const dropdown = renderHook(
      ({ open }) => useOverlayHistory(open, onDropdown),
      { initialProps: { open: true } },
    );
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const pushes = pushSpy.mock.calls.length;

    // Transición silenciosa dropdown → ficha (setter directo, sin back()).
    dropdown.rerender({ open: false });

    const onFicha = vi.fn();
    renderHook(({ open }) => useOverlayHistory(open, onFicha), {
      initialProps: { open: true },
    });

    // La ficha adoptó la entrada del dropdown: sin push nuevo.
    expect(pushSpy.mock.calls.length).toBe(pushes);
    expect(replaceSpy).toHaveBeenCalled();
    expect(readMarker()).not.toBeNull();
  });

  it("anidados: el atrás cierra primero el de arriba", () => {
    const onFicha = vi.fn();
    const onLogin = vi.fn();
    renderHook(({ open }) => useOverlayHistory(open, onFicha), {
      initialProps: { open: true },
    });
    renderHook(({ open }) => useOverlayHistory(open, onLogin), {
      initialProps: { open: true },
    });

    firePopState({});
    expect(onLogin).toHaveBeenCalledWith(false);
    expect(onFicha).not.toHaveBeenCalled();

    firePopState({});
    expect(onFicha).toHaveBeenCalledWith(false);
  });

  it("sin overlay abierto el popstate se ignora (navegación normal)", () => {
    const onOpenChange = vi.fn();
    renderHook(({ open }) => useOverlayHistory(open, onOpenChange), {
      initialProps: { open: false },
    });

    firePopState({});

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
