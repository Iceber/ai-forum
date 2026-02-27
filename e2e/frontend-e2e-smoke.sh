#!/usr/bin/env bash
# e2e/frontend-e2e-smoke.sh
#
# Frontend E2E smoke tests (Phase 2):
# - Public pages accessibility/content
# - New Phase 2 pages accessibility
# - API integration for auth + bars + admin + personal center

set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
API_URL="${API_URL:-http://localhost:3001/api}"
TEST_BAR_ID="${TEST_BAR_ID:-00000000-0000-4000-a000-000000000011}"

echo "=== Frontend E2E Smoke Tests (Phase 2) ==="
echo "FRONTEND_URL: $FRONTEND_URL"
echo "API_URL:      $API_URL"
echo "TEST_BAR_ID:  $TEST_BAR_ID"
echo ""

require_status() {
  local actual="$1"
  local expected="$2"
  local body="$3"
  local context="$4"
  if [ "$actual" != "$expected" ]; then
    echo "✗ $context failed: expected $expected got $actual"
    echo "$body"
    exit 1
  fi
}

# ─── Phase 1: Public pages accessibility ─────────────────────────────
echo "--- Phase 1: Public pages accessibility ---"
for path in "/" "/login" "/register" "/create-bar" "/profile" "/profile/replies" "/profile/bars" "/profile/created-bars" "/profile/edit" "/admin" "/admin/bars" "/admin/bars/pending" "/admin/actions"; do
  STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$FRONTEND_URL$path")
  [ "$STATUS" = "200" ] || {
    echo "  ✗ GET $path returned $STATUS"
    exit 1
  }
  echo "  ✓ GET $path returned 200"
done
echo ""

# ─── Phase 2: Page content verification ──────────────────────────────
echo "--- Phase 2: Page content verification ---"
HOME=$(curl -sS "$FRONTEND_URL")
echo "$HOME" | grep -qi '__next\|__NEXT_DATA__\|frontend-e2e-bar' || {
  echo "  ✗ Home page missing expected Next.js content"
  exit 1
}
echo "  ✓ Home page contains Next.js content"

LOGIN=$(curl -sS "$FRONTEND_URL/login")
echo "$LOGIN" | grep -qi 'type="email"\|type="password"\|name="email"\|name="password"' || {
  echo "  ✗ Login page missing form inputs"
  exit 1
}
echo "  ✓ Login page contains form inputs"

CREATE_BAR_PAGE=$(curl -sS "$FRONTEND_URL/create-bar")
echo "$CREATE_BAR_PAGE" | grep -qi '__next\|__NEXT_DATA__' || {
  echo "  ✗ Create bar page missing Next.js content"
  exit 1
}
echo "  ✓ Create bar page renders"
echo ""

# ─── Phase 3: Backend API integration (Phase 2 features) ─────────────
echo "--- Phase 3: Backend API integration ---"

# 3a. Register normal user
EMAIL="fe-e2e-$(date +%s)@example.com"
REG_RESP=$(curl -sS -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Password123!\",\"nickname\":\"FE-E2E\"}" \
  -w $'\n%{http_code}')
REG_STATUS=$(echo "$REG_RESP" | tail -n1)
REG_BODY=$(echo "$REG_RESP" | sed '$d')
require_status "$REG_STATUS" "201" "$REG_BODY" "register"
TOKEN=$(echo "$REG_BODY" | jq -r '.data.accessToken')
echo "  ✓ User registered"

# 3b. Create bar application and verify pending list in personal center
BAR_NAME="frontend-e2e-created-$(date +%s)"
CREATE_BAR_RESP=$(curl -sS -X POST "$API_URL/bars" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"$BAR_NAME\",\"description\":\"created by frontend smoke\"}" \
  -w $'\n%{http_code}')
CREATE_BAR_STATUS=$(echo "$CREATE_BAR_RESP" | tail -n1)
CREATE_BAR_BODY=$(echo "$CREATE_BAR_RESP" | sed '$d')
require_status "$CREATE_BAR_STATUS" "201" "$CREATE_BAR_BODY" "create bar"
CREATED_BAR_ID=$(echo "$CREATE_BAR_BODY" | jq -r '.data.id')
echo "  ✓ Bar application created"

MY_CREATED_BARS_RESP=$(curl -sS -X GET "$API_URL/users/me/created-bars" \
  -H "Authorization: Bearer $TOKEN" \
  -w $'\n%{http_code}')
MY_CREATED_BARS_STATUS=$(echo "$MY_CREATED_BARS_RESP" | tail -n1)
MY_CREATED_BARS_BODY=$(echo "$MY_CREATED_BARS_RESP" | sed '$d')
require_status "$MY_CREATED_BARS_STATUS" "200" "$MY_CREATED_BARS_BODY" "users/me/created-bars"
echo "$MY_CREATED_BARS_BODY" | jq -e --arg id "$CREATED_BAR_ID" '.data[] | select(.id == $id)' >/dev/null || {
  echo "  ✗ Created bar not found in users/me/created-bars"
  echo "$MY_CREATED_BARS_BODY"
  exit 1
}
echo "  ✓ Created bar appears in personal center"

# 3c. Join/leave active seed bar
JOIN_RESP=$(curl -sS -X POST "$API_URL/bars/$TEST_BAR_ID/join" \
  -H "Authorization: Bearer $TOKEN" \
  -w $'\n%{http_code}')
JOIN_STATUS=$(echo "$JOIN_RESP" | tail -n1)
JOIN_BODY=$(echo "$JOIN_RESP" | sed '$d')
require_status "$JOIN_STATUS" "201" "$JOIN_BODY" "join bar"

MY_BARS_RESP=$(curl -sS -X GET "$API_URL/users/me/bars" \
  -H "Authorization: Bearer $TOKEN" \
  -w $'\n%{http_code}')
MY_BARS_STATUS=$(echo "$MY_BARS_RESP" | tail -n1)
MY_BARS_BODY=$(echo "$MY_BARS_RESP" | sed '$d')
require_status "$MY_BARS_STATUS" "200" "$MY_BARS_BODY" "users/me/bars"
echo "$MY_BARS_BODY" | jq -e --arg id "$TEST_BAR_ID" '.data[] | select(.id == $id)' >/dev/null || {
  echo "  ✗ Joined bar not found in users/me/bars"
  echo "$MY_BARS_BODY"
  exit 1
}
echo "  ✓ Join flow reflected in personal center"

LEAVE_RESP=$(curl -sS -X POST "$API_URL/bars/$TEST_BAR_ID/leave" \
  -H "Authorization: Bearer $TOKEN" \
  -w $'\n%{http_code}')
LEAVE_STATUS=$(echo "$LEAVE_RESP" | tail -n1)
LEAVE_BODY=$(echo "$LEAVE_RESP" | sed '$d')
require_status "$LEAVE_STATUS" "201" "$LEAVE_BODY" "leave bar"
echo "  ✓ Leave flow works"

# 3d. Admin approve created bar and verify listing
ADMIN_LOGIN_RESP=$(curl -sS -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin-e2e@example.com","password":"Password123!"}' \
  -w $'\n%{http_code}')
ADMIN_LOGIN_STATUS=$(echo "$ADMIN_LOGIN_RESP" | tail -n1)
ADMIN_LOGIN_BODY=$(echo "$ADMIN_LOGIN_RESP" | sed '$d')
require_status "$ADMIN_LOGIN_STATUS" "201" "$ADMIN_LOGIN_BODY" "admin login"
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_BODY" | jq -r '.data.accessToken')

PENDING_RESP=$(curl -sS -X GET "$API_URL/admin/bars?status=pending_review" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w $'\n%{http_code}')
PENDING_STATUS=$(echo "$PENDING_RESP" | tail -n1)
PENDING_BODY=$(echo "$PENDING_RESP" | sed '$d')
require_status "$PENDING_STATUS" "200" "$PENDING_BODY" "admin pending list"
echo "  ✓ Admin pending list API works"

APPROVE_RESP=$(curl -sS -X POST "$API_URL/admin/bars/$CREATED_BAR_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w $'\n%{http_code}')
APPROVE_STATUS=$(echo "$APPROVE_RESP" | tail -n1)
APPROVE_BODY=$(echo "$APPROVE_RESP" | sed '$d')
require_status "$APPROVE_STATUS" "201" "$APPROVE_BODY" "admin approve"
echo "  ✓ Admin approve works"

ACTIONS_RESP=$(curl -sS -X GET "$API_URL/admin/actions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w $'\n%{http_code}')
ACTIONS_STATUS=$(echo "$ACTIONS_RESP" | tail -n1)
ACTIONS_BODY=$(echo "$ACTIONS_RESP" | sed '$d')
require_status "$ACTIONS_STATUS" "200" "$ACTIONS_BODY" "admin actions list"
echo "  ✓ Admin actions list API works"

echo ""
echo "=== All frontend E2E smoke checks passed ==="
