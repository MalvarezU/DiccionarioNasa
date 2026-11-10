#!/usr/bin/env bash
# Export listo para Hostinger (cPanel + MariaDB 10.11 + phpMyAdmin).
# Genera un .sql importable sin CREATE DATABASE ni DEFINER.
# Flujo: MariaDB local 3307 -> migrate deploy (baseline mysql) -> seed -> dump compatible.
# Uso:
#   ./scripts/hostinger-export.sh [--reseed] [--skip-migrate] [--skip-seed]
# Salida:
#   dist/hostinger/piiyaak-hostinger-<fecha>.sql + piiyaak-hostinger-latest.sql
set -euo pipefail
cd "$(dirname "$0")/.."

RESEED=false
SKIP_MIGRATE=false
SKIP_SEED=false
for arg in "$@"; do
  case "$arg" in
    --reseed) RESEED=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    --skip-seed) SKIP_SEED=true ;;
    *) echo "Flag desconocido: $arg (usa --reseed, --skip-migrate, --skip-seed)" >&2; exit 1 ;;
  esac
done

ENV_FILE=".env.test.mysql"
if [ -f "$ENV_FILE" ]; then
  set -a; . "./$ENV_FILE"; set +a
else
  export DATABASE_URL="${DATABASE_URL:-mysql://test:test@localhost:3307/piiyaak_test}"
  echo "→ sin $ENV_FILE, uso DATABASE_URL=$DATABASE_URL"
fi

case "${DATABASE_URL:-}" in
  mysql://*|mariadb://*) ;;
  *) echo "BLOQUEADO: DATABASE_URL no es MySQL/MariaDB local: ${DATABASE_URL:-vacío}" >&2; exit 1 ;;
esac
case "${DATABASE_URL:-}" in
  *localhost*|*127.0.0.1*|*piiyaak_test*) ;;
  *) echo "BLOQUEADO: solo BD local (localhost/127.0.0.1/piiyaak_test). Nada de prod." >&2; exit 1 ;;
esac

COMPOSE_FILE="docker-compose.test.mysql.yml"
CONTAINER="piiyaak-test-db-mariadb"
DB_NAME="piiyaak_test"
DB_USER="test"
DB_PASS="test"

echo "→ MariaDB local ($COMPOSE_FILE)..."
systemctl --user start podman.socket 2>/dev/null || true
podman compose -f "$COMPOSE_FILE" up -d

echo "→ espero MariaDB (healthcheck)..."
for i in $(seq 1 60); do
  if podman exec "$CONTAINER" mariadb-admin -u"$DB_USER" -p"$DB_PASS" ping --silent 2>/dev/null; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "MariaDB no respondió en 60 intentos" >&2
    podman logs "$CONTAINER" --tail 50 || true
    exit 1
  fi
  sleep 2
done

if [ "$SKIP_MIGRATE" = false ]; then
  echo "→ migrate deploy (baseline mysql)..."
  npx prisma migrate deploy
else
  echo "→ salto migrate (--skip-migrate)"
fi

if [ "$SKIP_SEED" = false ]; then
  echo "→ seed diccionario..."
  if [ "$RESEED" = true ]; then
    npx tsx prisma/seed.ts -- --force 2>/dev/null || npx tsx prisma/seed.ts --force
  else
    npx tsx prisma/seed.ts
  fi
else
  echo "→ salto seed (--skip-seed)"
fi

OUT_DIR="dist/hostinger"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$OUT_DIR/piiyaak-hostinger-$STAMP.sql"
LATEST="$OUT_DIR/piiyaak-hostinger-latest.sql"
TMP_RAW="$(mktemp)"

echo "→ dump compatible phpMyAdmin..."
podman exec "$CONTAINER" mariadb-dump \
  -u"$DB_USER" -p"$DB_PASS" \
  --no-create-db \
  --no-tablespaces \
  --single-transaction \
  --routines --events \
  --set-charset --default-character-set=utf8mb4 \
  --skip-set-charset \
  "$DB_NAME" > "$TMP_RAW"

# Limpieza para cPanel: sin DEFINER ni SQL_LOG_BIN.
grep -v -E '^(-- |/\*!40101 SET @@SQL_LOG_BIN|CREATE DATABASE|USE `)' "$TMP_RAW" | \
  sed -E 's/DEFINER=`[^`]+`@`[^`]+`//g' > "$OUT.tmp"
rm -f "$TMP_RAW"

{
  echo "-- Piiyaak export para Hostinger — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "-- Origen: MariaDB 10.11 local ($DB_NAME) + Prisma baseline mysql + seed-data.csv"
  echo "-- Import: cPanel → phpMyAdmin → BD con collation utf8mb4_unicode_ci → Importar este archivo"
  echo "-- No incluye CREATE DATABASE: la BD se crea en cPanel."
  echo "SET NAMES utf8mb4;"
  echo "SET FOREIGN_KEY_CHECKS=0;"
  echo ""
  cat "$OUT.tmp"
  echo ""
  echo "SET FOREIGN_KEY_CHECKS=1;"
} > "$OUT"
rm -f "$OUT.tmp"
cp -f "$OUT" "$LATEST"

SIZE="$(du -h "$OUT" | cut -f1)"
echo ""
echo "✓ listo: $OUT ($SIZE)"
echo "  latest: $LATEST"
echo ""
echo "Pasos en Hostinger:"
echo "  1. cPanel → MySQL Databases: crear BD + usuario, asignar privilegios."
echo "  2. phpMyAdmin → la BD → Operations → Collation: utf8mb4_unicode_ci."
echo "  3. Import → elegir $(basename "$OUT") → Go."
echo "  4. Node.js App → DATABASE_URL=\"mysql://USUARIO:CLAVE@127.0.0.1:3306/NOMBRE_BD\" (127.0.0.1, no localhost)."
echo "  5. Variables R2/SMTP/NEXTAUTH_URL según .env.example + docs/database.md §9.4."
echo "  6. Si el .sql supera el límite de phpMyAdmin, avisar: se parte por tabla."
