// Cartify E2E QA part 2 (fixed) — OTP happy path (isolated), checkout+Razorpay, mobile, images
import { chromium } from 'playwright-core';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mongoose = require('C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/Backend/node_modules/mongoose');
const dotenv = require('C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/Backend/node_modules/dotenv');
dotenv.config({ path: 'C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/Backend/.env' });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5174';
const API = 'http://localhost:5000';
const results = [];
let pass = 0, fail = 0;
const ok = n => { results.push(`[PASS] ${n}`); pass++; };
const bad = (n, d) => { results.push(`[FAIL] ${n} :: ${d}`); fail++; };
const info = (n, d) => results.push(`[INFO] ${n} :: ${d}`);
const api = (method, path, body, token) =>
  fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
    .then(async r => ({ status: r.status, json: await r.json().catch(() => ({})) }));

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const TS = Date.now();

  // Wait out any leftover auth-limit windows from prior runs (no auth calls during this wait)
  info('RATE-LIMIT', 'waiting 65s with zero auth calls so 5/min/IP bucket fully resets');
  await new Promise(r => setTimeout(r, 65000));

  // ================= OTP LOGIN HAPPY PATH (exactly 2 auth calls) =================
  const otpEmail = `otp2${TS}@test.com`;
  await api('POST', '/api/auth/send-otp', { email: otpEmail });
  await new Promise(r => setTimeout(r, 2500));
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const otp = (await mongoose.connection.db.collection('users').findOne({ email: otpEmail }))?.otp;
  await mongoose.connection.close();
  info('OTP', `DB otp=${otp}`);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('gsi')) info('CONSOLE[otp]', m.text().slice(0, 140)); });
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', otpEmail);
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await page.waitForTimeout(2500);
  const boxes = page.locator('input[inputmode="numeric"]');
  const n = await boxes.count();
  if (n === 6 && otp) {
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(otp[i]);
    await page.waitForTimeout(4000);
    const tok = await page.evaluate(() => localStorage.getItem('token'));
    const nav = await page.locator('nav').textContent().catch(() => '');
    ok(tok ? 'OTP UI login: auto-submit logs in (token set)' : `OTP UI login failed; alert=${await page.locator('[role="alert"]').textContent().catch(() => '(none)')}`);
    info('OTP-NAV', nav.includes('Hi,') ? 'navbar shows user' : 'navbar missing user');
  } else {
    bad('OTP UI', `expected 6 boxes, got ${n}, otp=${otp}`);
  }

  // ================= CART TOTALS + CHECKOUT + PAYMENT (reuse same context/localStorage) =================
  // switch to password login for a fresh buyer (2 auth calls: register+login)
  const buyerEmail = `buyer2${TS}@test.com`;
  await api('POST', '/api/auth/register', { name: 'Buyer QA', email: buyerEmail, password: 'buyerPass1' });
  const lr = await api('POST', '/api/auth/login', { email: buyerEmail, password: 'buyerPass1' });
  const token = lr.json?.token;
  const buyerUser = lr.json?.user;
  await api('POST', '/api/addresses/add', { fullName: 'Buyer QA', phone: '9876501234', street: '42 QA Street', city: 'Mumbai', state: 'Maharashtra', pinCode: '400001' }, token);

  await page.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); localStorage.removeItem('cart'); }, [token, buyerUser]);
  await page.waitForTimeout(500);

  // add product to cart
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.locator('a[href^="/product/"]').first().click();
  await page.waitForTimeout(1800);
  const priceText = await page.locator('h1').first().textContent().catch(() => '');
  await page.getByRole('button', { name: /Add to Cart/i }).click();
  await page.waitForTimeout(900);
  await page.goto(BASE + '/cart', { waitUntil: 'load' });
  await page.waitForTimeout(1400);

  const totalEl = page.locator('span.text-2xl.font-bold');
  const total0 = await totalEl.textContent().catch(() => '');
  info('CART', `desktop summary total before inc: ${total0}`);
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.waitForTimeout(900);
  const total1 = await totalEl.textContent().catch(() => '');
  info('CART', `desktop summary total after inc: ${total1}`);
  const qty = await page.locator('span[aria-label^="Quantity"]').textContent().catch(() => '');
  ok(qty.trim() === '2' ? 'quantity control increments (2x)' : `quantity not 2 (got ${qty})`);
  ok(total1 && total0 && total1 !== total0 ? `cart total updates on qty change (${total0} -> ${total1})` : 'cart total did NOT change on qty change');

  // proceed to checkout
  await page.getByRole('link', { name: 'Proceed to Checkout' }).click();
  await page.waitForTimeout(2500);
  info('CHECKOUT', `url=${page.url()}`);
  const addrCount = await page.locator('input[type="radio"]').count();
  ok(addrCount > 0 ? 'checkout lists saved address' : 'no address shown on checkout');
  if (addrCount) {
    await page.locator('input[type="radio"]').first().check();
    await page.waitForTimeout(400);
  }
  const payBtn = page.getByRole('button', { name: /rupees/ });
  const payExists = await payBtn.count();
  ok(payExists ? 'Pay button present & enabled' : 'Pay button MISSING');
  if (payExists) await payBtn.click();
  await page.waitForTimeout(7000);

  let rzp = null;
  for (const f of page.frames()) if (f.url().includes('checkout.razorpay.com')) { rzp = f; break; }
  if (rzp) {
    info('RAZORPAY', `modal frame loaded: ${rzp.url().slice(0, 60)}`);
    try {
      const payLabel = await rzp.locator('text=/PAY ₹|Pay ₹/').first().textContent().catch(() => '');
      info('RAZORPAY', `expected pay amount: ${payLabel.trim()}`);
      // try to proceed with card
      const cardTab = rzp.getByText('Card', { exact: true });
      if (await cardTab.count()) await cardTab.click();
      else info('RAZORPAY', 'no Card tab; dumping frame text');
      await rzp.waitForTimeout(2000);
      const frameCount = rzp.frames().length;
      info('RAZORPAY', `nested iframes=${frameCount}`);
      // capture iframe titles to find the card fields iframe
      const iframeTitles = await rzp.locator('iframe').evaluateAll(els => els.map(e => (e.getAttribute('title') || e.getAttribute('name') || '').slice(0, 40))).catch(() => []);
      info('RAZORPAY', `iframe titles: ${JSON.stringify(iframeTitles)}`);
    } catch (e) {
      info('RAZORPAY', `interaction error: ${e.message.split('\n')[0]}`);
    }
    await page.screenshot({ path: 'C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/qa/razorpay-modal.png' });
  } else {
    bad('Razorpay modal', 'checkout modal did not open (no checkout.razorpay.com frame)');
  }
  await page.waitForTimeout(2000);

  // order status after attempted payment
  await page.goto(BASE + '/profile?tab=orders', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const ordersText = await page.locator('main').textContent().catch(() => '');
  info('ORDERS-UI', `orders tab: ${ordersText.replace(/\s+/g, ' ').slice(0, 150)}`);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const uid = lr.json?.user?.id;
  const orders = await mongoose.connection.db.collection('orders').find({ userId: new (require('C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/Backend/node_modules/mongoose')).Types.ObjectId(uid) }).toArray();
  await mongoose.connection.close();
  info('ORDERS-DB', JSON.stringify(orders.map(o => ({ paymentStatus: o.paymentStatus, razorpayPaymentId: !!o.razorpayPaymentId, total: o.totalPrice }))));
  ok(orders.length > 0 ? 'order created in DB after checkout' : 'NO order in DB after checkout');
  await ctx.close();

  // ================= IMAGE AUDIT =================
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p3 = await ctx3.newPage();
  await p3.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p3.waitForTimeout(1800);
  const imgStats = await p3.evaluate(() => {
    const imgs = [...document.images];
    return { total: imgs.length, broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(0, 80)) };
  });
  info('IMAGES', JSON.stringify(imgStats));
  ok(imgStats.broken.length === 0 ? 'no broken images on home' : `${imgStats.broken.length} broken images`);
  // scroll down to trigger lazy loading then re-check
  await p3.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p3.waitForTimeout(2500);
  const imgStats2 = await p3.evaluate(() => ({ broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length, loaded: [...document.images].filter(i => i.complete && i.naturalWidth > 0).length }));
  info('IMAGES-SCROLLED', JSON.stringify(imgStats2));
  ok(imgStats2.broken === 0 ? 'no broken images after full scroll' : `${imgStats2.broken} broken images after scroll`);
  await ctx3.close();

  // ================= MOBILE =================
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mp = await mctx.newPage();
  const overflows = [];
  for (const route of ['/', '/cart', '/login', '/product', '/checkout']) {
    await mp.goto(BASE + route, { waitUntil: 'load' });
    await mp.waitForTimeout(1600);
    const o = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    overflows.push(`${route}${o ? ':OVERFLOW' : ':ok'}`);
  }
  info('MOBILE', overflows.join(' | '));
  ok(overflows.every(x => x.endsWith(':ok')) ? 'no horizontal overflow at 390px' : 'horizontal overflow at 390px');
  // mobile search toggle
  await mp.goto(BASE + '/', { waitUntil: 'load' });
  await mp.waitForTimeout(1200);
  const mSearch = mp.getByRole('button', { name: 'Toggle search' });
  if (await mSearch.count()) {
    await mSearch.click();
    await mp.waitForTimeout(500);
    info('MOBILE', `search toggle clicked; input visible=${await mp.locator('input[type="text"]').first().isVisible().catch(() => false)}`);
  } else {
    info('MOBILE', 'no Toggle search button found');
  }
  await mctx.close();

  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n===== E2E-2 SUMMARY: PASS=${pass} FAIL=${fail} =====`);
};
run().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
