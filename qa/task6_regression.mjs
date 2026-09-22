// TASK 6 — Full live E2E regression for Cartify (runs against the real backend on :5000)
// Flow: products → register/auto-login → cart CRUD → addresses → logout/login-again →
// session-refresh recovery → coupons → payment create-order (+forged-signature negative)
// → REAL Razorpay test-mode payment via the browser (checkout.js) → verify → orders →
// profile (name/password/ownership) → admin ops → security negatives → cleanup.
// No secrets are printed. Test artefacts are removed at the end.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require2 = createRequire(import.meta.url);
const path = require2('node:path');
const { chromium } = require2('playwright-core');
const { CHROME, loadBackendEnv, getMongoose, assertLocalDb } = require2('./qa-utils.cjs');

loadBackendEnv();

const BASE = 'http://localhost:5000';
const FE = 'http://localhost:5173';
const jar = new Map(); // shared cookie jar
let csrfToken = null;
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pass(name, extra = '') { results.push({ name, ok: true }); console.log(`[PASS] ${name}${extra ? ' — ' + extra : ''}`); }
function fail(name, extra = '') { results.push({ name, ok: false }); console.log(`[FAIL] ${name}${extra ? ' — ' + extra : ''}`); }
function info(msg) { console.log(`[INFO] ${msg}`); }

function absorbCookies(res) {
  const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of set) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(custom) {
  const merged = new Map(jar);
  if (custom) for (const [k, v] of Object.entries(custom)) if (v === null) merged.delete(k); else merged.set(k, v);
  return [...merged.entries()].filter(([, v]) => v !== '').map(([k, v]) => `${k}=${v}`).join('; ');
}

async function req(method, path, { body, cookies, headers = {}, raw = null } = {}) {
  const h = { ...headers };
  if (raw !== null || body !== undefined) h['Content-Type'] = h['Content-Type'] || 'application/json';
  if (cookies !== undefined || jar.size) h['Cookie'] = cookieHeader(cookies);
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(method.toLowerCase()) && !headers['X-CSRF-Token'] && path !== '/api/auth/csrf-token') {
    h['X-CSRF-Token'] = csrfToken;
  }
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: raw !== null ? raw : (body === undefined ? undefined : JSON.stringify(body)),
  });
  absorbCookies(res);
  let data = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, res };
}

async function withJar(candidate, fn) {
  const prev = new Map(jar);
  for (const k of [...jar.keys()]) jar.delete(k);
  for (const [k, v] of candidate) jar.set(k, v);
  try { return await fn(); } finally {
    for (const k of [...jar.keys()]) jar.delete(k);
    for (const [k, v] of prev) jar.set(k, v);
  }
}

const rnd = Date.now().toString(36);
const email1 = `task6.qa.user1.${rnd}@example.com`;
const email2 = `task6.qa.user2.${rnd}@example.com`;
const pw1 = 'Task6Pass1A';
const pw1New = 'Task6Pass2B';
const ADDRESS = { fullName: 'QA Tester', phone: '+91 98765 43210', street: '12 Test Lane', city: 'Mumbai', state: 'Maharashtra', pinCode: '110 001', isDefault: true };

let u1 = null, u2 = null, adminUser = null;
let P1 = null, P2 = null, testProduct = null, address1 = null;
const couponIds = [];

// ADMIN_JAR comes from qa/task6_make_admin.cjs (admin login cookies on disk).
const ADMIN_JAR = new Map();
try {
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(process.cwd(), '.task6_admin_cookies.json'), 'utf8')))) ADMIN_JAR.set(k, v);
} catch { /* admin cookie file missing — admin tests fail loudly below */ }

async function adminApi(method, path, body) {
  return withJar(ADMIN_JAR, () => req(method, path, { body }));
}

async function main() {
  info(`Test run ${rnd} — ${email1} / ${email2}`);

  // ---------- HEALTH ----------
  let r = await req('GET', '/health');
  r.status === 200 && r.data?.status === 'ok' ? pass('GET /health 200 ok') : fail('GET /health', `status ${r.status}`);

  // ---------- PRODUCTS ----------
  r = await req('GET', '/api/products?limit=100');
  const prod = r.data?.products || [];
  prod.length > 0 ? pass('GET /api/products loads catalog', `${r.data.total} total`) : fail('GET /api/products');
  P1 = prod.find((p) => p.countInStock > 2 && p.price > 300);
  P2 = prod.find((p) => p.countInStock > 0 && p._id !== P1?._id);
  P1 && P2 ? pass('Two in-stock products selected') : fail('No suitable products');
  r = await req('GET', `/api/products/${P1._id}`);
  r.status === 200 && r.data?._id === P1._id ? pass('GET /api/products/:id detail') : fail('product detail', `status ${r.status}`);
  r = await req('GET', '/api/products/000000000000000000000000');
  r.status === 404 ? pass('Nonexistent product id → 404') : fail('nonexistent product', `status ${r.status}`);
  r = await req('GET', '/api/products/notanid');
  r.status === 400 ? pass('Malformed product id → 400') : fail('malformed id', `status ${r.status}`);
  r = await req('GET', '/api/products?page=abc&limit=1000');
  r.status === 200 ? pass('Garbage pagination tolerated (capped)') : fail('pagination caps', `status ${r.status}`);

  // ---------- CSRF TOKEN ----------
  r = await req('GET', '/api/auth/csrf-token');
  if (r.status === 200 && r.data?.csrfToken) { csrfToken = r.data.csrfToken; pass('CSRF token acquired'); }
  else fail('CSRF token fetch', `status ${r.status}`);

  // ---------- AUTH: unauthenticated negatives ----------
  r = await req('GET', '/api/cart');
  r.status === 401 ? pass('Unauth GET /api/cart → 401') : fail('unauth cart', `status ${r.status}`);
  r = await req('GET', '/api/auth/me');
  r.status === 401 ? pass('Unauth GET /api/auth/me → 401') : fail('unauth me', `status ${r.status}`);
  r = await req('GET', '/api/orders/myorders/000000000000000000000000');
  r.status === 401 ? pass('Unauth orders → 401') : fail('unauth orders', `status ${r.status}`);

  // ---------- REGISTER (auto-login) ----------
  await sleep(13000);
  r = await req('POST', '/api/auth/register', { body: { name: 'Task Six QA', email: email1, password: pw1 } });
  (r.status === 201 && r.data?.user?.id) ? pass('POST /api/auth/register 201 + auto-login') : fail('register', JSON.stringify(r.data).slice(0, 120));
  u1 = r.data?.user || null;

  // ---------- CART CRUD + CAPS ----------
  r = await req('POST', '/api/cart/merge', { body: { items: [{ productId: P1._id, quantity: 2 }, { productId: P2._id, quantity: 1 }] } });
  const mergedQty = (r.data?.items || []).find((i) => i._id === P1._id)?.quantity;
  r.status === 200 && mergedQty === 2 ? pass('POST /api/cart/merge merges + hydrates') : fail('cart merge', `status ${r.status} qty ${mergedQty}`);
  r = await req('PUT', '/api/cart', { body: { items: [{ productId: P1._id, quantity: 999 }] } });
  const capped = (r.data?.items || [])[0]?.quantity;
  capped === 20 ? pass('Cart quantity capped at 20 server-side') : fail('cart cap', `qty ${capped}`);
  r = await req('PUT', '/api/cart', { body: { items: [{ productId: P1._id, quantity: 3 }, { productId: 'not-an-id', quantity: 2 }] } });
  const cleanItems = r.data?.items || [];
  cleanItems.length === 1 && cleanItems[0].quantity === 3 ? pass('Invalid product ids filtered from cart') : fail('cart filter', JSON.stringify(cleanItems).slice(0, 100));
  r = await req('PUT', '/api/cart', { body: { items: [{ productId: P1._id, quantity: 3 }, { productId: P2._id, quantity: 1 }] } });
  r = await req('GET', '/api/cart');
  r.status === 200 && r.data?.items?.length === 2 ? pass('GET /api/cart persistence (refresh-equivalent)') : fail('cart get', `status ${r.status} n=${r.data?.items?.length}`);

  // ---------- SESSION REFRESH ----------
  r = await req('POST', '/api/auth/refresh');
  r.status === 200 ? pass('POST /api/auth/refresh rotates session') : fail('refresh', `status ${r.status}`);
  r = await req('GET', '/api/auth/me');
  (r.status === 200 && r.data?.user?.id === u1.id) ? pass('Session valid after refresh (/me)') : fail('me after refresh', `status ${r.status}`);
  const meStr = JSON.stringify(r.data || {});
  (!meStr.includes('"password"') && r.data?.user?.hasPassword === true) ? pass('/me exposes hasPassword, never the hash') : fail('/me leakage', meStr.slice(0, 120));

  // ---------- EXPIRED-ACCESS RECOVERY ----------
  r = await req('GET', '/api/cart', { cookies: { accessToken: 'garbage' } });
  r.status === 401 ? pass('Garbage access token → 401') : fail('garbage access', `status ${r.status}`);
  r = await req('POST', '/api/auth/refresh');
  r.status === 200 ? pass('Refresh recovers from dead access token') : fail('refresh recovery', `status ${r.status}`);
  r = await req('GET', '/api/cart');
  r.status === 200 ? pass('Cart works after access-token rotation') : fail('cart after recovery', `status ${r.status}`);

  // ---------- ADDRESSES ----------
  r = await req('POST', '/api/addresses/add', { body: ADDRESS });
  (r.status === 201 && r.data?.phone === '9876543210' && r.data?.pinCode === '110001')
    ? pass('POST /api/addresses/add normalises phone/PIN') : fail('address add', JSON.stringify(r.data).slice(0, 120));
  address1 = r.data;
  r = await req('GET', `/api/addresses/${u1.id}`);
  r.status === 200 && r.data?.some((a) => a._id === address1._id) ? pass('GET /api/addresses/:userId lists own') : fail('address list', `status ${r.status}`);
  r = await req('PUT', `/api/addresses/${address1._id}`, { body: { street: '99 Updated Street' } });
  r.status === 200 && r.data?.street === '99 Updated Street' ? pass('PUT /api/addresses/:id edit') : fail('address edit', `status ${r.status}`);

  // ---------- LOGOUT / LOGIN-AGAIN ----------
  r = await req('POST', '/api/auth/logout');
  r.status === 200 ? pass('POST /api/auth/logout') : fail('logout', `status ${r.status}`);
  r = await req('GET', '/api/auth/me');
  r.status === 401 ? pass('Session dead after logout (/me → 401)') : fail('me after logout', `status ${r.status}`);
  r = await req('GET', '/api/cart');
  r.status === 401 ? pass('Protected routes blocked after logout') : fail('cart after logout', `status ${r.status}`);

  // ---------- SECOND USER ----------
  await sleep(13000);
  r = await req('POST', '/api/auth/register', { body: { name: 'Task Six Two', email: email2, password: pw1 } });
  (r.status === 201 && r.data?.user?.id) ? pass('Second user registered') : fail('register u2', JSON.stringify(r.data).slice(0, 120));
  u2 = r.data?.user;

  // ---------- u1 LOGS BACK IN (paced) ----------
  await sleep(13000);
  r = await req('POST', '/api/auth/login', { body: { email: email1, password: 'WrongPass1A' } });
  r.status === 400 ? pass('Wrong password login → 400 (uniform message)') : fail('wrong login', `status ${r.status}`);
  await sleep(13.5 * 60 * 1000); // wait out the 5/min credential window fully
  r = await req('POST', '/api/auth/login', { body: { email: email1, password: pw1 } });
  (r.status === 200 && r.data?.user?.id === u1.id) ? pass('Login-again with correct password') : fail('login u1', `status ${r.status}`);

  // ---------- COUPONS (admin creates; user applies) ----------
  r = await req('GET', '/api/coupons');
  r.status === 403 ? pass('User GET /api/coupons → 403 (admin-only)') : fail('coupons user', `status ${r.status}`);

  const coupons = [
    { code: `T6PCT${rnd.toUpperCase()}`, type: 'percentage', value: 10, minOrderAmount: 500, maxDiscount: 400, validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 86400000).toISOString(), isActive: true },
    { code: `T6FIX${rnd.toUpperCase()}`, type: 'fixed', value: 100, validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 86400000).toISOString(), isActive: true },
    { code: `T6EXP${rnd.toUpperCase()}`, type: 'fixed', value: 500, validFrom: new Date(Date.now() - 8.64e7).toISOString(), validUntil: new Date(Date.now() - 3.6e6).toISOString(), isActive: true },
    { code: `T6MIN${rnd.toUpperCase()}`, type: 'fixed', value: 50, minOrderAmount: 100000, validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 86400000).toISOString(), isActive: true },
  ];
  for (const c of coupons) {
    const rr = await adminApi('POST', '/api/coupons', c);
    if (rr.status === 201 && rr.data?.coupon?._id) { couponIds.push(rr.data.coupon._id); pass(`Admin created coupon ${c.code}`); }
    else fail(`Admin create ${c.code}`, JSON.stringify(rr.data).slice(0, 120));
  }

  const sub = P1.price * 3 + P2.price; // cart = {P1 x3, P2 x1}
  const amount = (cartTotal) => Math.round(Number(cartTotal) * 100);

  // valid % coupon with max cap + min order
  r = await req('POST', '/api/coupons/validate', { body: { code: coupons[0].code, orderAmount: sub, items: [{ productId: P1._id, quantity: 3 }] } });
  (r.status === 200 && r.data?.coupon?.discount === Math.min(Math.round(sub * 0.10 * 100) / 100, 4))
    ? pass('Coupon validate: percentage with cap + min-order', `discount ${r.data?.coupon?.discount}`) : fail('coupon pct', JSON.stringify(r.data).slice(0, 150));
  // invalid → 404 ; expired → 404 ; below-min → 400
  r = await req('POST', '/api/coupons/validate', { body: { code: 'NOSUCHCODE', orderAmount: sub, items: [] } });
  r.status === 404 ? pass('Invalid coupon → 404') : fail('invalid coupon', `status ${r.status}`);
  r = await req('POST', '/api/coupons/validate', { body: { code: coupons[2].code, orderAmount: sub, items: [] } });
  r.status === 404 ? pass('Expired coupon → 404') : fail('expired coupon', `status ${r.status}`);
  r = await req('POST', '/api/coupons/validate', { body: { code: coupons[3].code, orderAmount: sub, items: [] } });
  r.status === 400 ? pass('Below-min-order coupon → 400') : fail('min coupon', `status ${r.status}`);

  // ---------- PAYMENT: create-order (server-authoritative) ----------
  r = await req('POST', '/api/payment/create-order', { body: { items: [{ productId: P1._id, quantity: 3 }, { productId: P2._id, quantity: 1 }], shippingAddress: address1 } });
  (r.status === 200 && r.data?.order?.amount === amount(sub) && r.data?.order?.id)
    ? pass('create-order: server-computed amount matches client math', `amount ${r.data?.order?.amount}`) : fail('create-order', JSON.stringify(r.data).slice(0, 200));
  const rzp1 = r.data;
  // Price-tamper check: client sends prices; server must ignore them
  r = await req('POST', '/api/payment/create-order', { body: { items: [{ productId: P1._id, quantity: 3, price: 1 }], shippingAddress: address1 } });
  (r.status === 200 && r.data?.order?.amount === amount(P1.price * 3))
    ? pass('Price tampering ignored (server recomputes from DB)', `amount ${r.data?.order?.amount}`) : fail('price tamper', JSON.stringify(r.data).slice(0, 200));
  // % coupon at charge time
  r = await req('POST', '/api/payment/create-order', { body: { items: [{ productId: P1._id, quantity: 3 }, { productId: P2._id, quantity: 1 }], shippingAddress: address1, couponCode: coupons[0].code } });
  const pctDiscount = Math.min(Math.round(amount(sub) * 0.10) / 100, 4);
  (r.status === 200 && r.data?.order?.amount === amount(sub) - Math.round(pctDiscount * 100))
    ? pass('create-order with % coupon (server discount, paise-exact)', `amount ${r.data?.order?.amount}`) : fail('coupon charge', JSON.stringify(r.data).slice(0, 200));
  info('Abandoned Pending orders will be TTL-purged after 24h (expireAt)');

  // forged signature must fail
  r = await req('POST', '/api/payment/verify-payment', { body: { razorpay_order_id: rzp1.order.id, razorpay_payment_id: 'pay_forge_123', razorpay_signature: 'f'.repeat(64) } });
  r.status === 400 ? pass('Forged payment signature → 400') : fail('forged verify', `status ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);

  // ---------- REAL RAZORPAY PAYMENT (browser test-mode checkout) ----------
  info('Starting browser-based Razorpay test payment (may take ~1 min)...');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1440,950'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  // inject u1 session into the SPA
  await page.goto(FE + '/', { waitUntil: 'load' });
  await page.evaluate((user) => localStorage.setItem('user', JSON.stringify(user)), u1);
  await page.goto(FE + '/', { waitUntil: 'load' });
  await sleep(3000); // authContext /me + cart reconciliation

  // build the cart and go to checkout
  await page.goto(`${FE}/product/${P1._id}`, { waitUntil: 'load' });
  await sleep(1500);
  await page.getByRole('button', { name: /Add to Cart/i }).click();
  await sleep(800);
  await page.goto(`${FE}/product/${P2._id}`, { waitUntil: 'load' });
  await sleep(1500);
  await page.getByRole('button', { name: /Add to Cart/i }).click();
  await sleep(800);
  await page.goto(FE + '/checkout', { waitUntil: 'load' });
  await sleep(3500);
  // select the saved address
  await page.locator('input[type="radio"]').first().check().catch(() => {});
  await sleep(400);
  await page.getByRole('button', { name: /pay/i }).first().click();

  // wait for the Razorpay modal frame
  let rzpFrame = null;
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    rzpFrame = page.frames().find((f) => f !== page.mainFrame() && f.url().includes('razorpay'));
    if (rzpFrame) break;
  }
  if (!rzpFrame) {
    fail('Razorpay modal opened', 'no razorpay frame after 40s');
    await page.screenshot({ path: 'rzp-no-modal.png' });
  } else {
    pass('Razorpay modal opened');
    await sleep(3000);
    // fill the card form (Razorpay test mode)
    let holder = null;
    for (let i = 0; i < 15; i++) {
      for (const f of page.frames()) {
        const n = await f.locator('input[placeholder*="Card number" i]').count().catch(() => 0);
        if (n) { holder = f; break; }
      }
      if (holder) break;
      await sleep(1000);
    }
    if (!holder) {
      fail('Razorpay card form', 'card number input not found');
      await page.screenshot({ path: 'rzp-no-card.png' });
    } else {
      pass('Razorpay card form found');
      await holder.locator('input[placeholder*="Card number" i]').fill('4111111111111111');
      const exp = holder.locator('input[placeholder*="MM/YY" i]');
      const cvv = holder.locator('input[placeholder*="CVV" i]');
      if (await exp.count().catch(() => 0)) await exp.fill('12/30');
      if (await cvv.count().catch(() => 0)) await cvv.fill('123');
      await sleep(800);
      // PAY button lives in a sibling frame (not the secure iframe)
      let payFrame = null;
      for (const f of page.frames()) {
        if (f === holder) continue;
        const n = await f.getByRole('button', { name: /pay/i }).count().catch(() => 0);
        if (n) { payFrame = f; break; }
      }
      if (!payFrame) {
        fail('Razorpay PAY button', 'not found');
        await page.screenshot({ path: 'rzp-no-pay.png' });
      } else {
        pass('Razorpay PAY button found');
        await payFrame.getByRole('button', { name: /pay/i }).first().click();
        info('PAY clicked — waiting for success toast / redirect (up to 60s)...');
        let done = false;
        for (let t = 0; t < 60; t++) {
          await sleep(1000);
          const url = page.url();
          const cleared = await page.evaluate(() => { const c = localStorage.getItem('cart'); return c === null || c === '[]'; });
          if (url.includes('/profile') || cleared) { done = true; break; }
        }
        done ? pass('Payment completed → cart cleared / redirected') : fail('payment completion', `url ${page.url()}`);
        await page.screenshot({ path: 'rzp-after.png' });
      }
    }
  }
  const feErrors = consoleErrors.filter((e) => !e.includes('gsi') && !e.includes('net::') && !e.includes('favicon'));
  feErrors.length === 0 ? pass('No console errors during frontend payment flow') : fail('FE console errors', JSON.stringify(feErrors.slice(0, 4)));
  await browser.close();

  // ---------- ORDERS: persistence, integrity, ownership ----------
  assertLocalDb();
  const mongoose = getMongoose();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const orders = await mongoose.connection.db.collection('orders')
    .find({ userId: new mongoose.Types.ObjectId(u1.id) }).sort({ createdAt: -1 }).toArray();
  await mongoose.connection.close();
  orders.length >= 1 ? pass('Order persisted in MongoDB for u1', `${orders.length} docs`) : fail('orders in DB', `n=${orders.length}`);
  const paid = orders.find((o) => o.paymentStatus === 'Paid');
  if (paid) {
    pass('Order is Paid (browser payment verified)', `total Rs.${paid.totalPrice}`);
    const itemSum = paid.orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    itemSum === paid.totalPrice ? pass('Order items sum matches total') : fail('order sum', `${itemSum} vs ${paid.totalPrice}`);
    paid.razorpayPaymentId ? pass('Order carries razorpayPaymentId') : fail('order rzp id');
    paid.status === 'Processing' ? pass('Paid order status = Processing') : fail('order status', paid.status);
    paid.shippingAddress?.phone === '9876543210' ? pass('Order snapshot has shipping address') : fail('order address', JSON.stringify(paid.shippingAddress).slice(0, 100));
    const dupCount = orders.filter((o) => o.razorpayOrderId === paid.razorpayOrderId).length;
    dupCount === 1 ? pass('No duplicate order for one Razorpay order') : fail('duplicate order', `count ${dupCount}`);
  } else {
    fail('Paid order present', 'no Paid order found');
  }
  // stock was reserved exactly once
  const stockNow = Number((await req('GET', `/api/products/${P1._id}`)).data?.countInStock);
  stockNow === P1.countInStock - 3 ? pass('Stock decremented exactly once (3 units)') : fail('stock decrement', `before ${P1.countInStock} now ${stockNow}`);
  // ownership negatives over the API
  r = await req('GET', `/api/orders/myorders/${u2.id}`);
  r.status === 403 ? pass('u1 reading u2 orders → 403') : fail('cross orders', `status ${r.status}`);
  r = await req('GET', `/api/orders/myorders/${crypto.randomUUID()}`);
  r.status === 403 ? pass('Arbitrary userId (uuid) → 403') : fail('arbitrary orders', `status ${r.status}`);

  // ---------- PROFILE: name, change-password, ownership negatives ----------
  r = await req('PUT', `/api/auth/update/${u1.id}`, { body: { name: 'Task Six Renamed' } });
  (r.status === 200 && r.data?.user?.name === 'Task Six Renamed') ? pass('PUT /api/auth/update/:id name change') : fail('name change', JSON.stringify(r.data).slice(0, 120));
  r = await req('PUT', `/api/auth/update/${u2.id}`, { body: { name: 'Hax' } });
  r.status === 403 ? pass('Updating another user profile → 403') : fail('cross update', `status ${r.status}`);
  r = await req('PUT', `/api/auth/change-password/${u1.id}`, { body: { currentPassword: 'WrongOld1A', newPassword: pw1New } });
  r.status === 400 ? pass('Change password with wrong current → 400') : fail('wrong cp', `status ${r.status}`);
  await sleep(13000);
  r = await req('PUT', `/api/auth/change-password/${u1.id}`, { body: { currentPassword: pw1, newPassword: pw1New } });
  r.status === 200 ? pass('Change password success') : fail('change password', `status ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
  await sleep(13000);
  r = await req('PUT', `/api/auth/change-password/${u1.id}`, { body: { currentPassword: pw1New, newPassword: 'nodigitshere' } });
  r.status === 400 ? pass('Weak new password rejected by policy') : fail('weak pw', `status ${r.status}`);
  await sleep(13000);
  r = await req('POST', '/api/auth/login', { body: { email: email1, password: pw1New } });
  (r.status === 200 && r.data?.user?.id === u1.id) ? pass('Re-login with changed password') : fail('relogin new pw', `status ${r.status}`);
  r = await req('DELETE', `/api/auth/delete/${u2.id}`);
  r.status === 403 ? pass('Deleting another user account → 403') : fail('cross delete', `status ${r.status}`);

  // ---------- ADMIN ops ----------
  r = await adminApi('GET', '/api/products?limit=5');
  r.status === 200 ? pass('Admin product catalog access') : fail('admin products', `status ${r.status}`);
  r = await adminApi('POST', '/api/products/add', { title: `T6 Prod ${rnd}`, description: 'QA product', price: 1500, category: 'electronics', image: 'https://res.cloudinary.com/ojvhy6qp/image/upload/v1789723825/cartify/products/macbook-pro-14-m3.jpg', countInStock: 3 });
  (r.status === 201 && r.data?.product?._id) ? pass('Admin add product') : fail('admin add', JSON.stringify(r.data).slice(0, 150));
  testProduct = r.data?.product;
  r = await adminApi('PATCH', `/api/products/${testProduct._id}`, { price: 1799 });
  (r.status === 200 && r.data?.product?.price === 1799) ? pass('Admin edit product price') : fail('admin edit', `status ${r.status}`);
  r = await req('PATCH', `/api/products/${testProduct._id}`, { price: 1 });
  r.status === 401 || r.status === 403 ? pass('Non-admin product edit blocked') : fail('user product edit', `status ${r.status}`);
  r = await adminApi('PATCH', `/api/products/${testProduct._id}`, { image: 'javascript:alert(1)' });
  r.status === 400 ? pass('Malicious image URL rejected') : fail('image url guard', `status ${r.status}`);
  r = await req('GET', '/api/orders/admin');
  r.status === 403 ? pass('User GET /api/orders/admin → 403') : fail('user admin orders', `status ${r.status}`);
  r = await adminApi('GET', '/api/orders/admin?status=Paid&page=1&limit=10');
  (r.status === 200 && Array.isArray(r.data?.orders)) ? pass('Admin orders list + filter') : fail('admin orders', `status ${r.status}`);
  r = await adminApi('GET', '/api/coupons');
  (r.status === 200 && Array.isArray(r.data?.coupons)) ? pass('Admin coupons list') : fail('admin coupons', `status ${r.status}`);
  r = await adminApi('PATCH', `/api/coupons/${couponIds[0]}/toggle`);
  r.status === 200 ? pass('Admin toggle coupon') : fail('admin toggle', `status ${r.status}`);
  r = await adminApi('DELETE', `/api/coupons/${couponIds[1]}`);
  r.status === 200 ? pass('Admin delete coupon #2') : fail('admin delete coupon', `status ${r.status}`);
  r = await adminApi('DELETE', `/api/coupons/${couponIds[3]}`);
  r.status === 200 ? pass('Admin delete coupon #4') : fail('admin delete coupon4', `status ${r.status}`);

  // ---------- SECURITY NEGATIVES ----------
  const savedTok = csrfToken; csrfToken = null;
  r = await req('POST', '/api/cart/merge', { body: { items: [] } });
  r.status === 403 ? pass('Mutation without CSRF token → 403') : fail('csrf negative', `status ${r.status}`);
  csrfToken = savedTok;

  // ---------- CLEANUP ----------
  r = await req('DELETE', `/api/auth/delete/${u1.id}`);
  r.status === 200 ? pass('Delete account (self)') : fail('self delete', `status ${r.status}`);
  r = await req('GET', '/api/auth/me');
  r.status === 401 ? pass('Session dead after delete') : fail('me after delete', `status ${r.status}`);
  for (const cid of couponIds) await adminApi('DELETE', `/api/coupons/${cid}`);
  if (testProduct) {
    const del = await adminApi('DELETE', `/api/products/${testProduct._id}`);
    del.status === 200 ? pass('Admin delete QA product') : fail('admin delete product', `status ${del.status}`);
  }
  for (const f of ['rzp-no-modal.png', 'rzp-no-card.png', 'rzp-no-pay.png', 'rzp-after.png']) {
    try { fs.unlinkSync(f); } catch { /* not created */ }
  }

  // ---------- SUMMARY ----------
  const total = results.length, fails = results.filter((x) => !x.ok);
  console.log(`\n===== TASK 6 LIVE RESULTS: ${total - fails.length}/${total} PASSED =====`);
  if (fails.length) { console.log('FAILED CHECKS:'); fails.forEach((f) => console.log('  ✗ ' + f.name)); }
}

await main().catch((e) => { console.error('FATAL', e); process.exit(1); });






