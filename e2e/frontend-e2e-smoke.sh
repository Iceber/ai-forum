#!/usr/bin/env bash
# e2e/frontend-e2e-smoke.sh
#
# Frontend E2E smoke tests: page accessibility + content verification + API integration.
# Runs against a live frontend (3000) and backend (3001).
#
# Environment variables:
#   FRONTEND_URL  — Frontend base URL  (default: http://localhost:3000)
#   API_URL       — Backend API URL    (default: http://localhost:3001/api)
#   TEST_BAR_ID   — UUID of a seeded bar (default: 00000000-0000-4000-a000-000000000011)
#
# Usage:
#   ./e2e/frontend-e2e-smoke.sh
#   FRONTEND_URL=http://localhost:3000 API_URL=http://localhost:3001/api ./e2e/frontend-e2e-smoke.sh

set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
API_URL="${API_URL:-http://localhost:3001/api}"
TEST_BAR_ID="${TEST_BAR_ID:-00000000-0000-4000-a000-000000000011}"

echo "=== Frontend E2E Smoke Tests ==="
echo "FRONTEND_URL: $FRONTEND_URL"
echo "API_URL:      $API_URL"
echo "TEST_BAR_ID:  $TEST_BAR_ID"
echo ""

# ─── Phase 1: Page accessibility ────────────────────────────────────
echo "--- Phase 1: Page accessibility ---"
curl -fsS "$FRONTEND_URL"          >/dev/null
echo "  ✓ GET / returned 200"
curl -fsS "$FRONTEND_URL/login"    >/dev/null
echo "  ✓ GET /login returned 200"
curl -fsS "$FRONTEND_URL/register" >/dev/null
echo "  ✓ GET /register returned 200"
echo ""

# ─── Phase 2: Page content verification ─────────────────────────────
echo "--- Phase 2: Page content verification ---"

HOME=$(curl -sS "$FRONTEND_URL")
echo "$HOME" | grep -qi '__next\|__NEXT_DATA__\|frontend-e2e-bar' || {
  echo "  ✗ Home page missing expected Next.js content"
  echo "$HOME" | head -20
  exit 1
}
echo "  ✓ Home page contains Next.js content"

LOGIN=$(curl -sS "$FRONTEND_URL/login")
echo "$LOGIN" | grep -qi 'type="email"\|type="password"\|name="email"\|name="password"' || {
  echo "  ✗ Login page missing form inputs"
  exit 1
}
echo "  ✓ Login page contains form inputs"

REGISTER=$(curl -sS "$FRONTEND_URL/register")
echo "$REGISTER" | grep -qi 'type="email"\|type="password"' || {
  echo "  ✗ Register page missing form inputs"
  exit 1
}
echo "  ✓ Register page contains form inputs"
echo ""

# ─── Phase 3: Backend API integration ───────────────────────────────
echo "--- Phase 3: Backend API integration ---"

# 3a. Verify bars API returns data
BARS=$(curl -sS "$API_URL/bars")
echo "$BARS" | jq -e '.data | length >= 1' >/dev/null || {
  echo "  ✗ No bars returned from API"
  echo "$BARS"
  exit 1
}
echo "  ✓ Bars API returned data"

# 3b. Register a test user
EMAIL="fe-e2e-$(date +%s)@example.com"
REG_RESP=$(curl -sS -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Password123!\",\"nickname\":\"FE-E2E\"}" \
  -w $'\n%{http_code}')
REG_STATUS=$(echo "$REG_RESP" | tail -n1)
REG_BODY=$(echo "$REG_RESP" | sed '$d')
[ "$REG_STATUS" = "201" ] || {
  echo "  ✗ Register failed ($REG_STATUS)"
  echo "$REG_BODY"
  exit 1
}
TOKEN=$(echo "$REG_BODY" | jq -r '.data.accessToken')
echo "  ✓ User registered"

# 3c. Create a post
POST_RESP=$(curl -sS -X POST "$API_URL/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"barId\":\"$TEST_BAR_ID\",\"title\":\"Frontend E2E Post\",\"content\":\"Created during E2E\",\"contentType\":\"plaintext\"}" \
  -w $'\n%{http_code}')
POST_STATUS=$(echo "$POST_RESP" | tail -n1)
POST_BODY=$(echo "$POST_RESP" | sed '$d')
[ "$POST_STATUS" = "201" ] || {
  echo "  ✗ Create post failed ($POST_STATUS)"
  echo "$POST_BODY"
  exit 1
}
POST_ID=$(echo "$POST_BODY" | jq -r '.data.id')
echo "  ✓ Post created (ID: $POST_ID)"

# 3d. Create a reply
REPLY_RESP=$(curl -sS -X POST "$API_URL/posts/$POST_ID/replies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"E2E reply","contentType":"plaintext"}' \
  -w $'\n%{http_code}')
REPLY_STATUS=$(echo "$REPLY_RESP" | tail -n1)
REPLY_BODY=$(echo "$REPLY_RESP" | sed '$d')
[ "$REPLY_STATUS" = "201" ] || {
  echo "  ✗ Create reply failed ($REPLY_STATUS)"
  echo "$REPLY_BODY"
  exit 1
}
echo "  ✓ Reply created"

# 3e. Verify bar detail page
BAR_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$FRONTEND_URL/bars/$TEST_BAR_ID")
[ "$BAR_STATUS" = "200" ] || {
  echo "  ✗ Bar detail page returned $BAR_STATUS"
  exit 1
}
echo "  ✓ Bar detail page returned 200"

# 3f. Verify post detail page
POST_PAGE_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$FRONTEND_URL/posts/$POST_ID")
[ "$POST_PAGE_STATUS" = "200" ] || {
  echo "  ✗ Post detail page returned $POST_PAGE_STATUS"
  exit 1
}
echo "  ✓ Post detail page returned 200"

echo ""
echo "=== All frontend E2E smoke checks passed ==="
