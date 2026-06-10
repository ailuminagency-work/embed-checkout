#!/usr/bin/env bash
# Live client test — exercises the DEPLOYED Supabase backend end to end.
#
# Usage:  bash scripts/live-test.sh
#
# What it verifies:
#   T1  app_settings reachable + Stripe config present
#   T2  active catalog items exist
#   T3  active ZIP pricing exists
#   T4  create-payment-intent: real PaymentIntent created, server-side amount correct
#   T5  create-payment-intent: empty cart rejected (400)
#   T6  pending_bookings row saved (crash-recovery safety net)
#   T7  stripe-webhook deployed + rejects unsigned requests
#   T8  out-of-area ZIP charges item total only (no minimum)
#   T9  get-catalog edge function works
#
# Note: T4/T8 create real (unconfirmed) PaymentIntents in your Stripe account.
# They are never charged and expire automatically. Pending bookings are marked
# 'expired' by the cleanup cron after 2 hours.

set +e
cd "$(dirname "$0")/.." || exit 1
source .env 2>/dev/null || true
URL="${VITE_SUPABASE_URL//\"/}"
ANON="${VITE_SUPABASE_PUBLISHABLE_KEY//\"/}"

if [ -z "$URL" ] || [ -z "$ANON" ]; then
  echo "ERROR: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not found in .env"
  exit 1
fi
if ! command -v jq >/dev/null; then
  echo "ERROR: jq is required (brew install jq / apt install jq)"
  exit 1
fi

AUTH=(-H "apikey: $ANON" -H "Authorization: Bearer $ANON")
PASS=0; FAIL=0
report() { if [ "$1" = "PASS" ]; then PASS=$((PASS+1)); echo "✓ PASS: $2"; else FAIL=$((FAIL+1)); echo "✗ FAIL: $2"; fi; }

echo "=============================================="
echo " LIVE CLIENT TEST — $URL"
echo " $(date)"
echo "=============================================="

# ── T1: app_settings reachable + stripe config ──
SETTINGS=$(curl -s "${AUTH[@]}" "$URL/rest/v1/app_settings?select=key,value&key=in.(stripe_mode,stripe_publishable_key,stripe_publishable_key_test,stripe_publishable_key_live,deposit_mode,daily_job_capacity,company_name)")
echo "--- T1: app_settings ---"
echo "$SETTINGS" | jq -c '.' 2>/dev/null || echo "$SETTINGS"
if echo "$SETTINGS" | jq -e 'type=="array"' >/dev/null 2>&1; then
  report PASS "app_settings reachable"
  MODE=$(echo "$SETTINGS" | jq -r '.[] | select(.key=="stripe_mode") | .value')
  PK_TEST=$(echo "$SETTINGS" | jq -r '.[] | select(.key=="stripe_publishable_key_test") | .value')
  PK_LIVE=$(echo "$SETTINGS" | jq -r '.[] | select(.key=="stripe_publishable_key_live") | .value')
  PK_GENERIC=$(echo "$SETTINGS" | jq -r '.[] | select(.key=="stripe_publishable_key") | .value')
  echo "stripe_mode=$MODE | pk_test set: $([ -n "$PK_TEST" ] && echo yes || echo NO) | pk_live set: $([ -n "$PK_LIVE" ] && echo yes || echo NO) | pk_generic set: $([ -n "$PK_GENERIC" ] && echo yes || echo NO)"
else
  report FAIL "app_settings not reachable"
fi

# ── T2: catalog items exist ──
CATALOG=$(curl -s "${AUTH[@]}" "$URL/rest/v1/catalog_items?select=id,name,price&active=eq.true&limit=3")
echo "--- T2: catalog ---"
echo "$CATALOG" | jq -c '.' 2>/dev/null || echo "$CATALOG"
ITEM_ID=$(echo "$CATALOG" | jq -r '.[0].id // empty' 2>/dev/null)
ITEM_PRICE=$(echo "$CATALOG" | jq -r '.[0].price // empty' 2>/dev/null)
ITEM_NAME=$(echo "$CATALOG" | jq -r '.[0].name // empty' 2>/dev/null)
if [ -n "$ITEM_ID" ]; then report PASS "active catalog items exist ($ITEM_NAME @ \$$ITEM_PRICE)"; else report FAIL "no active catalog items"; fi

# ── T3: zip_pricing exists ──
ZIPS=$(curl -s "${AUTH[@]}" "$URL/rest/v1/zip_pricing?select=zip_code,minimum_price&active=eq.true&limit=1")
echo "--- T3: zip_pricing ---"
echo "$ZIPS" | jq -c '.' 2>/dev/null || echo "$ZIPS"
TEST_ZIP=$(echo "$ZIPS" | jq -r '.[0].zip_code // empty' 2>/dev/null)
TEST_MIN=$(echo "$ZIPS" | jq -r '.[0].minimum_price // empty' 2>/dev/null)
if [ -n "$TEST_ZIP" ]; then report PASS "active ZIP exists ($TEST_ZIP, min \$$TEST_MIN)"; else report FAIL "no active ZIP pricing rows"; fi

# ── T4: create-payment-intent — valid request ──
if date -d "+7 days" +%Y-%m-%d >/dev/null 2>&1; then
  FUTURE_DATE=$(date -d "+7 days" +%Y-%m-%d)         # GNU date (Linux)
else
  FUTURE_DATE=$(date -v +7d +%Y-%m-%d)               # BSD date (macOS)
fi
BODY=$(jq -n --arg id "$ITEM_ID" --arg name "$ITEM_NAME" --argjson price "${ITEM_PRICE:-50}" --arg zip "${TEST_ZIP:-98101}" --arg date "$FUTURE_DATE" '{
  cart: [{id:$id, price:$price, quantity:1}],
  zip_code: $zip, photos_uploaded: false, schedule_date: $date, currency: "usd",
  booking_data: {
    service_type: "junk_removal", customer_name: "Live Test (automated)",
    customer_email: "livetest@example.com", customer_phone: "555-0100",
    customer_address: "123 Test St", customer_zip: $zip,
    customer_property_type: "house", schedule_date: $date,
    schedule_time_window: "8:00 AM - 12:00 PM",
    items: [{id:$id, name:$name, price:$price, quantity:1, lineTotal:$price}],
    custom_items: [], notes: "AUTOMATED LIVE TEST - safe to ignore"
  }
}')
RESP=$(curl -s -w "\n%{http_code}" -X POST "$URL/functions/v1/create-payment-intent" \
  "${AUTH[@]}" -H "Content-Type: application/json" -d "$BODY")
CODE=$(echo "$RESP" | tail -1); JSON=$(echo "$RESP" | sed '$d')
echo "--- T4: create-payment-intent (valid) HTTP $CODE ---"
echo "$JSON" | jq -c 'del(.client_secret)' 2>/dev/null || echo "$JSON"
PI_ID=$(echo "$JSON" | jq -r '.payment_intent_id // empty' 2>/dev/null)
VERIFIED=$(echo "$JSON" | jq -r '.verified_amount // empty' 2>/dev/null)
if [ "$CODE" = "200" ] && [ -n "$PI_ID" ]; then
  report PASS "PaymentIntent created ($PI_ID, verified_amount=\$$VERIFIED)"
  if [ -n "$TEST_MIN" ] && [ -n "$ITEM_PRICE" ]; then
    EXPECTED=$(echo "$ITEM_PRICE $TEST_MIN" | awk '{print ($1>$2)?$1:$2}')
    ACTUAL_OK=$(echo "$VERIFIED $EXPECTED" | awk '{print ($1==$2)?"yes":"no"}')
    if [ "$ACTUAL_OK" = "yes" ]; then report PASS "server-side amount correct (max(item \$$ITEM_PRICE, min \$$TEST_MIN) = \$$VERIFIED)"; else report FAIL "verified_amount \$$VERIFIED != expected \$$EXPECTED"; fi
  fi
elif [ "$CODE" = "503" ]; then
  report FAIL "Stripe secret key NOT configured in Supabase (503) — add STRIPE_SECRET_KEY in Edge Function secrets"
else
  report FAIL "create-payment-intent returned HTTP $CODE"
fi

# ── T5: empty cart must be rejected ──
RESP5=$(curl -s -w "\n%{http_code}" -X POST "$URL/functions/v1/create-payment-intent" \
  "${AUTH[@]}" -H "Content-Type: application/json" \
  -d '{"cart":[],"zip_code":"98101","schedule_date":"2099-01-01","booking_data":{}}')
CODE5=$(echo "$RESP5" | tail -1)
echo "--- T5: empty cart HTTP $CODE5 ---"
if [ "$CODE5" = "400" ]; then report PASS "empty cart rejected (400)"; else report FAIL "empty cart returned $CODE5 (expected 400)"; fi

# ── T6: pending_booking row created ──
if [ -n "$PI_ID" ]; then
  sleep 2
  PENDING=$(curl -s "${AUTH[@]}" "$URL/rest/v1/pending_bookings?select=id,status,stripe_mode&payment_intent_id=eq.$PI_ID")
  echo "--- T6: pending_bookings ---"
  echo "$PENDING" | jq -c '.' 2>/dev/null || echo "$PENDING"
  if echo "$PENDING" | jq -e 'length > 0' >/dev/null 2>&1; then
    report PASS "pending_booking saved (crash-recovery safety net works)"
  else
    report FAIL "no pending_booking row for $PI_ID"
  fi
fi

# ── T7: stripe-webhook deployed + rejects unsigned ──
CODE7=$(curl -s -o /tmp/wh.txt -w "%{http_code}" -X POST "$URL/functions/v1/stripe-webhook" \
  "${AUTH[@]}" -H "Content-Type: application/json" -d '{"fake":"event"}')
echo "--- T7: stripe-webhook unsigned HTTP $CODE7 ($(cat /tmp/wh.txt)) ---"
if [ "$CODE7" = "400" ]; then report PASS "stripe-webhook deployed and rejects unsigned requests"
elif [ "$CODE7" = "404" ]; then report FAIL "stripe-webhook NOT DEPLOYED (404) — run: npx supabase functions deploy stripe-webhook"
else report FAIL "stripe-webhook returned $CODE7 (expected 400)"; fi

# ── T8: out-of-area ZIP — no minimum applied ──
BODY8=$(echo "$BODY" | jq '.zip_code="99999" | .booking_data.customer_zip="99999"')
RESP8=$(curl -s -w "\n%{http_code}" -X POST "$URL/functions/v1/create-payment-intent" \
  "${AUTH[@]}" -H "Content-Type: application/json" -d "$BODY8")
CODE8=$(echo "$RESP8" | tail -1); JSON8=$(echo "$RESP8" | sed '$d')
V8=$(echo "$JSON8" | jq -r '.verified_amount // empty' 2>/dev/null)
echo "--- T8: out-of-area ZIP HTTP $CODE8 verified_amount=$V8 ---"
if [ "$CODE8" = "200" ] && [ "$(echo "$V8 $ITEM_PRICE" | awk '{print ($1==$2)?"y":"n"}')" = "y" ]; then
  report PASS "out-of-area ZIP charges item total only (\$$V8)"
elif [ "$CODE8" = "503" ]; then
  report FAIL "stripe key not configured (503)"
else
  report FAIL "out-of-area ZIP: HTTP $CODE8, verified=$V8 (expected $ITEM_PRICE)"
fi

# ── T9: get-catalog edge function ──
CODE9=$(curl -s -o /tmp/cat.txt -w "%{http_code}" "$URL/functions/v1/get-catalog" "${AUTH[@]}")
N9=$(jq 'length' /tmp/cat.txt 2>/dev/null || echo "?")
echo "--- T9: get-catalog HTTP $CODE9 ($N9 items) ---"
if [ "$CODE9" = "200" ]; then report PASS "get-catalog returns $N9 items"; else report FAIL "get-catalog HTTP $CODE9"; fi

echo ""
echo "=============================================="
echo " RESULT: $PASS passed, $FAIL failed"
echo "=============================================="
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
