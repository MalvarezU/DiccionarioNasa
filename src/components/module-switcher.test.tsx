"use client";

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleSwitcher } from "./module-switcher";

describe("ModuleSwitcher", () => {
  it("renders a labelled navigation with three real module links", () => {
    render(<ModuleSwitcher />);
    expect(
      screen.getByRole("navigation", { name: "Módulos" }),
    ).toBeDefined();
    const diccionario = screen.getByRole("link", { name: "Diccionario" });
    const juegos = screen.getByRole("link", { name: "Juegos" });
    const cursos = screen.getByRole("link", { name: "Cursos" });
    expect(diccionario.getAttribute("href")).toBe("/diccionario");
    expect(juegos.getAttribute("href")).toBe("/juegos");
    expect(cursos.getAttribute("href")).toBe("/cursos");
  });

  it("marks Diccionario as the active segment", () => {
    render(<ModuleSwitcher />);
    const diccionario = screen.getByRole("link", { name: "Diccionario" });
    expect(diccionario.getAttribute("aria-current")).toBe("page");
    expect(diccionario.className).toMatch(/bg-\[#F6EEDC\]/);
  });
});
