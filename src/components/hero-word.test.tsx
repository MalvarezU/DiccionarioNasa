"use client";

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroWordOfDay } from "./hero-word";
import type { WordOfDayData } from "@/hooks/use-word-of-day";

const mockWord: WordOfDayData = {
  id: "w1",
  spanish: "Sol",
  nasaYuwe: "sek",
  pronunciation: "sek",
  audioUrl: "https://example.com/sek.mp3",
  culturalContext: null,
  category: "naturaleza",
  examples: null,
};

function renderHero(word: WordOfDayData | null = mockWord) {
  const onVerFicha = vi.fn();
  render(
    <HeroWordOfDay
      word={word}
      date="2026-05-24"
      isFromCache={false}
      onVerFicha={onVerFicha}
    />,
  );
  return { onVerFicha };
}

describe("HeroWordOfDay", () => {
  it("renders a stable H1 plus the giant Nasa Yuwe word", () => {
    renderHero();
    expect(
      screen.getByRole("heading", { name: "Palabra del día" }),
    ).toBeDefined();
    const giant = screen.getByTestId("hero-word");
    expect(giant.textContent).toBe("sek");
    expect(giant.getAttribute("aria-label")).toBe(
      "Palabra del día en Nasa Yuwe: sek",
    );
  });

  it("renders eyebrow date, gloss, pronunciation, category and play button", () => {
    renderHero();
    expect(screen.getByText(/24.*may/i)).toBeDefined();
    expect(screen.getByText("Sol")).toBeDefined();
    expect(screen.getByText("[sek]")).toBeDefined();
    expect(screen.getByText("naturaleza")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Escuchar pronunciación de sek" }),
    ).toBeDefined();
  });

  it("calls onVerFicha when opening the full entry", async () => {
    const { onVerFicha } = renderHero();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ver ficha completa/i }));
    expect(onVerFicha).toHaveBeenCalledWith("w1");
  });

  it("hides the play button when there is no audio", () => {
    renderHero({ ...mockWord, audioUrl: null });
    expect(
      screen.queryByRole("button", { name: /escuchar pronunciación/i }),
    ).toBeNull();
    // Word content still renders
    expect(screen.getByTestId("hero-word")).toBeDefined();
  });

  it("renders the sober resting state instead of null when offline without cache", () => {
    render(<HeroWordOfDay word={null} date={null} isFromCache={false} onVerFicha={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Palabra del día" }),
    ).toBeDefined();
    expect(screen.getByText(/hoy la palabra descansa/i)).toBeDefined();
    expect(
      screen.getByRole("link", { name: /explorar el diccionario/i }),
    ).toBeDefined();
  });
});
