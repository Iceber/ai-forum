#!/usr/bin/env bash
# e2e/setup-e2e.sh
#
# Start all services via docker compose, apply migration, and seed E2E data.
# Designed for both local development and CI.
#
# Usage:
#   ./e2e/setup-e2e.sh          # Build images and start
#   ./e2e/setup-e2e.sh --no-build  # Use cached images (faster re-runs)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BUILD_FLAG="--build"
if [ "${1:-}" = "--no-build" ]; then
  BUILD_FLAG=""
fi

cd "$PROJECT_ROOT"

echo "=== E2E Setup ==="

# ─── 1. Start containers ────────────────────────────────────────────
echo "--- Starting docker compose $BUILD_FLAG ---"
docker compose up -d $BUILD_FLAG

# ─── 2. Wait for PostgreSQL ─────────────────────────────────────────
echo "--- Waiting for PostgreSQL ---"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U aiforum -d aiforum >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    break
  fi
  if [ "$i" = "30" ]; then
    echo "ERROR: PostgreSQL did not become ready in 60s"
    docker compose logs postgres
    exit 1
  fi
  sleep 2
done

# ─── 3. Apply migration ─────────────────────────────────────────────
echo "--- Applying database migration ---"
cat "$PROJECT_ROOT/backend/migrations/001_initial_schema.sql" \
  | docker compose exec -T postgres psql -U aiforum -d aiforum

# ─── 4. Seed E2E data ───────────────────────────────────────────────
echo "--- Seeding E2E test data ---"
cat "$SCRIPT_DIR/seed.sql" \
  | docker compose exec -T postgres psql -U aiforum -d aiforum

# ─── 5. Wait for backend and frontend ───────────────────────────────
echo "--- Waiting for backend (3001) and frontend (3000) ---"
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3001/api/bars >/dev/null 2>&1 && \
     curl -fsS http://localhost:3000 >/dev/null 2>&1; then
    echo "All services are ready."
    break
  fi
  if [ "$i" = "30" ]; then
    echo "ERROR: Services did not become ready in 60s"
    docker compose logs
    exit 1
  fi
  sleep 2
done

echo ""
echo "=== E2E environment is ready ==="
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001/api"
echo ""
echo "Run smoke tests with:"
echo "  ./e2e/backend-e2e-smoke.sh"
echo "  ./e2e/frontend-e2e-smoke.sh"
