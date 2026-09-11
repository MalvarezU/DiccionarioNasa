/**
 * Roles de Piiyaak (B1.5).
 *
 * - `user`: consulta, favoritos, historial, juegos/cursos.
 * - `editor`: como user + crear/editar/publicar fichas, subir audios,
 *   importar corpus. SIN eliminar, archivar en lote ni revertir.
 * - `admin`: acceso total (usuarios, lote, borrado, bitácora, reversión).
 *
 * Decisión documentada (vitácora 2026-09-11): `User.role` sigue `String`
 * en BD (cero migración, cero riesgo en prod); el RBAC se aplica en código.
 * El enum nativo queda para la migración grande de B2.0.
 */

export const ROLES = ["user", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

/** Roles con permiso de edición de contenido (editor y admin). */
export function canEdit(role?: string | null): boolean {
  return role === "editor" || role === "admin";
}

/** Solo admin: usuarios, lote, borrado, reversión. */
export function canAdminister(role?: string | null): boolean {
  return role === "admin";
}

/** Quién puede entrar al panel /admin (el proxy y la API afinan por acción). */
export function canAccessAdminPanel(role?: string | null): boolean {
  return canEdit(role);
}
