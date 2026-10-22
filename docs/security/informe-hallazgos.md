# Informe de Hallazgos — Evaluación de Seguridad (Fase 1: Automatizado)

> Rama: `security/evaluacion-seguridad` · Fecha: 2026-10-22 · Entorno: local (staging pendiente)

## 1. Resumen ejecutivo

| Fuente | Resultado |
|---|---|
| `npm audit` (web) | 33 vulnerabilidades (1 low, 6 moderate, 24 high, 2 critical) |
| `npm audit` (móvil) | 61 vulnerabilidades (18 moderate, 39 high, 4 critical) |
| `tsc --noEmit` (web) | 0 errores |
| `vitest run` (web) | 914 passed, 1 skipped (95 archivos) |
| Escaneo manual de secretos | 2 hallazgos (demo endpoint, seed default admin) |
| Headers de seguridad HTTP | No configurados (CSP/HSTS/X-Frame-Options/etc.) |
| gitleaks/semgrep | No instalados (pendiente) |

## 2. Hallazgos

### H-01 — Endpoint `/api/auth/demo` expone credenciales y crea usuario demo (Severidad: Alto)

- **Ubicación:** `src/app/api/auth/demo/route.ts`
- **Vector:** Información sensible en respuesta + creación de cuenta demo sin guard.
- **Evidencia:** respuesta incluye `email: 'demo@nasayuwe.com'`, `password: 'demo123'`.
- **Impacto:** enumeración/uso de cuenta demo en producción; escalación si el rol cambia.
- **Remediación:** deshabilitar en producción (`NODE_ENV !== 'production'` o flag), o remover; no exponer password en respuesta.

### H-02 — Seed con contraseña admin por defecto (Severidad: Alto)

- **Ubicación:** `prisma/seed.ts` líneas 10-11, 43.
- **Evidencia:** `ADMIN_PASSWORD || 'AdminNasa2024!'`, email `admin@nasayuwe.com`.
- **Impacto:** si se ejecuta seed en prod sin env vars, cuenta admin predecible.
- **Remediación:** fallar si `ADMIN_PASSWORD` no está definido en prod; no imprimir credenciales.

### H-03 — Sin headers de seguridad HTTP (Severidad: Medio)

- **Ubicación:** `next.config.ts`, `vercel.json`, `src/proxy.ts`.
- **Evidencia:** no hay CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- **Impacto:** XSS/clickjacking/MIME-sniffing más probables.
- **Remediación:** configurar headers en `next.config.ts` (o `vercel.json`) y revisar CSP por rutas.

### H-04 — `xlsx` (SheetJS) con vulnerabilidades sin fix (Severidad: Alto)

- **Ubicación:** `node_modules/xlsx` (importación/exportación de corpus).
- **Evidencia:** GHSA-4r6h-8v6p-xvw6 (prototype pollution), GHSA-5pgg-2g8v-p4x9 (ReDoS). No fix disponible.
- **Impacto:** procesamiento de archivos no confiables (admin import) → DoS/prototype pollution.
- **Remediación:** validar/sanitizar CSV antes de parsear; considerar librería alternativa; limitar tamaño; ejecutar en worker aislado.

### H-05 — `vite` vulnerable (dev/build dependency) (Severidad: Medio/Bajo en prod)

- **Ubicación:** `node_modules/vite` (web y móvil).
- **Impacto:** principalmente dev server; en prod no se sirve vite. Riesgo bajo en producción, pero SCA lo reporta.
- **Remediación:** actualizar a versión parcheada cuando sea compatible.

### H-06 — `uuid < 11.1.1` vía next-auth (Severidad: Medio)

- **Ubicación:** `node_modules/next-auth/node_modules/uuid`.
- **Impacto:** bounds check faltante en v3/v5/v6 cuando se pasa `buf`.
- **Remediación:** actualizar next-auth a versión que use uuid ≥11.1.1.

### H-07 — `undici` DoS (Severidad: Bajo/Medio)

- **Ubicación:** `node_modules/undici`.
- **Remediación:** `npm audit fix`.

### H-08 — Audit logs accesibles por editor (Severidad: Bajo)

- **Ubicación:** `src/app/api/admin/audit-logs/route.ts`, `export/route.ts` usan `requireRole("editor")`.
- **Impacto:** principio de mínimo privilegio; bitácora de auditoría idealmente solo admin.
- **Remediación:** evaluar restringir a `admin` (decisión de negocio).

### H-09 — Rate-limit y lockout en memoria (Severidad: Medio, aceptado)

- **Ubicación:** `src/lib/rate-limit.ts`, `src/lib/login-lockout.ts`.
- **Impacto:** aproximado bajo múltiples instancias serverless (R-03 del SDD).
- **Remediación:** documentar; migrar a Upstash Redis si se exige estricto.

### H-10 — `ignoreBuildErrors: true` en Next (Severidad: Medio)

- **Ubicación:** `next.config.ts`.
- **Impacto:** errores de tipo no bloquean build (F6.3.3 pendiente).
- **Remediación:** eliminar flag y dejar build en verde.

### H-11 — Bucket R2 público por diseño (Severidad: Informativo)

- **Ubicación:** `src/app/api/admin/upload-audio/route.ts` (comentario).
- **Impacto:** audios accesibles sin firma; aceptado por diseño (reproductor/offline). Asegurar que no se suban datos sensibles.
- **Remediación:** documentar política; validar que solo audio se suba (ya se hace).

### H-12 — App móvil: 4 vulnerabilidades críticas (Severidad: Alto)

- **Ubicación:** `piiyaak-app` (expo-router/expo-constants chain, vite).
- **Impacto:** dependencias de toolchain; evaluar si afectan runtime móvil.
- **Remediación:** `npm audit` detallado + actualizar Expo SDK cuando sea viable.

### H-13 — App móvil: cookie de sesión solo en memoria (Severidad: Bajo/Informativo)

- **Ubicación:** `piiyaak-app/src/auth.tsx`, `src/api.ts`.
- **Impacto:** la sesión se pierde al cerrar la app; UX. Si se persiste, usar almacenamiento seguro (SecureStore).
- **Remediación:** decidir política de persistencia; si se persiste, usar SecureStore + cifrado.

## 3. Pruebas manuales pendientes (Fases F2–F6)

Auth (M1), RBAC (M2), admin (M3), diccionario (M4), cursos (M5), juegos (M6), media (M7), sync (M8), infra (M9), privacidad (M10), móvil (MM1–MM5). Ver plan.

## 4. Evidencia

- `docs/security/evidencia/npm-audit-web.txt` (pendiente guardar)
- `docs/security/evidencia/npm-audit-mobile.txt` (pendiente guardar)
- `docs/security/evidencia/tsc.txt`, `vitest.txt`

## 5. Próximos pasos

1. Guardar outputs de auditoría en `evidencia/`.
2. Ejecutar pruebas manuales M1–M4.
3. Remediación de H-01, H-02, H-03, H-04 (prioridad).
4. DAST con ZAP contra staging.
5. Re-test y cierre.

## 6. Hallazgos adicionales (revisión manual M1–M2, 2026-10-22)

### H-14 — Manipulación de puntaje en juegos (Severidad: Medio)

- **Ubicación:** `src/app/api/games/result/route.ts` (POST).
- **Evidencia:** `score` proviene del cliente sin cota superior; `bestScore = Math.max(existing.bestScore, score)`. Racha igual.
- **Impacto:** inflado de marcadores/leaderboard.
- **Remediación:** validar rango por juego, o calcular score server-side a partir de respuestas; firmar/verificar sesión anónima.

### H-15 — Sesiones no invalidadas al cambiar contraseña (Severidad: Bajo)

- **Ubicación:** `src/app/api/auth/reset/route.ts`.
- **Evidencia:** reset actualiza password y marca token usado, pero no revoca JWT existentes (NextAuth JWT stateless).
- **Impacto:** un atacante con sesión robada mantiene acceso hasta expiración.
- **Remediación:** incluir `passwordChangedAt` en JWT y rechazar tokens anteriores; o documentar limitación.

### H-16 — Tokens de verificación/reset con buena entropía (Severidad: Informativo/OK)

- **Ubicación:** `verify-request`, `recover` usan `randomUUID()` (v4, ~122 bits). Single-use y TTL correctos. Anti-enumeración (siempre 200). OK.

### H-17 — IDOR en progress/favoritos/historial (Severidad: OK tras revisión)

- **Ubicación:** `progress/route.ts`, `favorites`, `history` usan `userId` de sesión. OK. Pendiente prueba dinámica (E2E) para confirmar.

## 7. Hallazgos adicionales (revisión manual M3–M4, 2026-10-22)

### H-18 — Paginación con NaN en `/api/admin/words` (Severidad: Bajo)

- **Ubicación:** `src/app/api/admin/words/route.ts` GET.
- **Evidencia:** `parseInt` sin guardia `Number.isFinite`; `Math.max(1, NaN)` = NaN → `skip: NaN` puede error de Prisma.
- **Remediación:** aplicar el patrón de `/api/admin/users` (Number + isFinite + floor).

### H-19 — `status` no validado en creación de palabra (Severidad: Bajo)

- **Ubicación:** `src/app/api/admin/words/route.ts` POST.
- **Evidencia:** `status: status || "DRAFT"` acepta cualquier string.
- **Remediación:** validar contra enum (DRAFT/PUBLISHED/ARCHIVED) o default DRAFT.

### H-20 — `audioUrl` en importación no validado (Severidad: Bajo)

- **Ubicación:** `src/lib/import-helpers.ts` (validateRow) + import routes.
- **Evidencia:** `audioUrl` se acepta como string sin validar host/formato.
- **Remediación:** validar URL (https + host allowlist R2/Supabase) o null.

### H-21 — Sugerencias almacenan input sin sanitizar en audit log (Severidad: Bajo)

- **Ubicación:** `src/app/api/dictionary/suggest/route.ts`.
- **Evidencia:** `term`/`comment` se guardan vía JSON.stringify; riesgo si el panel admin renderiza sin escape.
- **Remediación:** asegurar escape en UI; limitar charset.

### H-22 — Export público con pageSize hasta 1000 (Severidad: Informativo)

- **Ubicación:** `src/app/api/dictionary/export/route.ts`.
- **Evidencia:** `pageSize` max 1000, sin auth; solo PUBLISHED. Aceptable pero vigilar abuso.
- **Remediación:** documentar; considerar rate-limit si se abusa.

## 8. Hallazgos adicionales (revisión manual M5–M8, 2026-10-22)

### H-23 — Cursos/lecciones: autorización y validación consistentes (OK)

- **Ubicación:** `courses/[id]`, `modules`, `lessons`.
- **Evidencia:** GET filtra por status PUBLISHED salvo editor+; PATCH valida status enum; coverImage con allowlist (`isAllowedCoverImageUrl`); DELETE solo admin.
- **Conclusión:** sin hallazgos críticos/altos. Pendiente prueba dinámica de IDOR en progress por usuario.

### H-24 — Media: path traversal protegido (OK)

- **Ubicación:** `src/lib/media/storage.ts` (`audioRefToKey`, `isSafeKey`, `sanitizeFileName`).
- **Evidencia:** rechaza `..` y caracteres fuera de `[\w.\-/]`; delete-audio valida clave.
- **Conclusión:** OK. Bucket R2 público por diseño (H-11).

### H-25 — Sync: cursor/since validados parcialmente (Severidad: Bajo)

- **Ubicación:** `src/app/api/sync/route.ts`, `sync/seed`.
- **Evidencia:** requiere auth; revisar validación de `cursor`/`since` y límites.
- **Remediación:** validar formato de cursor y `since` ISO; limitar pageSize.
