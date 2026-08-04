#!/bin/bash
# Cartify QA - Backend behavior tests (real HTTP calls)
BASE="http://localhost:5000"
TS=$(date +%s)
EMAIL="qa$TS@test.com"
PASS=1
FAIL=0
SKIP=0

# use unique X-Forwarded-For per request to isolate rate limit (trust proxy=1)
IP() { echo $((RANDOM % 250 + 2)).$((RANDOM % 250 + 2)).$((RANDOM % 250 + 2)).$((RANDOM % 250 + 2)); }
req() { # method path [body] [expected_status]
  local method=$1 path=$2 body=${3:-} want=$4
  local out code
  if [ -n "$body" ]; then
    out=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X "$method" "$BASE$path" -H "Content-Type: application/json" -H "X-Forwarded-For: $(IP)" -d "$body")
  else
    out=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X "$method" "$BASE$path" -H "X-Forwarded-For: $(IP)")
  fi
  code=$out
  if [ "$code" = "$want" ]; then
    echo "PASS [$code] $method $path"
    PASS=$((PASS+1))
  else
    echo "FAIL [$code expected $want] $method $path  => $(head -c 160 /tmp/resp.json)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== 1. PRODUCTS (browse/search/filter/pagination) ==="
req GET "/api/products" "" 200
req GET "/api/products?page=2&limit=4" "" 200
req GET "/api/products?search=iphone" "" 200
req GET "/api/products?search=zzzzzznothing" "" 200
req GET "/api/products?search=((a%2B)%2B)%2Bb" "" 200
req GET "/api/products?search=$(printf 'a%.0s' {1..120})" "" 400
req GET "/api/products?category=electronics" "" 200
req GET "/api/products?limit=abc&page=abc" "" 200

PID=$(node -e "const d=require('/tmp/resp.json'); console.log(d.products?.[0]?._id||'')" 2>/dev/null)
echo "--- valid product id: $PID"
if [ -n "$PID" ]; then
  req GET "/api/products/$PID" "" 200
fi
req GET "/api/products/notanid" "" 200   # expectation may differ; real behavior reported below
req GET "/api/products/507f1f77bcf86cd799439011" "" 200

echo "=== 2. REGISTER / LOGIN ==="
req POST "/api/auth/register" "{\"name\":\"QA User\",\"email\":\"$EMAIL\",\"password\":\"qaPass123\"}" 201
req POST "/api/auth/register" "{\"name\":\"QA User\",\"email\":\"$EMAIL\",\"password\":\"qaPass123\"}" 400
req POST "/api/auth/register" "{\"name\":\"\",\"email\":\"\",\"password\":\"\"}" 400
req POST "/api/auth/register" "{\"name\":\"Weak\",\"email\":\"qaweak$TS@test.com\",\"password\":\"123\"}" 201
req POST "/api/auth/login" "{\"email\":\"$EMAIL\",\"password\":\"qaPass123\"}" 200
req POST "/api/auth/login" "{\"email\":\"$EMAIL\",\"password\":\"WRONG\"}" 400
req POST "/api/auth/login" "{\"email\":\"nobody$TS@test.com\",\"password\":\"x\"}" 400

TOKEN=$(node -e "const d=require('/tmp/resp.json'); console.log(d.token||'')")
echo "--- token len: ${#TOKEN}"
# capture the valid-login body separately for token
curl -s -m 20 -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -H "X-Forwarded-For: $(IP)" -d "{\"email\":\"$EMAIL\",\"password\":\"qaPass123\"}" > /tmp/login.json
TOKEN=$(node -e "console.log(require('/tmp/login.json').token||'')")

echo "=== 3. AUTH GUARDS ==="
req GET "/api/orders/myorders/anyid" "" 401
req POST "/api/payment/create-order" "{}" 401
req POST "/api/products/add" "{\"title\":\"x\"}" 401
curl -s -m 20 -X GET "$BASE/api/products" > /dev/null

echo "=== 4. PROFILE UPDATE / DELETE ==="
UID=$(node -e "console.log(require('/tmp/login.json').user?.id||'')")
echo "--- user id: $UID"
if [ -n "$TOKEN" ]; then
  req PUT "/api/auth/update/$UID" "{\"name\":\"QA Renamed\"}" 200 -H
  # above missing token, do proper:
  code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X PUT "$BASE/api/auth/update/$UID" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"QA Renamed"}')
  [ "$code" = 200 ] && echo "PASS [200] PUT update own (with token)" || echo "FAIL [$code] PUT update own => $(head -c 120 /tmp/resp.json)"
  [ "$code" = 200 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
  code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X PUT "$BASE/api/auth/update/$UID" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":""}')
  echo "REAL [${code}] PUT update with empty name => $(head -c 120 /tmp/resp.json)"
  code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X PUT "$BASE/api/auth/update/507f1f77bcf86cd799439011" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"hack"}')
  [ "$code" = 403 ] && echo "PASS [403] PUT update other user" || echo "FAIL [$code] PUT update other user => $(head -c 120 /tmp/resp.json)"
  [ "$code" = 403 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
fi

echo "=== 5. ADDRESSES ==="
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/addresses/add" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"fullName\":\"QA User\",\"phone\":\"9876543210\",\"street\":\"1 Main St\",\"city\":\"Delhi\",\"state\":\"Delhi\",\"pinCode\":\"110001\"}")
[ "$code" = 201 ] && echo "PASS [201] address add" || echo "FAIL [$code] address add => $(head -c 140 /tmp/resp.json)"
[ "$code" = 201 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
AID=$(node -e "console.log(require('/tmp/resp.json')._id||'')")
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/addresses/add" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}')
echo "REAL [${code}] address add empty body => $(head -c 140 /tmp/resp.json)"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 "$BASE/api/addresses/$UID" -H "Authorization: Bearer $TOKEN")
[ "$code" = 200 ] && echo "PASS [200] get own addresses" || echo "FAIL [$code] get addresses => $(head -c 120 /tmp/resp.json)"
[ "$code" = 200 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 "$BASE/api/addresses/507f1f77bcf86cd799439011" -H "Authorization: Bearer $TOKEN")
[ "$code" = 403 ] && echo "PASS [403] get other's addresses" || echo "FAIL [$code] get other addresses => $(head -c 120 /tmp/resp.json)"
[ "$code" = 403 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
if [ -n "$AID" ]; then
  code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X DELETE "$BASE/api/addresses/$AID" -H "Authorization: Bearer $TOKEN")
  [ "$code" = 200 ] && echo "PASS [200] delete own address" || echo "FAIL [$code] delete address => $(head -c 120 /tmp/resp.json)"
  [ "$code" = 200 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
fi
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X DELETE "$BASE/api/addresses/notanid" -H "Authorization: Bearer $TOKEN")
echo "REAL [${code}] delete address invalid id => $(head -c 120 /tmp/resp.json)"

echo "=== 6. OTP LOGIN ==="
OTPEMAIL="qaotp$TS@test.com"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 25 -X POST "$BASE/api/auth/send-otp" -H "Content-Type: application/json" -H "X-Forwarded-For: $(IP)" -d "{\"email\":\"$OTPEMAIL\"}")
echo "REAL [${code}] send-otp => $(head -c 160 /tmp/resp.json)"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/auth/verify-otp" -H "Content-Type: application/json" -H "X-Forwarded-For: $(IP)" -d "{\"email\":\"$OTPEMAIL\",\"otp\":\"000000\"}")
echo "REAL [${code}] verify-otp wrong otp => $(head -c 160 /tmp/resp.json)"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/auth/send-otp" -H "Content-Type: application/json" -H "X-Forwarded-For: $(IP)" -d '{"email":"notanemail"}')
echo "REAL [${code}] send-otp invalid email format => $(head -c 160 /tmp/resp.json)"

echo "=== 7. FORGOT / RESET ==="
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/auth/forgot-password" -H "Content-Type: application/json" -H "X-Forwarded-For: $(IP)" -d '{"email":"nobody_never@nope.com"}')
echo "REAL [${code}] forgot-password unknown => $(head -c 120 /tmp/resp.json)"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 25 -X POST "$BASE/api/auth/forgot-password" -H "Content-Type: application/json" -H "X-Forwarded-For: $(IP)" -d "{\"email\":\"$EMAIL\"}")
echo "REAL [${code}] forgot-password known => $(head -c 120 /tmp/resp.json)"

echo "=== 8. GOOGLE ==="
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/auth/google" -H "Content-Type: application/json" -H "X-Forwarded-For: $(IP)" -d '{}')
[ "$code" = 400 ] && echo "PASS [400] google empty" || echo "FAIL [$code] google empty => $(head -c 120 /tmp/resp.json)"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/auth/google" -H "Content-Type: application/json" -H "X-Forwarded-For: $(IP)" -d '{"credential":"garbage.token.value"}')
[ "$code" = 401 ] && echo "PASS [401] google invalid token" || echo "FAIL [$code] google invalid => $(head -c 120 /tmp/resp.json)"
[ "$code" = 401 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

echo "=== 9. PAYMENT create-order ==="
if [ -n "$PID" ] && [ -n "$TOKEN" ]; then
  code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 30 -X POST "$BASE/api/payment/create-order" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"items\":[{\"productId\":\"$PID\",\"quantity\":1}],\"shippingAddress\":{\"fullName\":\"QA\",\"phone\":\"9876543210\",\"street\":\"1 Main\",\"city\":\"Delhi\",\"state\":\"DL\",\"pinCode\":\"110001\"}}")
  echo "REAL [${code}] create-order happy => $(head -c 200 /tmp/resp.json)"
  code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/payment/create-order" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"items":[],"shippingAddress":{}}')
  [ "$code" = 400 ] && echo "PASS [400] create-order empty items" || echo "FAIL [$code] empty items => $(head -c 120 /tmp/resp.json)"
  code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/payment/create-order" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"items\":[{\"productId\":\"$PID\",\"quantity\":0}]}")
  [ "$code" = 400 ] && echo "PASS [400] qty 0" || echo "FAIL [$code] qty0 => $(head -c 120 /tmp/resp.json)"
  code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/payment/create-order" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"items":[{"productId":"badid","quantity":1}]}')
  echo "REAL [${code}] invalid product id => $(head -c 120 /tmp/resp.json)"
  code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 30 -X POST "$BASE/api/payment/create-order" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"items\":[{\"productId\":\"$PID\",\"quantity\":1},{\"productId\":\"$PID\",\"quantity\":2}],\"shippingAddress\":{\"fullName\":\"QA\",\"phone\":\"9876543210\",\"street\":\"1\",\"city\":\"D\",\"state\":\"DL\",\"pinCode\":\"110001\"}}")
  echo "REAL [${code}] duplicate product ids => $(head -c 160 /tmp/resp.json)"
fi
echo "=== 10. verify-payment (bogus) ==="
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/payment/verify-payment" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"razorpay_order_id":"order_abc","razorpay_payment_id":"pay_abc","razorpay_signature":"sig"}')
echo "REAL [${code}] verify bogus => $(head -c 120 /tmp/resp.json)"

echo "=== 11. MY ORDERS ==="
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 "$BASE/api/orders/myorders/$UID" -H "Authorization: Bearer $TOKEN")
[ "$code" = 200 ] && echo "PASS [200] my orders" || echo "FAIL [$code] my orders => $(head -c 120 /tmp/resp.json)"
[ "$code" = 200 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 "$BASE/api/orders/myorders/507f1f77bcf86cd799439011" -H "Authorization: Bearer $TOKEN")
[ "$code" = 403 ] && echo "PASS [403] others orders" || echo "FAIL [$code] others orders => $(head -c 120 /tmp/resp.json)"
[ "$code" = 403 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
echo "--- removed legacy orders endpoints ---"
code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -m 20 -X POST "$BASE/api/orders/add" -H "Content-Type: application/json" -d '{}')
echo "REAL [${code}] POST /api/orders/add (should 404)"

echo ""
echo "======== SUMMARY: PASS=$PASS FAIL=$FAIL ========"
