# Matriz de Autorización — Endpoints API (Web)

> Generada a partir de `src/app/api/**/route.ts`. Guard = helper usado para autorizar.
> Roles: `anon` (sin sesión), `user`, `editor`, `admin`. `editor` incluye `admin` (jerarquía).

## Convención

- **Público** = sin autenticación requerida (pero puede usar sesión si existe).
- **Auth** = requiere sesión válida (cualquier rol).
- **Editor+** = `requireRole("editor")` (editor/admin).
- **Admin** = `requireRole("admin")` / `requireAdmin()`.

## Matriz

| Ruta | Método | Guard | Roles permitidos | Notas |
|---|---|---|---|---|
| `/api` | GET | none | anon+ | Health/info |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth | anon+ | Login OAuth/credentials |
| `/api/auth/register` | POST | none (rate-limit) | anon | 10/min/IP |
| `/api/auth/verify` | GET | token | anon (token) | Verificación email |
| `/api/auth/verify-request` | POST | none | anon | Solicita verificación |
| `/api/auth/recover` | POST | none | anon | Recuperación |
| `/api/auth/reset` | POST | token | anon (token) | Reset password |
| `/api/auth/demo` | POST | **none** ⚠️ | anon | **Riesgo:** crea/exponer demo user+password en prod |
| `/api/dictionary/search` | GET | none | anon+ | Público |
| `/api/dictionary/words` | GET | none | anon+ | Solo PUBLISHED esperado |
| `/api/dictionary/words/[id]` | GET | none | anon+ | Drafts no visibles (verificar) |
| `/api/dictionary/featured` | GET | none | anon+ | Público |
| `/api/dictionary/word-of-day` | GET | none | anon+ | Público |
| `/api/dictionary/export` | GET | none | anon+ | **Verificar:** solo PUBLISHED + paginado + límite |
| `/api/dictionary/favorites` | GET/POST | getServerSession | user+ | IDOR check |
| `/api/dictionary/history` | GET/POST/DELETE | getServerSession | user+ | IDOR check |
| `/api/dictionary/suggest` | POST | none | anon+ | **Verificar:** rate-limit |
| `/api/dictionary/update-audio` | POST | Admin | admin | OK |
| `/api/courses` | GET | none | anon+ | Público |
| `/api/courses` | POST | Editor+ | editor/admin | OK |
| `/api/courses/[id]` | GET | none | anon+ | Drafts no visibles (verificar) |
| `/api/courses/[id]` | PATCH | Editor+ | editor/admin | OK |
| `/api/courses/[id]` | DELETE | Admin | admin | OK |
| `/api/courses/[id]/progress` | GET | Auth | user+ | IDOR check |
| `/api/courses/[id]/reorder` | POST | Editor+ | editor/admin | OK |
| `/api/modules` | POST | Editor+ | editor/admin | OK |
| `/api/modules/[id]` | PATCH | Editor+ | editor/admin | OK |
| `/api/modules/[id]` | DELETE | Admin | admin | OK |
| `/api/modules/[id]/lessons` | POST | Editor+ | editor/admin | OK |
| `/api/lessons/[id]` | PATCH/PUT/DELETE | Editor+ | editor/admin | OK |
| `/api/games/words` | GET | none | anon+ | Público |
| `/api/games/result` | POST | Auth | user+ | Manipulación de score (verificar) |
| `/api/games/result` | GET | Auth | user+ | Solo propios (verificar) |
| `/api/progress` | POST | Auth | user+ | IDOR check |
| `/api/media/[id]` | GET | none | anon+ | Redirect a R2 público |
| `/api/media/[id]` | DELETE | Editor+ | editor/admin | OK |
| `/api/admin/users` | GET | Admin | admin | OK |
| `/api/admin/users/[id]` | PATCH/DELETE | Admin | admin | Mass assignment check |
| `/api/admin/words` | GET/POST | Editor+ | editor/admin | OK |
| `/api/admin/words/[id]` | PUT/PATCH | Editor+ | editor/admin | OK (PATCH admin-only? verificar) |
| `/api/admin/words/[id]` | DELETE | Admin | admin | OK |
| `/api/admin/words/bulk-status` | POST | Admin | admin | Límite de IDs |
| `/api/admin/import` | POST | Editor+ | editor/admin | Validación CSV |
| `/api/admin/import/preview` | POST | Editor+ | editor/admin | OK |
| `/api/admin/import/confirm` | POST | Editor+ | editor/admin | OK |
| `/api/admin/stats` | GET | Editor+ | editor/admin | OK |
| `/api/admin/upload-audio` | POST | Editor+ | editor/admin | Validación MIME/ext/size |
| `/api/admin/upload-image` | POST | Editor+ | editor/admin | Validación (verificar SVG) |
| `/api/admin/delete-audio` | POST | Editor+ | editor/admin | SSRF check en URL |
| `/api/admin/audit-logs` | GET | Editor+ | editor/admin | **Considerar:** solo admin para audit |
| `/api/admin/audit-logs/export` | GET | Editor+ | editor/admin | CSV injection check |
| `/api/sync` | GET | Auth | user+ | Cursor validation |
| `/api/sync/seed` | GET | Auth | user+ | Paginación/límites |

## Hallazgos iniciales de la matriz

1. `auth/demo` sin guard → riesgo en producción (exponer credenciales). Recomendación: deshabilitar si `NODE_ENV=production` o requerir flag.
2. `audit-logs` accesible por editor → considerar restringir a admin (no repudio).
3. `words/[id]` PATCH con Editor+, DELETE con Admin → consistente, OK.
4. Endpoints públicos (search, words, courses, games/words) → verificar filtro PUBLISHED y rate-limit.
5. IDOR en endpoints Auth (favorites, history, progress, games/result) → pendiente prueba.
