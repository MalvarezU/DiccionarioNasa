#!/usr/bin/env bash
# E2E contra BD local (jamás prod): levanta pg, migra, siembra y corre Playwright.
# Uso: ./scripts/e2e-local.sh [--project=screenplay-public] [-- <args playwright>]
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.test ]; then
  echo "Falta .env.test (copialo de .env.test.example)" >&2
  exit 1
fi
set -a; . ./.env.test; set +a

case "${DATABASE_URL:-}" in
  *localhost*|*127.0.0.1*|*piiyaak_test*) ;;
  *) echo "BLOQUEADO: DATABASE_URL no es local: ${DATABASE_URL}" >&2; exit 1 ;;
esac

echo "→ pg local..."
systemctl --user start podman.socket 2>/dev/null || true
podman compose -f docker-compose.test.yml up -d
echo "→ migraciones..."
npx prisma migrate deploy
echo "→ seed de prueba..."
bun run prisma/seed-test.ts
echo "→ playwright $*..."
npx playwright test "$@"
