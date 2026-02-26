#!/usr/bin/env bash
# e2e/run-all.sh
#
# One-command E2E test runner: setup → backend smoke → frontend smoke → teardown.
# Suitable for local development and CI.
#
# Usage:
#   ./e2e/run-all.sh              # Full run (build + test + teardown)
#   ./e2e/run-all.sh --no-build   # Skip image rebuild (faster re-runs)
#   ./e2e/run-all.sh --keep       # Don't teardown after tests (for debugging)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Parse arguments
SETUP_ARGS=""
KEEP=false
for arg in "$@"; do
  case "$arg" in
    --no-build) SETUP_ARGS="--no-build" ;;
    --keep)     KEEP=true ;;
  esac
done

# Ensure teardown runs on exit (unless --keep)
if [ "$KEEP" = false ]; then
  trap '"$SCRIPT_DIR/teardown-e2e.sh"' EXIT
fi

echo "=========================================="
echo "  AI Forum — Full E2E Test Suite"
echo "=========================================="
echo ""

# ─── Setup ───────────────────────────────────────────────────────────
"$SCRIPT_DIR/setup-e2e.sh" $SETUP_ARGS
echo ""

# ─── Backend smoke ───────────────────────────────────────────────────
"$SCRIPT_DIR/backend-e2e-smoke.sh"
echo ""

# ─── Frontend smoke ──────────────────────────────────────────────────
"$SCRIPT_DIR/frontend-e2e-smoke.sh"
echo ""

echo "=========================================="
echo "  All E2E tests passed!"
echo "=========================================="
