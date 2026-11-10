import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

import { SeedDispatchModal } from "./SeedDispatchModal"

const RUN_OK = {
  id: 101,
  status: "completed",
  conclusion: "success",
  // Posterior al dispatchedAt capturado en el dispatch (el mock corre "ahora").
  createdAt: new Date(Date.now() + 60_000).toISOString(),
  updatedAt: new Date(Date.now() + 120_000).toISOString(),
  inputs: { dry_run: true },
  htmlUrl: "https://github.com/o/r/actions/runs/101",
}

function mockFetchOnce(body: unknown, status = 200) {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status })
  )
}

function renderModal() {
  const onOpenChange = vi.fn()
  render(<SeedDispatchModal open={true} onOpenChange={onOpenChange} />)
  return { onOpenChange }
}

async function flush() {
  await act(async () => {})
}

describe("SeedDispatchModal [Fase D W1]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it("idle: título, descripción, campo opcional y dry_run activado", async () => {
    mockFetchOnce({ runs: [], totalCount: 0, page: 1, per_page: 10 })
    renderModal()
    await flush()

    expect(screen.getByText("Generar contenido offline")).toBeDefined()
    expect(
      screen.getByText(
        "Crea el paquete de contenido para la aplicación móvil. Esta acción consume minutos de GitHub Actions."
      )
    ).toBeDefined()
    expect(screen.getByPlaceholderText("Vacío = versión actual")).toBeDefined()
    expect(screen.getByText("Solo verificar, sin publicar")).toBeDefined()
    const checkbox = screen.getByRole("checkbox")
    expect(checkbox.getAttribute("data-state")).toBe("checked")
    expect(screen.getByText("Revisar")).toBeDefined()
  })

  it("confirmando: muestra el resumen elegido y el aviso de publicación", async () => {
    mockFetchOnce({ runs: [], totalCount: 0, page: 1, per_page: 10 })
    renderModal()
    await flush()

    // Modo publicación: desmarcar dry_run.
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByText("Revisar"))

    expect(screen.getByText("¿Generar el paquete de contenido?")).toBeDefined()
    expect(screen.getByText(/Versión: actual · Modo: publicación/)).toBeDefined()
    expect(
      screen.getByText(
        "Con modo publicación, el contenido nuevo quedará disponible para la aplicación."
      )
    ).toBeDefined()
    expect(screen.getByText("Generar")).toBeDefined()
  })

  it("doble clic en Generar emite un solo POST y exito cierra el ciclo", async () => {
    vi.useFakeTimers()
    mockFetchOnce({ runs: [], totalCount: 0, page: 1, per_page: 10 })
    renderModal()
    await flush()

    fireEvent.click(screen.getByText("Revisar"))
    expect(screen.getByText(/Versión: actual · Modo: verificación/)).toBeDefined()

    mockFetchOnce(
      { run: null, status: "dispatched", correlationId: "11111111-2222-4333-8444-555555555555", ref: "main", inputs: { dry_run: true } },
      202
    )
    mockFetchOnce({ runs: [{ ...RUN_OK }], totalCount: 1, page: 1, per_page: 10 })

    fireEvent.click(screen.getByText("Generar"))
    fireEvent.click(screen.getByText("Generar"))
    await flush()

    const posts = vi
      .mocked(global.fetch)
      .mock.calls.filter(([url, init]) => String(url).includes("/dispatch") && (init as RequestInit)?.method === "POST")
    expect(posts).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    await flush()

    expect(screen.getByText("Contenido generado correctamente.")).toBeDefined()
    expect(screen.getByText("Cerrar")).toBeDefined()
  })

  it("fallo: run con conclusion fallida muestra mensaje accionable y escape", async () => {
    vi.useFakeTimers()
    mockFetchOnce({ runs: [], totalCount: 0, page: 1, per_page: 10 })
    renderModal()
    await flush()

    fireEvent.click(screen.getByText("Revisar"))
    mockFetchOnce(
      { run: null, status: "dispatched", correlationId: "11111111-2222-4333-8444-555555555555", ref: "main", inputs: { dry_run: true } },
      202
    )
    mockFetchOnce({
      runs: [{ ...RUN_OK, conclusion: "failure" }],
      totalCount: 1,
      page: 1,
      per_page: 10,
    })

    fireEvent.click(screen.getByText("Generar"))
    await flush()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    await flush()

    expect(screen.getByText(/terminó con estado: failure/)).toBeDefined()
    expect(screen.getByText("Continuar con el flujo manual en GitHub")).toBeDefined()
    expect(screen.getByText("Reintentar")).toBeDefined()
  })

  it("polling: 3 fallos 502 con backoff detienen el ciclo con mensaje", async () => {
    vi.useFakeTimers()
    mockFetchOnce({ runs: [], totalCount: 0, page: 1, per_page: 10 })
    renderModal()
    await flush()

    fireEvent.click(screen.getByText("Revisar"))
    mockFetchOnce(
      { run: null, status: "dispatched", correlationId: "11111111-2222-4333-8444-555555555555", ref: "main", inputs: { dry_run: true } },
      202
    )
    mockFetchOnce({ message: "No se pudo obtener el estado de las ejecuciones" }, 502)
    mockFetchOnce({ message: "No se pudo obtener el estado de las ejecuciones" }, 502)
    mockFetchOnce({ message: "No se pudo obtener el estado de las ejecuciones" }, 502)

    fireEvent.click(screen.getByText("Generar"))
    await flush()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    await flush()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    await flush()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000)
    })
    await flush()

    expect(
      screen.getByText("No se pudo obtener el estado. Revisar manualmente en GitHub Actions.")
    ).toBeDefined()
    // Sin más timers pendientes: el polling se detuvo.
    expect(vi.getTimerCount()).toBe(0)
  })

  it("dispatch 400 muestra el mensaje del endpoint y permite reintentar", async () => {
    mockFetchOnce({ runs: [], totalCount: 0, page: 1, per_page: 10 })
    renderModal()
    await flush()

    fireEvent.click(screen.getByText("Revisar"))
    mockFetchOnce({ message: "content_version: formato inválido" }, 400)

    fireEvent.click(screen.getByText("Generar"))
    await flush()

    expect(screen.getByText("content_version: formato inválido")).toBeDefined()
    expect(screen.getByText("Reintentar")).toBeDefined()
  })

  it("historial: lista los últimos runs con estado y dry_run", async () => {
    mockFetchOnce({ runs: [RUN_OK], totalCount: 1, page: 1, per_page: 10 })
    renderModal()
    await flush()

    expect(screen.getByText("Historial")).toBeDefined()
    expect(screen.getByText(/101/)).toBeDefined()
    expect(screen.getByText("success")).toBeDefined()
  })
})
