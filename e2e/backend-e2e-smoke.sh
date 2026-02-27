#!/usr/bin/env bash
# e2e/backend-e2e-smoke.sh
#
# Backend API smoke tests (Phase 2):
# - Auth: register/login/me
# - Bars: create/join/leave
# - Admin: approve/suspend/unsuspend
# - Profile: me/posts, me/replies, me/bars, me/created-bars, me/profile
# - Posts/Replies: create post + reply to populate profile endpoints

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/api}"
TEST_BAR_ID="${TEST_BAR_ID:-00000000-0000-4000-a000-000000000001}"

echo "=== Backend E2E Smoke Tests (Phase 2) ==="
echo "API_URL:     $API_URL"
echo "TEST_BAR_ID: $TEST_BAR_ID"
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

# ─── 1. Register + auth ──────────────────────────────────────────────
echo "--- Step 1: Register and authenticate user ---"
EMAIL="backend-e2e-$(date +%s)@example.com"
REGISTER_RESPONSE=$(curl -sS -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Password123!\",\"nickname\":\"BackendE2E\"}" \
  -w $'\n%{http_code}')
REGISTER_STATUS=$(echo "$REGISTER_RESPONSE" | tail -n1)
REGISTER_BODY=$(echo "$REGISTER_RESPONSE" | sed '$d')
require_status "$REGISTER_STATUS" "201" "$REGISTER_BODY" "register"

TOKEN=$(echo "$REGISTER_BODY" | jq -r '.data.accessToken')
USER_ID=$(echo "$REGISTER_BODY" | jq -r '.data.user.id')
echo "✓ User registered"

ME_RESPONSE=$(curl -sS -X GET "$API_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN" \
  -w $'\n%{http_code}')
ME_STATUS=$(echo "$ME_RESPONSE" | tail -n1)
ME_BODY=$(echo "$ME_RESPONSE" | sed '$d')
require_status "$ME_STATUS" "200" "$ME_BODY" "auth/me"
echo "✓ /auth/me works"

# ─── 2. Create bar (pending_review) ──────────────────────────────────
echo ""
echo "--- Step 2: Create bar application ---"
BAR_NAME="backend-e2e-bar-$(date +%s)"
CREATE_BAR_RESPONSE=$(curl -sS -X POST "$API_URL/bars" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"$BAR_NAME\",\"description\":\"Backend E2E created bar\",\"category\":\"e2e\"}" \
  -w $'\n%{http_code}')
CREATE_BAR_STATUS=$(echo "$CREATE_BAR_RESPONSE" | tail -n1)
CREATE_BAR_BODY=$(echo "$CREATE_BAR_RESPONSE" | sed '$d')
require_status "$CREATE_BAR_STATUS" "201" "$CREATE_BAR_BODY" "create bar"
CREATED_BAR_ID=$(echo "$CREATE_BAR_BODY" | jq -r '.data.id')
echo "✓ Bar created with pending_review status"

# ─── 3. Join / leave existing active bar ─────────────────────────────
echo ""
echo "--- Step 3: Join and leave existing active bar ---"
JOIN_RESPONSE=$(curl -sS -X POST "$API_URL/bars/$TEST_BAR_ID/join" \
  -H "Authorization: Bearer $TOKEN" \
  -w $'\n%{http_code}')
JOIN_STATUS=$(echo "$JOIN_RESPONSE" | tail -n1)
JOIN_BODY=$(echo "$JOIN_RESPONSE" | sed '$d')
require_status "$JOIN_STATUS" "201" "$JOIN_BODY" "join bar"

LEAVE_RESPONSE=$(curl -sS -X POST "$API_URL/bars/$TEST_BAR_ID/leave" \
  -H "Authorization: Bearer $TOKEN" \
  -w $'\n%{http_code}')
LEAVE_STATUS=$(echo "$LEAVE_RESPONSE" | tail -n1)
LEAVE_BODY=$(echo "$LEAVE_RESPONSE" | sed '$d')
require_status "$LEAVE_STATUS" "201" "$LEAVE_BODY" "leave bar"
echo "✓ Join/leave flow works"

# ─── 4. Admin review + state changes ─────────────────────────────────
echo ""
echo "--- Step 4: Admin approve/suspend/unsuspend ---"
ADMIN_LOGIN_RESPONSE=$(curl -sS -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin-e2e@example.com","password":"Password123!"}' \
  -w $'\n%{http_code}')
ADMIN_LOGIN_STATUS=$(echo "$ADMIN_LOGIN_RESPONSE" | tail -n1)
ADMIN_LOGIN_BODY=$(echo "$ADMIN_LOGIN_RESPONSE" | sed '$d')
require_status "$ADMIN_LOGIN_STATUS" "201" "$ADMIN_LOGIN_BODY" "admin login"
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_BODY" | jq -r '.data.accessToken')

APPROVE_RESPONSE=$(curl -sS -X POST "$API_URL/admin/bars/$CREATED_BAR_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w $'\n%{http_code}')
APPROVE_STATUS=$(echo "$APPROVE_RESPONSE" | tail -n1)
APPROVE_BODY=$(echo "$APPROVE_RESPONSE" | sed '$d')
require_status "$APPROVE_STATUS" "201" "$APPROVE_BODY" "admin approve"

SUSPEND_RESPONSE=$(curl -sS -X POST "$API_URL/admin/bars/$CREATED_BAR_ID/suspend" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason":"e2e suspend","duration":1}' \
  -w $'\n%{http_code}')
SUSPEND_STATUS=$(echo "$SUSPEND_RESPONSE" | tail -n1)
SUSPEND_BODY=$(echo "$SUSPEND_RESPONSE" | sed '$d')
require_status "$SUSPEND_STATUS" "201" "$SUSPEND_BODY" "admin suspend"

UNSUSPEND_RESPONSE=$(curl -sS -X POST "$API_URL/admin/bars/$CREATED_BAR_ID/unsuspend" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w $'\n%{http_code}')
UNSUSPEND_STATUS=$(echo "$UNSUSPEND_RESPONSE" | tail -n1)
UNSUSPEND_BODY=$(echo "$UNSUSPEND_RESPONSE" | sed '$d')
require_status "$UNSUSPEND_STATUS" "201" "$UNSUSPEND_BODY" "admin unsuspend"
echo "✓ Admin workflow works"

# ─── 5. Create post + reply for profile endpoints ────────────────────
echo ""
echo "--- Step 5: Create post and reply ---"
POST_RESPONSE=$(curl -sS -X POST "$API_URL/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"barId\":\"$TEST_BAR_ID\",\"title\":\"Backend E2E Post\",\"content\":\"Backend E2E Content\",\"contentType\":\"plaintext\"}" \
  -w $'\n%{http_code}')
POST_STATUS=$(echo "$POST_RESPONSE" | tail -n1)
POST_BODY=$(echo "$POST_RESPONSE" | sed '$d')
require_status "$POST_STATUS" "201" "$POST_BODY" "create post"
POST_ID=$(echo "$POST_BODY" | jq -r '.data.id')

REPLY_RESPONSE=$(curl -sS -X POST "$API_URL/posts/$POST_ID/replies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"Backend E2E Reply","contentType":"plaintext"}' \
  -w $'\n%{http_code}')
REPLY_STATUS=$(echo "$REPLY_RESPONSE" | tail -n1)
REPLY_BODY=$(echo "$REPLY_RESPONSE" | sed '$d')
require_status "$REPLY_STATUS" "201" "$REPLY_BODY" "create reply"
echo "✓ Post/reply flow works"

# ─── 6. Personal center endpoints ────────────────────────────────────
echo ""
echo "--- Step 6: Verify personal center APIs ---"
for endpoint in "posts" "replies" "bars" "created-bars"; do
  RESP=$(curl -sS -X GET "$API_URL/users/me/$endpoint" \
    -H "Authorization: Bearer $TOKEN" \
    -w $'\n%{http_code}')
  STATUS=$(echo "$RESP" | tail -n1)
  BODY=$(echo "$RESP" | sed '$d')
  require_status "$STATUS" "200" "$BODY" "users/me/$endpoint"
done

PATCH_PROFILE_RESPONSE=$(curl -sS -X PATCH "$API_URL/users/me/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nickname":"BackendE2EUpdated","bio":"updated by e2e"}' \
  -w $'\n%{http_code}')
PATCH_PROFILE_STATUS=$(echo "$PATCH_PROFILE_RESPONSE" | tail -n1)
PATCH_PROFILE_BODY=$(echo "$PATCH_PROFILE_RESPONSE" | sed '$d')
require_status "$PATCH_PROFILE_STATUS" "200" "$PATCH_PROFILE_BODY" "users/me/profile patch"
echo "✓ Personal center APIs work"

echo ""
echo "=== All backend E2E smoke checks passed ==="
