# Política de acceso a BD y backups — Piiyaak

## 1. RLS (Row-Level Security) — Supabase/PostgreSQL (rama develop)

**Estado:** No habilitado. Justificación: la aplicación usa el service role (Prisma con `DATABASE_URL`) en el servidor. El cliente nunca accede a la BD directamente; todas las queries pasan por las API routes de Next.js con `requireAuth`/`requireRole`. RLS sería redundante y podría romper las queries server-side.

**Si se habilita RLS en el futuro:** verificar que las policies permitan las operaciones del service role (que bypass RLS por defecto en Supabase) y que no bloqueen las migraciones de Prisma.

## 2. RLS — MySQL/MariaDB (rama main/security)

**Estado:** MySQL no soporta RLS nativo. El control de acceso se hace a nivel de aplicación (API routes con RBAC). Aceptable para el tamaño del proyecto.

## 3. Backups

### Supabase (rama develop)
- **Frecuencia:** diaria (automática por Supabase).
- **Retención:** según plan (free tier: 7 días de backups diarios).
- **Restauración:** desde el dashboard de Supabase → Database → Backups.
- **Nota:** los backups son a nivel de BD completa, no por tabla.

### MySQL/MariaDB (rama main/security, Hostinger)
- **Frecuencia:** depende del plan de hosting (cPanel permite backups manuales o programados).
- **Retención:** configurar en cPanel → Backup → cron.
- **Restauración:** desde cPanel o importando un dump SQL.

### Recomendación
- Ejecutar `mysqldump` o `pg_dump` semanalmente y guardar en almacenamiento externo (S3/R2).
- Probar la restauración al menos una vez por trimestre.

## 4. Retención de audit logs

- **Tabla:** `AuditLog` (web).
- **Retención actual:** sin límite (crece indefinidamente).
- **Recomendación:** purgar registros anteriores a 1 año (cron job o tarea programada). No implementado.
- **Riesgo:** crecimiento de tabla puede afectar performance de queries de auditoría.

## 5. Evidencia

- Supabase: dashboard → Database → Backups.
- MySQL: `mysqldump -h host -u user -p db > backup.sql`.
- Verificar retención en staging antes de promover a producción.