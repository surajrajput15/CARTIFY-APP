// Cartify QA - backend behavior tests (Node fetch)
const BASE = 'http://localhost:5000';
const TS = Date.now();
const results = { pass: 0, fail: 0, real: [] };
const report = [];

function req(method, path, { token, body, xff } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  headers['X-Forwarded-For'] = xff || `${(Math.random()*250|0)+2}.${(Math.random()*250|0)+2}.${(Math.random()*250|0)+2}.${(Math.random()*250|0)+2}`;
  return fetch(BASE + path, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined
  }).then(async r => ({ status: r.status, json: await r.json().catch(() => null) }));
}

function check(name, cond, detail) {
  report.push(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` :: ${detail}` : ''}`);
  cond ? results.pass++ : results.fail++;
}
function real(name, res) {
  results.real.push({ name, status: res.status, body: JSON.stringify(res.json).slice(0, 180) });
  report.push(`[REAL:${res.status}] ${name} :: ${JSON.stringify(res.json).slice(0, 180)}`);
}

const run = async () => {
  // ============ PRODUCTS ============
  let r = await req('GET', '/api/products');
  check('GET /api/products 200', r.status === 200 && Array.isArray(r.json?.products));
  const total = r.json?.total;
  const PID = r.json?.products?.[0]?._id;
  check('products returned with _id', !!PID);
  real('product count total', r);

  r = await req('GET', '/api/products?page=2&limit=4');
  check('pagination page=2 limit=4', r.status === 200 && r.json?.products?.length === 4);

  r = await req('GET', '/api/products?search=iphone');
  check('search=iphone returns results', r.status === 200 && r.json?.total > 0);
  real('search=iphone', r);

  r = await req('GET', '/api/products?search=zzzzzznope');
  check('search no-match returns empty (200)', r.status === 200 && r.json?.total === 0);

  r = await req('GET', '/api/products?search=' + encodeURIComponent('((a+)+)+b'));
  check('ReDoS payload rejected safely', r.status === 200 || r.status === 400);

  r = await req('GET', '/api/products?search=' + 'a'.repeat(120));
  check('120-char search -> 400', r.status === 400);

  r = await req('GET', '/api/products?category=electronics');
  real('category=electronics', r);
  check('category=electronics returns 200', r.status === 200);

  r = await req('GET', '/api/products?limit=abc&page=abc');
  check('non-numeric page/limit tolerated (defaults)', r.status === 200);

  r = await req('GET', `/api/products/${PID}`);
  check(`GET valid product by id 200`, r.status === 200 && r.json?._id === PID);

  r = await req('GET', '/api/products/notanid');
  real('GET product invalid ObjectId', r);
  check('GET invalid ObjectId -> 4xx', r.status === 400 || r.status === 404);

  r = await req('GET', '/api/products/507f1f77bcf86cd799439011');
  check('GET nonexistent product -> 404', r.status === 404);

  // ============ REGISTER / LOGIN ============
  const EMAIL = `qa${TS}@test.com`;
  r = await req('POST', '/api/auth/register', { body: { name: 'QA User', email: EMAIL, password: 'qaPass123' } });
  check('register 201', r.status === 201);
  r = await req('POST', '/api/auth/register', { body: { name: 'QA User', email: EMAIL, password: 'qaPass123' } });
  check('register duplicate 400', r.status === 400);
  r = await req('POST', '/api/auth/register', { body: {} });
  check('register empty 400', r.status === 400);
  r = await req('POST', '/api/auth/register', { body: { name: 'Weak', email: `qaweak${TS}@t.com`, password: '123' } });
  real('register with 3-char password (policy?)', r);
  check('register weak password accepted (6+ policy not enforced)', r.status === 201);

  r = await req('POST', '/api/auth/login', { body: { email: EMAIL, password: 'qaPass123' } });
  check('login 200', r.status === 200);
  const TOKEN = r.json?.token;
  const USERID = r.json?.user?.id;
  check('login returns token', !!TOKEN);
  r = await req('POST', '/api/auth/login', { body: { email: EMAIL, password: 'WRONG' } });
  check('login wrong password 400', r.status === 400);
  r = await req('POST', '/api/auth/login', { body: { email: 'ghost' + TS + '@nope.com', password: 'x' } });
  check('login unknown user 400', r.status === 400);

  // ============ AUTH GUARDS ============
  r = await req('GET', '/api/orders/myorders/anyid');
  check('no token -> 401', r.status === 401);
  r = await req('POST', '/api/payment/create-order', { body: {} });
  check('create-order no token -> 401', r.status === 401);
  r = await req('POST', '/api/products/add', { body: {} });
  check('product add no token -> 401', r.status === 401);

  // ============ PROFILE ============
  r = await req('PUT', `/api/auth/update/${USERID}`, { token: TOKEN, body: { name: 'QA Renamed' } });
  check('update own profile 200', r.status === 200 && r.json?.user?.name === 'QA Renamed');
  r = await req('PUT', `/api/auth/update/${USERID}`, { token: TOKEN, body: { name: '' } });
  real('update profile with empty name', r);
  check('empty-name update rejected', r.status === 400);
  r = await req('PUT', '/api/auth/update/507f1f77bcf86cd799439011', { token: TOKEN, body: { name: 'hack' } });
  check('update other user -> 403', r.status === 403);

  // ============ ADDRESSES ============
  r = await req('POST', '/api/addresses/add', { token: TOKEN, body: { fullName: 'QA User', phone: '9876543210', street: '1 Main St', city: 'Delhi', state: 'Delhi', pinCode: '110001' } });
  check('address add 201', r.status === 201);
  const AID = r.json?._id;
  r = await req('POST', '/api/addresses/add', { token: TOKEN, body: {} });
  real('address add empty body', r);
  check('address add empty body rejected (validation)', r.status === 400);
  r = await req('GET', `/api/addresses/${USERID}`, { token: TOKEN });
  check('get own addresses 200', r.status === 200);
  r = await req('GET', '/api/addresses/507f1f77bcf86cd799439011', { token: TOKEN });
  check('get other addresses -> 403', r.status === 403);
  r = await req('DELETE', `/api/addresses/${AID}`, { token: TOKEN });
  check('delete own address 200', r.status === 200);
  r = await req('DELETE', '/api/addresses/notanid', { token: TOKEN });
  real('delete address invalid id', r);
  check('delete invalid id -> 4xx', r.status === 400 || r.status === 404);

  // ============ OTP ============
  const OTPEMAIL = `qaotp${TS}@test.com`;
  r = await req('POST', '/api/auth/send-otp', { body: { email: OTPEMAIL } });
  real('send-otp new user', r);
  check('send-otp 200 (auto-creates user)', r.status === 200);
  r = await req('POST', '/api/auth/verify-otp', { body: { email: OTPEMAIL, otp: '000000' } });
  check('verify-otp wrong -> 400', r.status === 400);
  r = await req('POST', '/api/auth/send-otp', { body: { email: 'notanemail' } });
  real('send-otp invalid email format', r);
  check('send-otp invalid format -> graceful', r.status === 200 || r.status === 400);

  // ============ FORGOT / RESET ============
  r = await req('POST', '/api/auth/forgot-password', { body: { email: 'ghost_never@nope.com' } });
  real('forgot-password unknown user', r);
  r = await req('POST', '/api/auth/forgot-password', { body: { email: EMAIL } });
  check('forgot-password known 200', r.status === 200);
  r = await req('POST', '/api/auth/reset-password', { body: { email: EMAIL, otp: '000000', newPassword: 'newPass123' } });
  check('reset-password wrong otp 400', r.status === 400);

  // ============ GOOGLE ============
  r = await req('POST', '/api/auth/google', { body: {} });
  check('google empty -> 400', r.status === 400);
  r = await req('POST', '/api/auth/google', { body: { credential: 'garbage.token' } });
  check('google invalid token -> 401', r.status === 401);

  // ============ PAYMENT create-order ============
  const addr = { fullName: 'QA', phone: '9876543210', street: '1 Main', city: 'Delhi', state: 'DL', pinCode: '110001' };
  r = await req('POST', '/api/payment/create-order', { token: TOKEN, body: { items: [{ productId: PID, quantity: 1 }], shippingAddress: addr } });
  real('create-order happy path', r);
  check('create-order 200 with razorpay order', r.status === 200 && !!r.json?.order?.id);
  r = await req('POST', '/api/payment/create-order', { token: TOKEN, body: { items: [], shippingAddress: addr } });
  check('create-order empty items 400', r.status === 400);
  r = await req('POST', '/api/payment/create-order', { token: TOKEN, body: { items: [{ productId: PID, quantity: 0 }], shippingAddress: addr } });
  check('create-order qty0 400', r.status === 400);
  r = await req('POST', '/api/payment/create-order', { token: TOKEN, body: { items: [{ productId: PID, quantity: 21 }], shippingAddress: addr } });
  check('create-order qty>20 400', r.status === 400);
  r = await req('POST', '/api/payment/create-order', { token: TOKEN, body: { items: [{ productId: 'badid', quantity: 1 }], shippingAddress: addr } });
  real('create-order invalid productId', r);
  r = await req('POST', '/api/payment/create-order', { token: TOKEN, body: { items: [{ productId: PID, quantity: 1 }], shippingAddress: {} } });
  real('create-order missing address fields', r);
  r = await req('POST', '/api/payment/create-order', { token: TOKEN, body: { items: [{ productId: PID, quantity: 1 }, { productId: PID, quantity: 2 }], shippingAddress: addr } });
  real('create-order duplicate product ids', r);
  check('create-order duplicate ids ok (dedupe)', r.status === 200);

  // ============ verify-payment ============
  r = await req('POST', '/api/payment/verify-payment', { token: TOKEN, body: { razorpay_order_id: 'order_xxx', razorpay_payment_id: 'pay_xxx', razorpay_signature: 'sig' } });
  real('verify-payment bogus order id', r);
  check('verify-payment bogus -> 400', r.status === 400);

  // ============ MY ORDERS ============
  r = await req('GET', `/api/orders/myorders/${USERID}`, { token: TOKEN });
  check('my orders 200', r.status === 200);
  real('my orders body', r);
  r = await req('GET', '/api/orders/myorders/507f1f77bcf86cd799439011', { token: TOKEN });
  check('others orders -> 403', r.status === 403);

  // ============ RATE LIMIT (same IP) ============
  const SAMEIP = '77.77.77.77';
  let got429 = false;
  for (let i = 0; i < 8; i++) {
    const rr = await req('POST', '/api/auth/send-otp', { xff: SAMEIP, body: { email: `rl${i}_${TS}@t.com` } });
    if (rr.status === 429) { got429 = true; break; }
  }
  check('auth rate-limit 429 on same IP', got429);

  console.log(report.join('\n'));
  console.log(`\n===== SUMMARY: PASS=${results.pass} FAIL=${results.fail} REAL=${results.real.length} =====`);
};

run().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
