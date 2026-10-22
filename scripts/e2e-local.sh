#!/usr/bin/env bash
# E2E contra BD local (jamás prod): levanta la BD, migra, siembra y corre Playwright.
# Engine: usa .env.test.mysql (MariaDB, rama feat/mysql) si existe; si no, .env.test (Postgres).
# Uso: ./scripts/e2e-local.sh [--project=screenplay-public] [-- <args playwright>]
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.test"
if [ -f ".env.test.mysql" ]; then
  ENV_FILE=".env.test.mysql"
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "Falta $ENV_FILE (copialo de .env.test.example o .env.test.mysql.example)" >&2
  exit 1
fi
set -a; . "./$ENV_FILE"; set +a
# R2 test (Fase 5-6): si existe .env.r2.test se suma al entorno para que el
# dev server de Playwright suba al bucket de test. Sin él, los uploads 500.
if [ -f ".env.r2.test" ]; then
  echo "→ R2 test env (.env.r2.test)..."
  set -a; . ./.env.r2.test; set +a
fi

COMPOSE_FILE="docker-compose.test.yml"
case "${DATABASE_URL:-}" in
  mysql://*|mariadb://*)
    COMPOSE_FILE="docker-compose.test.mysql.yml" ;;
  postgresql://*|postgres://*) ;;
  *) echo "BLOQUEADO: DATABASE_URL no es local: ${DATABASE_URL}" >&2; exit 1 ;;
esac
case "${DATABASE_URL:-}" in
  *localhost*|*127.0.0.1*|*piiyaak_test*) ;;
  *) echo "BLOQUEADO: DATABASE_URL no es local: ${DATABASE_URL}" >&2; exit 1 ;;
esac

echo "→ BD local ($COMPOSE_FILE)..."
systemctl --user start podman.socket 2>/dev/null || true
podman compose -f "$COMPOSE_FILE" up -d
echo "→ migraciones..."
npx prisma migrate deploy
# seed-test.ts solo consolida palabras existentes: primero el seed principal
# (351 palabras del CSV) y luego el seed de prueba (admin + curso demo).
echo "→ seed de diccionario..."
bun run prisma/seed.ts
echo "→ seed de prueba..."
bun run prisma/seed-test.ts
echo "→ playwright $*..."
npx playwright test "$@"
