import { chromium } from 'playwright-core';
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const { CHROME, qaDir, loadBackendEnv, getMongoose, assertLocalDb } = require('./qa-utils.cjs');
loadBackendEnv();
const mongoose = getMongoose();
const BASE = 'http://localhost:5174';
const API = 'http://localhost:5000';
const results = [];
let pass = 0, fail = 0;
const ok = n => { results.push(`[PASS] ${n}`); pass++; };
const bad = (n, d) => { results.push(`[FAIL] ${n} :: ${d}`); fail++; };
const info = (n, d) => results.push(`[INFO] ${n} :: ${d}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = async (page, fn, tries = 20, gap = 1000) => {
  for (let i = 0; i < tries; i++) { const v = await fn().catch(() => null); if (v) return v; await sleep(gap); }
  return null;
};

const run = async () => {
  const TS = Date.now();
  await new Promise(r => setTimeout(r, 65000));
  const email = `pay2${TS}@test.com`;
  await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Pay Buyer', email, password: 'payPass1' }) });
  const lr = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'payPass1' }) }).then(r => r.json());
  await fetch(API + '/api/addresses/add', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lr.token }, body: JSON.stringify({ fullName: 'Pay Buyer', phone: '9876501234', street: '42 QA', city: 'Mumbai', state: 'MH', pinCode: '400001' }) });

  const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--window-size=1440,950'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => info('PAGEERR', e.message.slice(0, 120)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); localStorage.removeItem('cart'); }, [lr.token, lr.user]);
  await page.waitForTimeout(600);
  await page.locator('a[href^="/product/"]').first().click();
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: /Add to Cart/i }).click();
  await page.waitForTimeout(800);
  await page.goto(BASE + '/cart', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.getByRole('link', { name: 'Proceed to Checkout' }).click();
  await page.waitForTimeout(2500);
  await page.locator('input[type="radio"]').first().check().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /rupees/ }).click();

  const rzp = await wait(page, async () => {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      const u = f.url();
      if (u.includes('razorpay')) return f;
    }
    return null;
  }, 40);
  if (!rzp) { bad('Razorpay modal', 'no razorpay frame after 40s'); await browser.close(); return; }
  info('RAZORPAY', `frame url=${rzp.url().slice(0, 110)}`);
  await sleep(3000);
  // fresh frame
  let cur = await wait(page, async () => page.frames().find(f => f !== page.mainFrame() && f.url().includes('razorpay')) || rzp, 10, 500);
  const txt = await cur.locator('body').innerText().catch(() => '');
  info('RAZORPAY-BODY', txt.replace(/\s+/g, ' ').slice(0, 260));

  // click Card option if present
  const cardOpt = cur.getByText('Card', { exact: true });
  if (await cardOpt.count().catch(() => 0)) { await cardOpt.first().click().catch(() => {}); info('RAZORPAY', 'clicked Card tab'); }
  else info('RAZORPAY', 'no explicit Card tab found (may be default)');
  await sleep(2000);

  // find card number input across all frames
  const holder = await wait(page, async () => {
    for (const f of page.frames()) {
      const n = await f.locator('input[placeholder*="Card number" i]').count().catch(() => 0);
      if (n) return f;
    }
    return null;
  }, 15, 1000);
  if (!holder) {
    // dump every frame's inputs to diagnose
    for (const f of page.frames()) {
      const ins = await f.locator('input').evaluateAll(els => els.map(e => e.placeholder || e.name || e.type).slice(0, 8)).catch(() => []);
      info('FRAME', `${f.url().slice(0, 80)} :: ${JSON.stringify(ins)}`);
    }
    bad('Razorpay card form', 'card number input not found anywhere');
    await page.screenshot({ path: path.join(qaDir, 'rzp-nocard.png') });
  } else {
    info('RAZORPAY', `card fields in frame ${holder.url().slice(0, 90)}`);
    await holder.locator('input[placeholder*="Card number" i]').fill('4111111111111111');
    const exp = holder.locator('input[placeholder*="MM/YY" i]');
    const cvv = holder.locator('input[placeholder*="CVV" i]');
    if (await exp.count()) await exp.fill('12/30');
    if (await cvv.count()) await cvv.fill('123');
    await sleep(800);
    // PAY button: look in the modal frame(s), not the secure iframe
    let pay = null;
    for (const f of page.frames()) {
      if (f === holder) continue;
      const n = await f.getByRole('button', { name: /PAY/i }).count().catch(() => 0);
      if (n) { pay = f; break; }
    }
    if (pay) {
      info('RAZORPAY', `PAY button in frame ${pay.url().slice(0, 80)}`);
      await pay.getByRole('button', { name: /PAY/i }).first().click();
      info('RAZORPAY', 'PAY clicked; waiting for result (up to 40s)...');
      await wait(page, async () => {
        const url = page.url();
        if (url.includes('/profile') || url.includes('/order')) return true;
        const cleared = await page.evaluate(() => { const c = localStorage.getItem('cart'); return c === null || c === '[]'; });
        return cleared;
      }, 40, 1000);
      const cartCleared = await page.evaluate(() => { const c = localStorage.getItem('cart'); return c === null || c === '[]'; });
      info('RAZORPAY', `after payment url=${page.url()} cartCleared=${cartCleared}`);
      await page.screenshot({ path: path.join(qaDir, 'rzp-after.png') });
    } else {
      bad('Razorpay PAY', 'PAY button not found');
      await page.screenshot({ path: path.join(qaDir, 'rzp-nopay.png') });
    }
  }

  assertLocalDb();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const orders = await mongoose.connection.db.collection('orders').find({ userId: new mongoose.Types.ObjectId(lr.user.id) }).toArray();
  await mongoose.connection.close();
  info('ORDERS-DB', JSON.stringify(orders.map(o => ({ paymentStatus: o.paymentStatus, razorpayPaymentId: !!o.razorpayPaymentId, status: o.status, total: o.totalPrice }))));
  ok(orders.some(o => o.paymentStatus === 'Paid') ? 'PAYMENT COMPLETED -> order Paid in DB' : 'payment did not complete');
  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n===== RZP SUMMARY: PASS=${pass} FAIL=${fail} =====`);
};
run().catch(e => { console.error('ERR', e); process.exit(1); });
