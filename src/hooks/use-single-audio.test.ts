import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSingleAudio } from "./use-single-audio";

describe("useSingleAudio", () => {
  it("starts with no track playing", () => {
    const { result } = renderHook(() => useSingleAudio());
    expect(result.current.playingId).toBeNull();
  });

  it("tracks the playing id and clears it", () => {
    const { result } = renderHook(() => useSingleAudio());
    act(() => result.current.handlePlayState("w1"));
    expect(result.current.playingId).toBe("w1");
    act(() => result.current.handlePlayState(null));
    expect(result.current.playingId).toBeNull();
  });

  it("stopAll clears the playing id", () => {
    const { result } = renderHook(() => useSingleAudio());
    act(() => result.current.handlePlayState("w2"));
    act(() => result.current.stopAll());
    expect(result.current.playingId).toBeNull();
  });

  it("pauses other audio elements in the container", () => {
    const { result } = renderHook(() => useSingleAudio<HTMLDivElement>());
    const container = document.createElement("div");
    const pauseA = vi.fn();
    const pauseB = vi.fn();
    const audioA = document.createElement("audio");
    audioA.setAttribute("data-word-id", "a");
    audioA.pause = pauseA;
    const audioB = document.createElement("audio");
    audioB.setAttribute("data-word-id", "b");
    audioB.pause = pauseB;
    container.appendChild(audioA);
    container.appendChild(audioB);
    (result.current.containerRef as { current: unknown }).current = container;

    act(() => result.current.handlePlayState("b"));
    expect(pauseA).toHaveBeenCalled();
    expect(pauseB).not.toHaveBeenCalled();
  });
});
