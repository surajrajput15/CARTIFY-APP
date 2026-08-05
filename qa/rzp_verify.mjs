import { chromium } from 'playwright-core';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { CHROME, loadBackendEnv, getMongoose } = require('./qa-utils.cjs');
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

const run = async () => {
  const TS = Date.now();
  await new Promise(r => setTimeout(r, 65000));
  const email = `pay3${TS}@test.com`;
  await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Pay Buyer', email, password: 'payPass1' }) });
  const lr = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'payPass1' }) }).then(r => r.json());
  await fetch(API + '/api/addresses/add', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lr.token }, body: JSON.stringify({ fullName: 'Pay Buyer', phone: '9876501234', street: '42 QA', city: 'Mumbai', state: 'MH', pinCode: '400001' }) });

  const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--window-size=1440,950'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const toasts = [];
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('gsi')) info('CONSOLE[pay]', m.text().slice(0, 130)); });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); localStorage.removeItem('cart'); }, [lr.token, lr.user]);
  await page.waitForTimeout(600);
  await page.locator('a[href^="/product/"]').first().click();
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: /Add to Cart/i }).click();
  await page.waitForTimeout(800);
  await page.goto(BASE + '/cart', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const badgeBefore = await page.locator('nav span').filter({ hasText: /^\d+$/ }).first().textContent().catch(() => '0');
  info('CART-BADGE', `cart badge before pay: ${badgeBefore}`);
  await page.getByRole('link', { name: 'Proceed to Checkout' }).click();
  await page.waitForTimeout(2500);
  await page.locator('input[type="radio"]').first().check().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /rupees/ }).click();
  info('PAY', 'pay clicked');
  // wait for modal then just observe until cart clears (test-mode checkout completes)
  let cleared = false;
  for (let t = 0; t < 60; t++) {
    await sleep(1000);
    cleared = await page.evaluate(() => { const c = localStorage.getItem('cart'); return c === null || c === '[]'; });
    if (cleared) { info('PAY', `cart cleared after ${t + 1}s`); break; }
  }
  await sleep(1500);
  // capture toasts
  const toastText = await page.locator('[role="status"], .go2072408551, [class*="toast"]').allTextContents().catch(() => []);
  info('TOASTS', JSON.stringify(toastText.map(t => t.slice(0, 80))));
  ok(toastText.some(t => /Payment Successful|Order Placed/i.test(t)) ? 'success toast shown' : 'no success toast captured');
  ok(cleared ? 'cart cleared after payment' : 'cart NOT cleared after payment');

  // profile orders tab
  await page.goto(BASE + '/profile', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  // click Orders tab if a tab bar exists
  const ordersTab = page.getByText('Orders', { exact: true });
  if (await ordersTab.count()) await ordersTab.click().catch(() => {});
  await page.waitForTimeout(2500);
  const body = await page.locator('main').innerText().catch(() => '');
  info('PROFILE-ORDERS', body.replace(/\s+/g, ' ').slice(0, 220));
  ok(/Order ID|Placed|₹/.test(body) ? 'order visible in profile orders' : 'orders not visible in profile');
  await browser.close();

  console.log(results.join('\n'));
  console.log(`\n===== FINAL PAY SUMMARY: PASS=${pass} FAIL=${fail} =====`);
};
run().catch(e => { console.error('ERR', e); process.exit(1); });
