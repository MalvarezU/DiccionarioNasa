"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Coordinates "one audio at a time" inside a container element.
 *
 * Each row keeps its own `<audio>` + play state (same pattern as WordCard);
 * the parent only pauses every other track when a new one starts. Pausing is
 * done by querying the container's audio elements, so rows stay decoupled and
 * no prop-drilling of refs is needed. Safe when rows unmount (the dropdown
 * closes on select): `stopAll` pauses everything before unmounting.
 */
export function useSingleAudio<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const pauseOthers = useCallback((exceptId: string | null) => {
    containerRef.current
      ?.querySelectorAll("audio")
      .forEach((el) => {
        if (el.getAttribute("data-word-id") !== exceptId) el.pause();
      });
  }, []);

  const handlePlayState = useCallback(
    (id: string | null) => {
      setPlayingId(id);
      // Pause every other track. Their own onPause handler syncs the icon
      // locally without notifying back, so there is no feedback loop.
      if (id) pauseOthers(id);
    },
    [pauseOthers]
  );

  const stopAll = useCallback(() => {
    pauseOthers(null);
    setPlayingId(null);
  }, [pauseOthers]);

  return { containerRef, playingId, handlePlayState, stopAll };
}
