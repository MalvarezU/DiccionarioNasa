import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"
import * as skeletons from "@/components/skeletons"

/**
 * Política de la app: todo skeleton es gris (--muted) y estático.
 *
 * Estos tests existen porque la regresión ya ocurrió: siete `animate-pulse`
 * en cinco archivos vivían fuera del primitive y ningún test los veía, porque
 * los tests de skeletons solo miran el primitive y sus data-slot. Acá se
 * atrapan en dos frentes:
 * (1) cada skeleton exportado, renderizado; (2) cualquier `animate-pulse` nuevo
 * en el código fuente, con una lista de excepciones explícita.
 */

// jsdom no expone import.meta.url como file:, así que la raíz sale del cwd
// (vitest corre desde la raíz del proyecto en todos los scripts del repo).
const RAIZ_FUENTE = resolve(process.cwd(), "src")

// Único `animate-pulse` permitido: el icono de estado de la descarga offline.
// Es una señal de actividad sobre un icono, no un placeholder de contenido.
const PULSO_PERMITIDO: Record<string, number> = {
  "components/download-banner.tsx": 1,
}

function archivosFuente(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivosFuente(ruta)
    const esFuente = /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)
    return esFuente ? [ruta] : []
  })
}

describe("política de skeletons: gris y estático", () => {
  const componentes = Object.entries(skeletons) as Array<[string, React.ComponentType]>

  it("cada skeleton exportado usa --muted y no tiene animación ni verde", () => {
    expect(componentes.length).toBeGreaterThan(0)
    for (const [nombre, Componente] of componentes) {
      const { container, unmount } = render(<Componente />)
      expect(container.innerHTML, `${nombre} contiene animate-*`).not.toMatch(/animate-/)
      for (const bloque of Array.from(container.querySelectorAll('[data-slot="skeleton"]'))) {
        const clase = bloque.getAttribute("class") ?? ""
        expect(clase, `${nombre}: bloque sin bg-muted`).toContain("bg-muted")
        expect(clase, `${nombre}: bloque en verde`).not.toContain("bg-accent")
      }
      unmount()
    }
  })

  it("no hay animate-pulse en el código fuente fuera de la excepción permitida", () => {
    const hallazgos: Record<string, number> = {}
    for (const ruta of archivosFuente(RAIZ_FUENTE)) {
      const cuenta = readFileSync(ruta, "utf8").split("animate-pulse").length - 1
      if (cuenta > 0) hallazgos[relative(RAIZ_FUENTE, ruta).split(sep).join("/")] = cuenta
    }
    expect(hallazgos).toEqual(PULSO_PERMITIDO)
  })
})
