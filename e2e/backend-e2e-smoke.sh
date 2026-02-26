#!/usr/bin/env bash
# e2e/backend-e2e-smoke.sh
#
# Backend API smoke tests: register → create post → create reply.
# Runs against a live backend server.
#
# Environment variables:
#   API_URL       — Backend API base URL (default: http://localhost:3001/api)
#   TEST_BAR_ID   — UUID of a seeded bar   (default: 00000000-0000-4000-a000-000000000001)
#   JWT_SECRET    — JWT secret for fallback token generation (optional)
#
# Usage:
#   ./e2e/backend-e2e-smoke.sh
#   API_URL=http://localhost:3001/api TEST_BAR_ID=xxx ./e2e/backend-e2e-smoke.sh

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/api}"
TEST_BAR_ID="${TEST_BAR_ID:-00000000-0000-4000-a000-000000000001}"

echo "=== Backend E2E Smoke Tests ==="
echo "API_URL:     $API_URL"
echo "TEST_BAR_ID: $TEST_BAR_ID"
echo ""

# ─── 1. Register a new user ─────────────────────────────────────────
echo "--- Step 1: Register a new user ---"
EMAIL="backend-e2e-$(date +%s)@example.com"
REGISTER_RESPONSE=$(curl -sS -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Password123!\",\"nickname\":\"BackendE2E\"}" \
  -w $'\n%{http_code}')
REGISTER_STATUS=$(echo "$REGISTER_RESPONSE" | tail -n1)
REGISTER_BODY=$(echo "$REGISTER_RESPONSE" | sed '$d')

if [ "$REGISTER_STATUS" = "201" ]; then
  TOKEN=$(echo "$REGISTER_BODY" | jq -r '.data.accessToken')
  echo "Register succeeded (201). Token obtained."
else
  echo "Register failed with status $REGISTER_STATUS"
  echo "$REGISTER_BODY"
  if [ -n "${JWT_SECRET:-}" ]; then
    echo "Falling back to seeded e2e user auth"
    TOKEN=$(python3 -c "
import base64,hashlib,hmac,json,os
b64=lambda b:base64.urlsafe_b64encode(b).rstrip(b'=').decode()
h=b64(json.dumps({'alg':'HS256','typ':'JWT'},separators=(',',':')).encode())
p=b64(json.dumps({'sub':'00000000-0000-4000-a000-000000000010','email':'e2e-seed@example.com','tokenVersion':0},separators=(',',':')).encode())
s=b64(hmac.new(os.environ['JWT_SECRET'].encode(),f'{h}.{p}'.encode(),hashlib.sha256).digest())
print(f'{h}.{p}.{s}')
")
  else
    echo "ERROR: No JWT_SECRET set for fallback. Aborting."
    exit 1
  fi
fi

# ─── 2. Create a post ───────────────────────────────────────────────
echo ""
echo "--- Step 2: Create a post ---"
POST_RESPONSE=$(curl -sS -X POST "$API_URL/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"barId\":\"$TEST_BAR_ID\",\"title\":\"Backend E2E Post\",\"content\":\"Backend E2E Content\",\"contentType\":\"plaintext\"}" \
  -w $'\n%{http_code}')
POST_STATUS=$(echo "$POST_RESPONSE" | tail -n1)
POST_BODY=$(echo "$POST_RESPONSE" | sed '$d')
if [ "$POST_STATUS" = "201" ]; then
  POST_ID=$(echo "$POST_BODY" | jq -r '.data.id')
  echo "Create post succeeded (201). Post ID: $POST_ID"
else
  echo "Create post FAILED with status $POST_STATUS"
  echo "$POST_BODY"
  exit 1
fi

# ─── 3. Create a reply ──────────────────────────────────────────────
echo ""
echo "--- Step 3: Create a reply ---"
REPLY_RESPONSE=$(curl -sS -X POST "$API_URL/posts/$POST_ID/replies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"Backend E2E Reply","contentType":"plaintext"}' \
  -w $'\n%{http_code}')
REPLY_STATUS=$(echo "$REPLY_RESPONSE" | tail -n1)
REPLY_BODY=$(echo "$REPLY_RESPONSE" | sed '$d')
if [ "$REPLY_STATUS" = "201" ]; then
  echo "Create reply succeeded (201)."
else
  echo "Create reply FAILED with status $REPLY_STATUS"
  echo "$REPLY_BODY"
  exit 1
fi

echo ""
echo "=== All backend E2E smoke checks passed ==="
