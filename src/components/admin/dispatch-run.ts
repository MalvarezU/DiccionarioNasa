/**
 * Correlación del run despachado por id.
 *
 * El endpoint de dispatch de GitHub responde 204 sin cuerpo, así que el
 * cliente nunca conoce el id del run nuevo. Los ids de GitHub son
 * monótonos, por eso se toma una línea base (el id máximo conocido antes
 * del POST) y el primer run con id mayor es el despachado.
 *
 * No se usa `createdAt` porque GitHub lo devuelve con precisión de
 * segundos ("...:35Z") mientras el reloj del navegador tiene milisegundos
 * y además presenta skew respecto a GitHub: la comparación por fecha deja
 * al polling buscando para siempre un run que ya existe.
 */
export function pickDispatchedRun<T extends { id: number }>(
  runs: T[],
  baselineId: number
): T | undefined {
  return runs.filter((r) => r.id > baselineId).sort((a, b) => b.id - a.id)[0]
}

/** Id máximo de una lista de runs; 0 cuando no hay ninguno conocido. */
export function maxRunId<T extends { id: number }>(runs: T[]): number {
  let max = 0
  for (const r of runs) {
    if (r.id > max) max = r.id
  }
  return max
}
