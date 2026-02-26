#!/usr/bin/env bash
# e2e/teardown-e2e.sh
#
# Stop and remove all E2E containers and volumes.
#
# Usage:
#   ./e2e/teardown-e2e.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=== E2E Teardown ==="
docker compose down -v
echo "=== Done ==="
