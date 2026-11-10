import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import DiccionarioPage from "./page";

// La página es un composition de componentes ya testeados por separado; acá se
// mockan los hijos y se verifica la lógica propia: carga de destacadas, error,
// estado vacío, apertura de detalle y entrada por query params (?tab/?panel/
// ?palabra).

vi.mock("@/components/navbar", () => ({ NavBar: () => <div data-testid="navbar" /> }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => <div data-testid="footer" /> }));
vi.mock("@/components/pwa/install-banner", () => ({
  InstallBanner: () => <div data-testid="install-banner" />,
}));
vi.mock("@/components/search-bar", () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}));
vi.mock("@/components/word-of-day-card", () => ({
  WordOfDayCard: () => <div data-testid="word-of-day" />,
}));
vi.mock("@/components/explore-section", () => ({
  ExploreSection: () => <div data-testid="explore-section" />,
}));
vi.mock("@/components/favorites-history-panel", () => ({
  FavoritesHistoryPanel: ({
    open,
    initialTab,
  }: {
    open: boolean;
    initialTab: string;
  }) => (
    <div
      data-testid="fav-panel"
      data-open={open ? "true" : "false"}
      data-tab={initialTab}
    />
  ),
}));
vi.mock("@/components/word-detail-card", () => ({
  WordDetailCard: ({ open, wordId }: { open: boolean; wordId: string | null }) => (
    <div
      data-testid="word-detail"
      data-open={open ? "true" : "false"}
      data-word-id={wordId ?? ""}
    />
  ),
}));
vi.mock("@/components/word-card", () => ({
  WordCard: ({
    word,
    onOpen,
  }: {
    word: { id: string; spanish: string };
    onOpen: (id: string) => void;
  }) => (
    <button onClick={() => onOpen(word.id)}>{word.spanish}</button>
  ),
}));
vi.mock("@/components/skeletons", () => ({
  WordCardSkeleton: () => <div data-testid="word-skeleton" />,
}));
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));
vi.mock("next/image", () => ({ default: () => <img alt="" /> }));
vi.mock("@/lib/demo-storage", () => ({ recordLocalHistory: vi.fn() }));

const mockSession: { data: unknown; status: string } = {
  data: null,
  status: "unauthenticated",
};
vi.mock("next-auth/react", () => ({ useSession: () => mockSession }));

const FEATURED = {
  words: [
    { id: "w1", spanish: "Casa", nasaYuwe: "Yat", pronunciation: "yat", category: "sustantivo", culturalContext: "c", audioUrl: null },
    { id: "w2", spanish: "Agua", nasaYuwe: "Yu'", pronunciation: "yu'", category: "sustantivo", culturalContext: "r", audioUrl: null },
  ],
};

function mockFeatured(words: unknown[] = FEATURED.words) {
  vi.mocked(fetch).mockResolvedValue(Response.json({ words }) as never);
}

function setQueryParams(query: string) {
  window.history.pushState({}, "", `/diccionario${query}`);
}

describe("/diccionario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    mockSession.data = null;
    mockSession.status = "unauthenticated";
    window.history.pushState({}, "", "/diccionario");
  });

  it("renderiza el hero, el buscador y las tabs", () => {
    mockFeatured();
    render(<DiccionarioPage />);
    expect(screen.getByText("Diccionario Nasa Yuwe")).toBeDefined();
    expect(screen.getByTestId("search-bar")).toBeDefined();
    expect(screen.getByText("Destacadas")).toBeDefined();
    expect(screen.getByText("Explorar A-Z")).toBeDefined();
  });

  it("muestra skeletons mientras carga y luego las palabras destacadas", async () => {
    mockFeatured();
    render(<DiccionarioPage />);
    expect(screen.getAllByTestId("word-skeleton").length).toBeGreaterThan(0);
    expect(await screen.findByText("Casa")).toBeDefined();
    expect(screen.getByText("Agua")).toBeDefined();
    expect(screen.queryByTestId("word-skeleton")).toBeNull();
  });

  it("error de fetch muestra alerta y Reintentar reintenta", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockRejectedValue(new Error("caído"));
    render(<DiccionarioPage />);
    expect(await screen.findByText(/No pudimos cargar las palabras destacadas/)).toBeDefined();
    await user.click(screen.getByText("Reintentar"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("estado vacío cuando no hay destacadas", async () => {
    mockFeatured([]);
    render(<DiccionarioPage />);
    expect(await screen.findByText(/No hay palabras destacadas/)).toBeDefined();
  });

  it("click en una palabra abre el detalle con su id", async () => {
    const user = userEvent.setup();
    mockFeatured();
    render(<DiccionarioPage />);
    await user.click(await screen.findByText("Casa"));
    await waitFor(() =>
      expect(screen.getByTestId("word-detail").getAttribute("data-open")).toBe("true")
    );
    expect(screen.getByTestId("word-detail").getAttribute("data-word-id")).toBe("w1");
  });

  it("?tab=explore muestra la sección de explorar", async () => {
    setQueryParams("?tab=explore");
    mockFeatured();
    render(<DiccionarioPage />);
    expect(await screen.findByTestId("explore-section")).toBeDefined();
  });

  it("?panel=favorites abre el panel en la pestaña favoritas", async () => {
    setQueryParams("?panel=favorites");
    mockFeatured();
    render(<DiccionarioPage />);
    await waitFor(() =>
      expect(screen.getByTestId("fav-panel").getAttribute("data-open")).toBe("true")
    );
    expect(screen.getByTestId("fav-panel").getAttribute("data-tab")).toBe("favorites");
  });

  it("?palabra=<id> abre el detalle directo (deep-link desde /perfil)", async () => {
    setQueryParams("?palabra=w2");
    mockFeatured();
    render(<DiccionarioPage />);
    await waitFor(() =>
      expect(screen.getByTestId("word-detail").getAttribute("data-open")).toBe("true")
    );
    expect(screen.getByTestId("word-detail").getAttribute("data-word-id")).toBe("w2");
  });
});