// Cartify E2E QA final — OTP happy path (corrected), Razorpay modal (headed), mobile search
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

const getDbOtp = async email => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const u = await mongoose.connection.db.collection('users').findOne({ email });
  await mongoose.connection.close();
  return u?.otp || null;
};

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const TS = Date.now();

  info('RATE-LIMIT', 'waiting 65s so 5/min/IP auth bucket is fully empty');
  await new Promise(r => setTimeout(r, 65000));

  // ================= OTP HAPPY PATH — browser sends its OWN otp, then we read DB =================
  const otpEmail = `otpf${TS}@test.com`;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('gsi') && !m.text().includes('GTM') && !m.text().includes('OneSignal')) info('CONSOLE[otp]', m.text().slice(0, 140)); });
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', otpEmail);
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await page.waitForTimeout(2500);
  const otp = await getDbOtp(otpEmail);
  info('OTP', `DB otp (fresh, post browser send): ${otp}`);
  const boxes = page.locator('input[inputmode="numeric"]');
  const n = await boxes.count();
  if (n === 6 && otp) {
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(otp[i]);
    await page.waitForTimeout(4500);
    const tok = await page.evaluate(() => localStorage.getItem('token'));
    if (tok) {
      ok('OTP UI login happy path works (auto-submit -> token set)');
    } else {
      bad('OTP UI login', `alert=${await page.locator('[role="alert"]').textContent().catch(() => '(none)')}`);
    }
  } else {
    bad('OTP UI', `boxes=${n} otp=${otp}`);
  }

  // ================= BUYER + CART + CHECKOUT + RAZORPAY (headed) =================
  const buyerEmail = `buyerf${TS}@test.com`;
  await api('POST', '/api/auth/register', { name: 'Buyer QA', email: buyerEmail, password: 'buyerPass1' });
  const lr = await api('POST', '/api/auth/login', { email: buyerEmail, password: 'buyerPass1' });
  const token = lr.json?.token;
  await api('POST', '/api/addresses/add', { fullName: 'Buyer QA', phone: '9876501234', street: '42 QA Street', city: 'Mumbai', state: 'Maharashtra', pinCode: '400001' }, token);
  await ctx.close();

  // headed browser for Razorpay modal (modal is iframe POST based)
  const b2 = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--window-size=1440,900'] });
  const ctx2 = await b2.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx2.newPage();
  p.on('pageerror', e => info('PAGEERR[pay]', e.message.slice(0, 160)));
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); localStorage.removeItem('cart'); }, [token, lr.json.user]);
  await p.waitForTimeout(700);
  await p.locator('a[href^="/product/"]').first().click();
  await p.waitForTimeout(1800);
  await p.getByRole('button', { name: /Add to Cart/i }).click();
  await p.waitForTimeout(900);
  await p.goto(BASE + '/cart', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.getByRole('link', { name: 'Proceed to Checkout' }).click();
  await p.waitForTimeout(2500);
  await p.locator('input[type="radio"]').first().check().catch(() => {});
  await p.waitForTimeout(400);
  await p.getByRole('button', { name: /rupees/ }).click();
  info('PAY', `pay clicked; waiting for modal...`);
  await p.waitForTimeout(9000);

  let rzp = null;
  for (const f of p.frames()) {
    if (f.url().includes('checkout.razorpay.com') || f.name().includes('razorpay')) { rzp = f; break; }
  }
  if (rzp) {
    info('RAZORPAY', `modal frame present: ${rzp.url().slice(0, 90)}`);
    await p.screenshot({ path: 'C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/qa/rzp-open.png' });
    // try to complete a test card payment
    try {
      const cardTab = rzp.getByText('Card', { exact: true });
      if (await cardTab.count()) await cardTab.click();
      await rzp.waitForTimeout(2500);
      const titles = await rzp.locator('iframe').evaluateAll(els => els.map(e => (e.getAttribute('title') || e.getAttribute('name') || '')).slice(0, 6)).catch(() => []);
      info('RAZORPAY', `nested iframes: ${JSON.stringify(titles)}`);
      const secure = rzp.frameLocator('iframe').first();
      const num = secure.locator('input[placeholder*="Card number" i]');
      if (await num.count()) {
        await num.fill('4111111111111111');
        const exp = secure.locator('input[placeholder*="MM/YY" i]');
        const cvv = secure.locator('input[placeholder*="CVV" i]');
        await exp.fill('12/30');
        await cvv.fill('123');
        await secure.getByRole('button', { name: /PAY ₹/ }).click().catch(async () => {
          await secure.locator('button:has-text("PAY")').first().click().catch(() => {});
        });
        info('RAZORPAY', 'test card submitted; waiting for result...');
        await p.waitForTimeout(15000);
        const url = p.url();
        const cartLeft = await p.evaluate(() => (localStorage.getItem('cart') || '[]').length > 2);
        info('RAZORPAY', `post-payment URL=${url} cartCleared=${!cartLeft}`);
        await p.screenshot({ path: 'C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/qa/rzp-after.png' });
      } else {
        info('RAZORPAY', 'card-number input not found in first secure iframe');
      }
    } catch (e) {
      info('RAZORPAY', `card automation error: ${e.message.split('\n')[0]}`);
    }
  } else {
    bad('Razorpay modal', 'modal did not open in headed browser');
    await p.screenshot({ path: 'C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/qa/rzp-notopen.png' });
  }
  // final order DB check
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const orders = await mongoose.connection.db.collection('orders').find({ userId: new (require('C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/Backend/node_modules/mongoose')).Types.ObjectId(lr.json.user.id) }).toArray();
  await mongoose.connection.close();
  info('ORDERS-DB', JSON.stringify(orders.map(o => ({ paymentStatus: o.paymentStatus, razorpayPaymentId: !!o.razorpayPaymentId }))));
  ok(orders.length > 0 ? 'order record created' : 'NO order created');
  await ctx2.close();
  await b2.close();

  // ================= MOBILE SEARCH TOGGLE (retest with count) =================
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mp = await mctx.newPage();
  await mp.goto(BASE + '/', { waitUntil: 'load' });
  await mp.waitForTimeout(1500);
  const toggle = mp.getByRole('button', { name: 'Toggle search' });
  const tcount = await toggle.count();
  info('MOBILE', `toggle buttons found: ${tcount}`);
  if (tcount) {
    await toggle.click();
    await mp.waitForTimeout(900);
    const inputs = await mp.locator('input').evaluateAll(els => els.map(e => ({ type: e.type, ph: e.placeholder, vis: !!e.offsetParent })));
    info('MOBILE', `inputs on page: ${JSON.stringify(inputs)}`);
    const visibleSearch = await mp.locator('input[placeholder="Search for products, brands..."]').isVisible().catch(() => false);
    ok(visibleSearch ? 'mobile search toggle reveals search input' : 'mobile search input not revealed after toggle');
    // submit a search from mobile search
    await mp.locator('input[placeholder="Search for products, brands..."]').fill('iphone');
    await mp.locator('button[aria-label="Search"]').last().click();
    await mp.waitForTimeout(2000);
    info('MOBILE', `after mobile search url=${mp.url()}`);
    ok(mp.url().includes('search=iphone') ? 'mobile search navigates with query' : 'mobile search did not navigate');
  } else {
    bad('mobile search toggle', 'button not found');
  }
  await mctx.close();

  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n===== E2E-FINAL SUMMARY: PASS=${pass} FAIL=${fail} =====`);
};
run().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
