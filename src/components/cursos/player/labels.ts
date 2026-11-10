/**
 * Etiquetas del player sin duplicar lo que el título ya trae.
 *
 * Los títulos en BD suelen incluir la numeración ("Módulo 1: Primeras
 * palabras", "Lección 1.1: Casa y Agua") porque el admin los escribe a
 * mano; el player calcula el número jerárquico por separado. Sin estos
 * helpers la UI muestra "Módulo 1 · Módulo 1: …" y "1.1 · Lección 1.1: …".
 * Si el admin escribe un título sin número, el prefijo sí se muestra.
 */

/** `true` cuando el título ya contiene el número de lección. */
function titleHasLessonNumber(
  moduleIndex: number,
  lessonNumber: number,
  title: string,
): boolean {
  const t = title.toLowerCase()
  const dotted = `${moduleIndex}.${lessonNumber}`
  return (
    t.includes(dotted) ||
    t.includes(`lección ${dotted}`) ||
    t.includes(`leccion ${dotted}`)
  )
}

/**
 * Número jerárquico "2.3" para mostrar junto al título, o `null` cuando el
 * título ya lo contiene (o no hay numeración legacy). Nunca devuelve "".
 */
export function lessonNumberLabel(
  moduleIndex: number,
  lessonNumber: number | null,
  title: string,
): string | null {
  if (lessonNumber === null) return null
  if (titleHasLessonNumber(moduleIndex, lessonNumber, title)) return null
  return `${moduleIndex}.${lessonNumber}`
}

/**
 * Etiqueta del módulo: el título tal cual cuando ya empieza con
 * "Módulo N" (lo habitual), o "Módulo N · {título}" en caso contrario.
 */
export function moduleLabel(moduleIndex: number, moduleTitle: string): string {
  const t = moduleTitle.toLowerCase().trimStart()
  if (t.startsWith(`módulo ${moduleIndex}`) || t.startsWith(`modulo ${moduleIndex}`)) {
    return moduleTitle
  }
  return `Módulo ${moduleIndex} · ${moduleTitle}`
}
