# Pendientes del Proyecto Diccionario Nasa Yuwe

## Bug Crítico: SQLite en Vercel

### Problema
SQLite usa archivos locales (`prisma/db/custom.db`), pero Vercel tiene filesystem efímero:
- La base de datos se pierde en cada cold-start
- El seed crea datos pero no persisten
- API returns 500 porque no puede conectar a la DB

### Soluciones

#### Opción 1: PostgreSQL (Producción recomendada)
Migrar a PostgreSQL usando Vercel Postgres, Neon o Supabase.

**Pasos:**
1. Crear cuenta en Neon (https://neon.tech) o Vercel Postgres
2. Crear nuevo proyecto PostgreSQL
3. Obtener connection string
4. Actualizar `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
5. Actualizar variable de entorno `DATABASE_URL` en Vercel
6. Hacer `prisma migrate deploy` y `prisma db seed`

#### Opción 2: Seed en cada deploy (Demo/Desarrollo)
Si solo se necesita demo, la DB puede regenerarse en cada cold-start.

**Pasos:**
1. Agregar script de seed al build de Vercel
2. O ejecutar seed manualmente después de cada deploy

### Tareas
- [ ] Decidir entre PostgreSQL o seed por deploy
- [ ] Implementar solución
- [ ] Verificar que las APIs responden correctamente
- [ ] Probar panel de administración (/admin)
- [ ] Probar búsqueda y palabras favoritas

## Notas
- Commit actual: `c732bc6` (fix: rename exported function from middleware to proxy)
- Rama: main
- Repo: https://github.com/MarioAlvarez-Co/DiccionarioNasa
- URL Vercel: https://diccionario-nasa.vercel.app