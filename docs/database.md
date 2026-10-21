# Base de Datos — Diccionario Nasa Yuwe

## 1. Stack

| Capa | Tecnología |
|------|-----------|
| Motor | PostgreSQL (Supabase en prod, local en dev) |
| ORM | Prisma (`prisma-client-js`) |
| Migraciones | Prisma Migrate (11 migraciones) |
| Extensiones | `unaccent` (búsqueda insensible a acentos) |

**Variables de entorno:**
- `DATABASE_URL` — conexión pooled (Supavisor/pgbouncer)
- `DIRECT_URL` — conexión directa (migraciones)

---

## 2. Diagrama Entidad-Relación

```mermaid
erDiagram
    USER ||--o{ FAVORITE : "guarda"
    USER ||--o{ VIEW_HISTORY : "registra"
    USER ||--o{ SEARCH_HISTORY : "emite"
    USER ||--o{ PASSWORD_RESET : "solicita"
    USER ||--o{ USER_GAME_SESSION : "juega"
    USER ||--o{ USER_LESSON_PROGRESS : "avanza"
    DICTIONARY_WORD ||--o{ FAVORITE : "es favorita de"
    DICTIONARY_WORD ||--o{ VIEW_HISTORY : "es vista por"
    DICTIONARY_WORD ||--o{ AUDIT_LOG : "es auditada"
    DICTIONARY_WORD ||--o{ LESSON : "ilustra"
    COURSE ||--o{ MODULE : "contiene"
    MODULE ||--o{ LESSON : "agrupa"
    LESSON ||--o{ USER_LESSON_PROGRESS : "es progresada por"

    USER {
        cuid id PK
        string email UK
        string name
        string password
        string role "user|editor|admin"
        timestamp emailVerified
        string verifyToken UK
        timestamp verifyExpires
        timestamp createdAt
        timestamp updatedAt
    }

    PASSWORD_RESET {
        cuid id PK
        string userId FK
        string token UK
        timestamp expires
        timestamp usedAt
        timestamp createdAt
    }

    USER_GAME_SESSION {
        cuid id PK
        string userId FK
        string sessionKey
        string game
        int played
        int won
        int bestScore
        int bestStreak
        timestamp createdAt
        timestamp updatedAt
    }

    COURSE {
        cuid id PK
        string title
        string description
        string coverImage
        enum status "DRAFT|PUBLISHED|ARCHIVED"
        boolean sequential
        timestamp createdAt
        timestamp updatedAt
    }

    MODULE {
        cuid id PK
        string courseId FK
        string title
        int order
    }

    LESSON {
        cuid id PK
        string moduleId FK
        string title
        enum type "READ|QUIZ|COMPLETE (DEPRECATED)"
        int order
        int lessonNumber
        string wordId FK
        string payload "DEPRECATED"
        jsonb content
    }

    USER_LESSON_PROGRESS {
        cuid id PK
        string userId FK
        string lessonId FK
        boolean completed
        int score
        timestamp lastVisitedAt
        timestamp completedAt
    }

    MEDIA_ASSET {
        cuid id PK
        string filename
        string mimeType
        int size
        bytes data
        string uploadedBy
        timestamp createdAt
    }

    DICTIONARY_WORD {
        cuid id PK
        string spanish
        string nasaYuwe
        string pronunciation
        string audioUrl
        string illustrationUrl
        string culturalContext
        string category
        string examples
        string status "DRAFT|PUBLISHED|ARCHIVED"
        timestamp createdAt
        timestamp updatedAt
    }

    FAVORITE {
        cuid id PK
        string userId FK
        string wordId FK
        timestamp createdAt
    }

    VIEW_HISTORY {
        cuid id PK
        string userId FK
        string wordId FK
        timestamp createdAt
    }

    SEARCH_HISTORY {
        cuid id PK
        string userId FK
        string query
        timestamp createdAt
    }

    AUDIT_LOG {
        uuid id PK
        string action "CREATE|UPDATE|DELETE|IMPORT"
        string entity
        string entityId
        string changes
        string userId
        string wordId FK
        timestamp createdAt
    }
```

---

## 3. Tablas

### 3.1 `User`

Cuentas de usuario con verificación de email y roles.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | Identificador único |
| `email` | TEXT | UNIQUE, NOT NULL | Email de acceso |
| `name` | TEXT | | Nombre visible |
| `password` | TEXT | | Hash bcrypt |
| `role` | TEXT | NOT NULL, default `'user'` | `user` \| `editor` \| `admin` |
| `emailVerified` | TIMESTAMP | | Fecha de verificación (null = pendiente) |
| `verifyToken` | TEXT | UNIQUE | Token de verificación |
| `verifyExpires` | TIMESTAMP | | Expiración del token |
| `createdAt` | TIMESTAMP | NOT NULL, default `now()` | |
| `updatedAt` | TIMESTAMP | NOT NULL, auto-update | |

**Índices:** `email` (unique), `verifyToken` (unique)

---

### 3.2 `PasswordReset`

Tokens de recuperación de contraseña.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `userId` | TEXT | FK → User, NOT NULL | Usuario que solicita |
| `token` | TEXT | UNIQUE, NOT NULL | Token de un solo uso |
| `expires` | TIMESTAMP | NOT NULL | Expiración |
| `usedAt` | TIMESTAMP | | Fecha de uso (null = disponible) |
| `createdAt` | TIMESTAMP | NOT NULL, default `now()` | |

**Índices:** `token` (unique), `userId`

---

### 3.3 `UserGameSession`

Estadísticas agregadas por usuario y juego (upsert por unique).

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `userId` | TEXT | FK → User, nullable | null = sesión anónima |
| `sessionKey` | TEXT | nullable | Identificador de sesión anónima |
| `game` | TEXT | NOT NULL | Nombre del juego |
| `played` | INT | NOT NULL, default 1 | Partidas jugadas |
| `won` | INT | NOT NULL, default 0 | Partidas ganadas |
| `bestScore` | INT | NOT NULL, default 0 | Mejor puntaje |
| `bestStreak` | INT | NOT NULL, default 0 | Mejor racha |
| `createdAt` | TIMESTAMP | NOT NULL, default `now()` | |
| `updatedAt` | TIMESTAMP | NOT NULL, auto-update | |

**Índices únicos:** `(userId, game)`, `(sessionKey, game)` — permite upsert sin colisionar con NULLs en PG.

---

### 3.4 `Course`

Cursos de la ruta de aprendizaje.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `title` | TEXT | NOT NULL | |
| `description` | TEXT | | |
| `coverImage` | TEXT | | URL de portada (Supabase Storage) |
| `status` | ENUM `ContentStatus` | NOT NULL, default `DRAFT` | |
| `sequential` | BOOLEAN | NOT NULL, default `true` | Si el avance es ordenado |
| `createdAt` | TIMESTAMP | NOT NULL, default `now()` | |
| `updatedAt` | TIMESTAMP | NOT NULL, auto-update | |

---

### 3.5 `Module`

Módulos dentro de un curso.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `courseId` | TEXT | FK → Course, NOT NULL | |
| `title` | TEXT | NOT NULL | |
| `order` | INT | NOT NULL, default 0 | Posición en el curso |

**Índices:** `(courseId, order)`

---

### 3.6 `Lesson`

Lecciones dentro de un módulo. El contenido es un documento JSONB de bloques.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `moduleId` | TEXT | FK → Module, NOT NULL | |
| `title` | TEXT | NOT NULL | |
| `type` | ENUM `LessonType` | NOT NULL, default `READ` | **DEPRECATED** — vive en `content.blocks[]` |
| `order` | INT | NOT NULL, default 0 | Posición en el módulo |
| `lessonNumber` | INT | | Numeración visible ("1.1", "1.2") |
| `wordId` | TEXT | FK → DictionaryWord, nullable | Palabra ilustrativa |
| `payload` | TEXT | | **DEPRECATED** — payload legacy QUIZ/COMPLETE |
| `content` | JSONB | | Documento `{ version, blocks[] }` |

**Índices:** `(moduleId, order)`, `(moduleId, lessonNumber)`

---

### 3.7 `UserLessonProgress`

Progreso del usuario por lección.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `userId` | TEXT | FK → User, NOT NULL | |
| `lessonId` | TEXT | FK → Lesson, NOT NULL | |
| `completed` | BOOLEAN | NOT NULL, default `false` | |
| `score` | INT | | Puntaje (quiz) |
| `lastVisitedAt` | TIMESTAMP | NOT NULL, default `now()` | |
| `completedAt` | TIMESTAMP | | Fecha de completado |

**Índices únicos:** `(userId, lessonId)` — un solo registro por usuario/lección.

---

### 3.8 `MediaAsset`

Imágenes binarias almacenadas en Postgres (bytea), servidas por `/api/media/[id]`.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `filename` | TEXT | NOT NULL | Nombre original |
| `mimeType` | TEXT | NOT NULL | MIME detectado por firma binaria |
| `size` | INT | NOT NULL | Bytes |
| `data` | BYTEA | NOT NULL | Binario |
| `uploadedBy` | TEXT | | userId (sin FK — flexibilidad) |
| `createdAt` | TIMESTAMP | NOT NULL, default `now()` | |

**Índices:** `createdAt`

---

### 3.9 `DictionaryWord`

Palabras del diccionario bilingüe.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `spanish` | TEXT | NOT NULL | Palabra en español |
| `nasaYuwe` | TEXT | NOT NULL | Palabra en Nasa Yuwe |
| `pronunciation` | TEXT | | Guía de pronunciación |
| `audioUrl` | TEXT | | URL de audio (nativo) |
| `illustrationUrl` | TEXT | | URL de ilustración (`/api/media/[id]`) |
| `culturalContext` | TEXT | | Contexto cultural |
| `category` | TEXT | | Categoría gramatical |
| `examples` | TEXT | | Ejemplos (JSON string) |
| `status` | TEXT | NOT NULL, default `PUBLISHED` | `DRAFT` \| `PUBLISHED` \| `ARCHIVED` |
| `createdAt` | TIMESTAMP | NOT NULL, default `now()` | |
| `updatedAt` | TIMESTAMP | NOT NULL, auto-update | |

---

### 3.10 `Favorite`

Palabras marcadas como favoritas por el usuario.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `userId` | TEXT | FK → User, NOT NULL | |
| `wordId` | TEXT | FK → DictionaryWord, NOT NULL | |
| `createdAt` | TIMESTAMP | NOT NULL, default `now()` | |

**Índices únicos:** `(userId, wordId)`

---

### 3.11 `ViewHistory`

Historial de palabras vistas.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `userId` | TEXT | FK → User, NOT NULL | |
| `wordId` | TEXT | FK → DictionaryWord, NOT NULL | |
| `createdAt` | TIMESTAMP | NOT NULL, default `now()` | |

**Índices:** `(userId, wordId)` unique, `(userId, createdAt)`

---

### 3.12 `SearchHistory`

Búsquedas realizadas por el usuario.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | TEXT (cuid) | PK | |
| `userId` | TEXT | FK → User, NOT NULL | |
| `query` | TEXT | NOT NULL | Término buscado |
| `createdAt` | TIMESTAMP | NOT NULL, default `now()` | |

**Índices:** `(userId, createdAt)`

---

### 3.13 `AuditLog`

Registro de auditoría de cambios en el diccionario.

| Columna | Tipo | Constraint | Descripción |
|---------|------|------------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` | |
| `action` | TEXT | NOT NULL | `CREATE` \| `UPDATE` \| `DELETE` \| `IMPORT` |
| `entity` | TEXT | NOT NULL | Entidad afectada |
| `entityId` | TEXT | | ID de la entidad |
| `changes` | TEXT | | JSON string (before/after) |
| `userId` | TEXT | | Responsable (sin FK) |
| `wordId` | TEXT | FK → DictionaryWord, nullable | Palabra relacionada |
| `createdAt` | TIMESTAMP | NOT NULL, default `now()` | |

**Índices:** `(entity, entityId)`, `createdAt`, `(userId, createdAt)`

---

## 4. Enums

| Enum | Valores | Uso |
|------|---------|-----|
| `LessonType` | `READ`, `QUIZ`, `COMPLETE` | `Lesson.type` (DEPRECATED) |
| `ContentStatus` | `DRAFT`, `PUBLISHED`, `ARCHIVED` | `Course.status` |

---

## 5. Relaciones

| De | A | Tipo | On Delete |
|----|---|------|-----------|
| `PasswordReset.userId` | `User.id` | N:1 | CASCADE |
| `UserGameSession.userId` | `User.id` | N:1 | CASCADE |
| `Module.courseId` | `Course.id` | N:1 | CASCADE |
| `Lesson.moduleId` | `Module.id` | N:1 | CASCADE |
| `Lesson.wordId` | `DictionaryWord.id` | N:1 | SET NULL |
| `UserLessonProgress.userId` | `User.id` | N:1 | CASCADE |
| `UserLessonProgress.lessonId` | `Lesson.id` | N:1 | CASCADE |
| `Favorite.userId` | `User.id` | N:1 | CASCADE |
| `Favorite.wordId` | `DictionaryWord.id` | N:1 | CASCADE |
| `ViewHistory.userId` | `User.id` | N:1 | CASCADE |
| `ViewHistory.wordId` | `DictionaryWord.id` | N:1 | CASCADE |
| `SearchHistory.userId` | `User.id` | N:1 | CASCADE |
| `AuditLog.wordId` | `DictionaryWord.id` | N:1 | SET NULL |

---

## 6. Extensiones PostgreSQL

| Extensión | Motivo |
|-----------|--------|
| `unaccent` | Búsqueda insensible a acentos en `/api/dictionary/search` |

---

## 7. Migraciones (orden cronológico)

| # | Archivo | Descripción |
|---|---------|-------------|
| 1 | `20260710221902_init` | Tablas base: User, DictionaryWord, Favorite, ViewHistory, SearchHistory, AuditLog |
| 2 | `20260911173000_audit_uuid` | AuditLog con UUID default + índice userId/createdAt |
| 3 | `20260911180000_auth_verify` | Verificación de email + tabla PasswordReset + backfill |
| 4 | `20260911190000_games_courses` | UserGameSession, Course, Module, Lesson, UserLessonProgress + enums |
| 5 | `20260911190500_relations_noop` | No-op (campos opuestos de relación en Prisma) |
| 6 | `20260911191000_games_unique` | Índices únicos para upsert de sesiones de juego |
| 7 | `20260912220000_lesson_number` | Columna lessonNumber + backfill por módulo |
| 8 | `20260925120000_enable_unaccent` | Extensión unaccent |
| 9 | `20261003201222_lesson_content_blocks_and_course_cover` | Course.coverImage + Lesson.content (JSONB) |
| 10 | `20261003204000_media_assets_in_postgres` | Tabla MediaAsset (bytea) |
| 11 | `20261016120000_word_illustration_url` | DictionaryWord.illustrationUrl |

---

## 8. Decisiones de diseño

1. **IDs `cuid()` en TEXT** — legibles en URL, sin enumeración secuencial.
2. **AuditLog con UUID** — expone menos información de volumen que un serial.
3. **MediaAsset en Postgres (bytea)** — mismo origen que la API → el service worker del PWA puede cachear offline sin CORS.
4. **`illustrationUrl` como string, no relación** — mismo patrón que `audioUrl`: el binario vive en MediaAsset pero se referencia por URL para cacheabilidad.
5. **`Lesson.content` como JSONB** — permite bloques tipados sin esquema fijo por tipo; la validación vive en `src/lib/courses/blocks.ts`.
6. **`Lesson.type` DEPRECATED** — el tipo ahora vive en cada bloque de `content`; se conserva para backfill.
7. **Unique compuesto en UserGameSession** — `(userId, game)` y `(sessionKey, game)` permiten upsert atómico sin colisionar con NULLs.
8. **`unaccent` explícito en migración** — paridad entre prod (Supabase panel) y dev local.

---

## 9. Variante MariaDB (rama `feat/mysql`)

Rama de pruebas que migra el motor a **MariaDB** (paridad con Hostinger: su hosting Web/Cloud usa MariaDB y cPanel instala 10.11 por defecto). `main` sigue en PostgreSQL/Supabase.

### 9.1 Diferencias PG → MariaDB

| Aspecto | PostgreSQL | MariaDB |
|---|---|---|
| Provider Prisma | `postgresql` + `directUrl` | `mysql` (sin `directUrl`) |
| Migraciones | 11 migraciones PG | 1 baseline (`*_mysql_baseline`) |
| `String` por defecto | texto ilimitado | `VARCHAR(191)` — campos largos con `@db.Text`/`@db.LongText` |
| `Json` | JSONB | alias de LONGTEXT |
| `Bytes` (MediaAsset.data) | BYTEA | LONGBLOB |
| Búsqueda sin acentos | `unaccent()` + `lower()` | collation `utf8mb4_unicode_ci` (case- y accent-insensitive) |
| `contains`/`equals` con `mode: "insensitive"` | soportado | **no soportado** — se elimina `mode`; la collation lo cubre |
| `ORDER BY RANDOM()` | ✓ | `ORDER BY RAND()` |
| Placeholders raw | `$1, $2…` | `?` (bind por posición) |
| Identificadores con mayúscula | `"nasaYuwe"` | `` `nasaYuwe` `` (backticks) |

### 9.2 Infra local de pruebas

- `docker-compose.test.mysql.yml`: MariaDB 10.11 efímera en `localhost:3307` (BD `piiyaak_test`, collation `utf8mb4_unicode_ci`).
- `.env.test.mysql` (local, gitignored) → `DATABASE_URL="mysql://test:test@localhost:3307/piiyaak_test"`.
- `./scripts/e2e-local.sh` auto-detecta el motor: usa `.env.test.mysql` si existe; si no, `.env.test` (Postgres).
- Si levantás el dev server en un puerto distinto del 3000 (p. ej. para no chocar con otro server), exportá `NEXTAUTH_URL=http://localhost:<puerto>` además de `E2E_BASE_URL`: si no, el signout de NextAuth apunta al puerto viejo y el test de logout falla.
- npm: `bun run db:test:up:mysql`.

### 9.3 Verificación de paridad

1. Unit: `bun run test:run` (mocks).
2. Typecheck + lint.
3. E2E: `./scripts/e2e-local.sh` (levanta MariaDB, migra, siembra y corre Playwright).
4. Checklist de paridad PG vs MariaDB sobre el corpus real: búsqueda con acentos, `RAND()` con exclusión, round-trip de imagen (LONGBLOB), upsert de sesiones con `sessionKey` NULL, sync incremental por cursor `updatedAt`.

### 9.4 Notas para el host (cPanel/Hostinger)

- El host no admite flags de servidor: la collation se fija **por base de datos** desde phpMyAdmin (Operations → Collation) antes de importar.
- Sin Remote MySQL: correr migraciones + seed localmente y exportar dump → importar por phpMyAdmin.
- Verificar `max_allowed_packet` del plan contra `MediaAsset.data` (LONGBLOB).
- La app Next.js en cPanel es un plan aparte (Node.js App); `127.0.0.1`, no `localhost`.
