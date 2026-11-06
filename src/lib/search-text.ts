/**
 * Normalización para búsqueda insensible a mayúsculas y tildes
 * ("maiz" encuentra "Maíz"). NFD descompone los diacríticos combinados
 * y \p{Diacritic} los elimina; lowercase recién al final, sobre la
 * forma desnuda. Compartido entre /cursos y el gestor de cursos.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}
