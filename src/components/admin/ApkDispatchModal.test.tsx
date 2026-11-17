import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

import { ApkDispatchModal } from "./ApkDispatchModal"

const BASE_RUN = {
  id: 100,
  status: "completed",
  conclusion: "success",
  createdAt: "2026-11-10T11:19:30Z",
  updatedAt: "2026-11-10T11:19:40Z",
  inputs: { dry_run: true },
  htmlUrl: "https://github.com/o/movil/actions/runs/100",
}

// Caso real del bug: GitHub devuelve createdAt con precisión de segundos,
// anterior al reloj del navegador que despacha después. Por fecha el filtro
// viejo lo descartaba para siempre; por id (101 > base 100) se encuentra.
const NEW_RUN_SECOND_PRECISION = {
  id: 101,
  status: "completed",
  conclusion: "success",
  createdAt: "2026-11-10T11:19:35Z",
  updatedAt: "2026-11-10T11:25:35Z",
  inputs: { dry_run: true },
  htmlUrl: "https://github.com/o/movil/actions/runs/101",
}

function mockFetchOnce(body: unknown, status = 200) {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status })
  )
}

function renderModal() {
  const onOpenChange = vi.fn()
  render(<ApkDispatchModal open={true} onOpenChange={onOpenChange} />)
  return { onOpenChange }
}

async function flush() {
  await act(async () => {})
}

describe("ApkDispatchModal [fix correlación por id]", () => {
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

  it("idle: título, descripción y dry_run activado", async () => {
    mockFetchOnce({ runs: [], totalCount: 0, page: 1, per_page: 10 })
    renderModal()
    await flush()

    expect(screen.getByText("Publicar nueva APK")).toBeDefined()
    expect(
      screen.getByText(
        "Compila la aplicación móvil con la última semilla publicada y la sube a la nube para su descarga. Esta acción consume minutos de GitHub Actions."
      )
    ).toBeDefined()
    expect(screen.getByText("Solo verificar, sin publicar")).toBeDefined()
    const checkbox = screen.getByRole("checkbox")
    expect(checkbox.getAttribute("data-state")).toBe("checked")
    expect(screen.getByText("Revisar")).toBeDefined()
  })

  it("encuentra el run nuevo por id aunque su createdAt sea anterior al dispatch", async () => {
    vi.useFakeTimers()
    mockFetchOnce({ runs: [], totalCount: 0, page: 1, per_page: 10 })
    renderModal()
    await flush()

    fireEvent.click(screen.getByText("Revisar"))

    // Línea base tomada ANTES del POST: solo se conoce el run 100.
    mockFetchOnce({ runs: [{ ...BASE_RUN }], totalCount: 1, page: 1, per_page: 10 })
    mockFetchOnce(
      { run: null, status: "dispatched", correlationId: "11111111-2222-4333-8444-555555555555", ref: "main", inputs: { dry_run: true } },
      202
    )
    mockFetchOnce({ runs: [{ ...NEW_RUN_SECOND_PRECISION }], totalCount: 1, page: 1, per_page: 10 })

    fireEvent.click(screen.getByText("Generar"))
    await flush()

    // Un solo POST aunque la base sume un GET previo.
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
    mockFetchOnce({ runs: [{ ...BASE_RUN }], totalCount: 1, page: 1, per_page: 10 })
    mockFetchOnce(
      { run: null, status: "dispatched", correlationId: "11111111-2222-4333-8444-555555555555", ref: "main", inputs: { dry_run: true } },
      202
    )
    mockFetchOnce({
      runs: [{ ...NEW_RUN_SECOND_PRECISION, conclusion: "failure" }],
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
    mockFetchOnce({ runs: [], totalCount: 0, page: 1, per_page: 10 })
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
    expect(vi.getTimerCount()).toBe(0)
  })

  it("observando: el enlace manual a GitHub ya es visible sin esperar al fallo", async () => {
    vi.useFakeTimers()
    mockFetchOnce({ runs: [{ ...BASE_RUN }], totalCount: 1, page: 1, per_page: 10 })
    renderModal()
    await flush()

    fireEvent.click(screen.getByText("Revisar"))
    mockFetchOnce({ runs: [{ ...BASE_RUN }], totalCount: 1, page: 1, per_page: 10 })
    mockFetchOnce(
      { run: null, status: "dispatched", correlationId: "11111111-2222-4333-8444-555555555555", ref: "main", inputs: { dry_run: true } },
      202
    )
    // El polling todavía no ve el run nuevo.
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ runs: [{ ...BASE_RUN }], totalCount: 1, page: 1, per_page: 10 }), { status: 200 })
    )

    fireEvent.click(screen.getByText("Generar"))
    await flush()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    await flush()

    expect(
      screen.getByText("Generación en curso. El estado se actualiza cada 15 segundos.")
    ).toBeDefined()
    expect(screen.getByText("Continuar con el flujo manual en GitHub")).toBeDefined()
  })

  it("corte global: sin run nuevo tras 45 min el polling se rinde", async () => {
    vi.useFakeTimers()
    mockFetchOnce({ runs: [], totalCount: 0, page: 1, per_page: 10 })
    renderModal()
    await flush()

    fireEvent.click(screen.getByText("Revisar"))
    mockFetchOnce({ runs: [{ ...BASE_RUN }], totalCount: 1, page: 1, per_page: 10 })
    mockFetchOnce(
      { run: null, status: "dispatched", correlationId: "11111111-2222-4333-8444-555555555555", ref: "main", inputs: { dry_run: true } },
      202
    )
    // El run nuevo nunca aparece: solo la base.
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ runs: [{ ...BASE_RUN }], totalCount: 1, page: 1, per_page: 10 }), { status: 200 })
    )

    fireEvent.click(screen.getByText("Generar"))
    await flush()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45 * 60 * 1000 + 15000)
    })
    await flush()

    expect(
      screen.getByText("No se pudo obtener el estado. Revisar manualmente en GitHub Actions.")
    ).toBeDefined()
    expect(vi.getTimerCount()).toBe(0)
  })
})
