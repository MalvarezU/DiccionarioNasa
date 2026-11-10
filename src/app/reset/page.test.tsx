import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import ResetPage from "./page";

// El token se inyecta por query param (?token=). Se usa un estado hoisteded
// para que el mock de useSearchParams lo lea en cada render.
const state = vi.hoisted(() => ({ token: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams(state.token ? `token=${state.token}` : ""),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/navbar", () => ({ NavBar: () => <div data-testid="navbar" /> }));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type,
    disabled,
  }: {
    children: ReactNode;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }) => (
    <button type={type} disabled={disabled}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));
vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) => (
    <label {...props}>{children}</label>
  ),
}));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

async function llenarFormulario(user: ReturnType<typeof userEvent.setup>, password: string, confirm: string) {
  await user.type(screen.getByLabelText("Nueva contraseña"), password);
  await user.type(screen.getByLabelText("Confirmar contraseña"), confirm);
  await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
}

describe("/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    state.token = "";
  });

  it("sin token muestra enlace inválido", () => {
    render(<ResetPage />);
    expect(screen.getByText("Enlace inválido")).toBeDefined();
    expect(screen.getByText(/Falta el token/)).toBeDefined();
  });

  it("con token muestra el formulario de nueva contraseña", () => {
    state.token = "tok-123";
    render(<ResetPage />);
    expect(screen.getByText("Elegir nueva contraseña")).toBeDefined();
    expect(screen.getByLabelText("Nueva contraseña")).toBeDefined();
    expect(screen.getByLabelText("Confirmar contraseña")).toBeDefined();
  });

  it("valida contraseña menor a 8 caracteres", async () => {
    state.token = "tok-123";
    const user = userEvent.setup();
    render(<ResetPage />);
    await llenarFormulario(user, "corta", "corta");
    expect(await screen.findByText(/al menos 8 caracteres/)).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("valida que las contraseñas coincidan", async () => {
    state.token = "tok-123";
    const user = userEvent.setup();
    render(<ResetPage />);
    await llenarFormulario(user, "password1", "password2");
    expect(await screen.findByText(/no coinciden/)).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("envía el POST con token y contraseña, y muestra éxito", async () => {
    state.token = "tok-123";
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ok: true }) as never
    );
    render(<ResetPage />);
    await llenarFormulario(user, "password1", "password1");
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/reset",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "tok-123", password: "password1" }),
        })
      )
    );
    expect(await screen.findByText(/Contraseña actualizada/)).toBeDefined();
  });

  it("muestra el error del servidor cuando la respuesta no es ok", async () => {
    state.token = "tok-123";
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ message: "Token inválido" }, { status: 400 }) as never
    );
    render(<ResetPage />);
    await llenarFormulario(user, "password1", "password1");
    expect(await screen.findByText("Token inválido")).toBeDefined();
  });

  it("muestra error de conexión cuando el fetch falla", async () => {
    state.token = "tok-123";
    const user = userEvent.setup();
    vi.mocked(fetch).mockRejectedValue(new Error("red"));
    render(<ResetPage />);
    await llenarFormulario(user, "password1", "password1");
    expect(await screen.findByText(/Error de conexión/)).toBeDefined();
  });
});