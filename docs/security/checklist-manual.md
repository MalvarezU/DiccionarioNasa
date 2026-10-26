# Checklist de pruebas manuales — Evaluación de Seguridad

## S9 — App móvil (MM1–MM5)

| ID | Prueba | Pasos | Resultado |
|---|---|---|---|
| MM1 | Sesión persistente | 1. Login con email/password. 2. Cerrar app. 3. Abrir app → sesión restaurada. 4. Logout → sesión borrada. | ☐ |
| MM2 | Favoritas offline → sync | 1. Favoritar palabra sin conexión. 2. Conectar. 3. Sync manual. 4. Verificar en web que aparece. | ☐ |
| MM3 | Audios offline | 1. Favoritar palabra con audio. 2. Esperar descarga. 3. Modo avión → reproducir audio. | ☐ |
| MM4 | Ilustraciones offline | 1. Favoritar palabra con ilustración. 2. Esperar descarga. 3. Modo avión → ver imagen. | ☐ |
| MM5 | Búsqueda <150ms | 1. Abrir en gama básica Android. 2. Buscar "pa". 3. Verificar respuesta <150ms (log). | ☐ |

## S10 — Infra/privacidad (M9–M10)

| ID | Prueba | Pasos | Resultado |
|---|---|---|---|
| M9 | Headers HTTP | `curl -sI https://dominio/` → verificar X-Frame-Options, X-Content-Type-Options, HSTS, CSP, Referrer-Policy, Permissions-Policy. | ☐ |
| M10 | robots.txt | `curl https://dominio/robots.txt` → verificar Disallow /admin/ y /api/. Visitar /admin → meta noindex presente. | ☐ |

## S12 — IDOR dinámico

| Prueba | Pasos | Resultado |
|---|---|---|
| Favoritas aisladas | 1. Login como user A, favoritar palabra X. 2. Login como user B. 3. Verificar que X no aparece en favoritas de B. | ☐ |
| Historial aislado | Similar a favoritas. | ☐ |
| Progreso aislado | 1. User A juega y obtiene score. 2. User B verifica que no ve el score de A. | ☐ |
| Admin endpoints | 1. Login como user (no admin). 2. GET /api/admin/users → 401/403. 3. GET /api/admin/words → 401/403. | ☐ |
| Sync aislado | 1. User A sincroniza. 2. User B sincroniza → no recibe datos de A. | ☐ |

## S11 — DAST con ZAP (requiere staging)

| Paso | Descripción | Resultado |
|---|---|---|
| 1 | Instalar OWASP ZAP. | ☐ |
| 2 | Configurar target: URL de staging. | ☐ |
| 3 | Ejecutar scan automático (spider + active scan). | ☐ |
| 4 | Clasificar hallazgos (falsos positivos vs reales). | ☐ |
| 5 | Documentar en `docs/security/dast-zap.md`. | ☐ |

## Evidencia a guardar

- `docs/security/evidencia/npm-audit-web.txt` — output de `npm audit`.
- `docs/security/evidencia/npm-audit-mobile.txt` — output de `npm audit` en piiyaak-app.
- `docs/security/evidencia/tsc.txt` — output de `tsc --noEmit`.
- `docs/security/evidencia/vitest.txt` — output de `vitest run`.
- `docs/security/evidencia/headers.txt` — output de `curl -sI`.
- `docs/security/evidencia/zap-report.html` — reporte de ZAP.