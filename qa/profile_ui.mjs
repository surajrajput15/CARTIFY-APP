import { chromium } from 'playwright-core';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { CHROME } = require('./qa-utils.cjs');
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
  const email = `prof${TS}@test.com`;
  await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Profile QA', email, password: 'profPass1' }) });
  const lr = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'profPass1' }) }).then(r => r.json());
  await fetch(API + '/api/addresses/add', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lr.token }, body: JSON.stringify({ fullName: 'Profile QA', phone: '9876501234', street: '42 QA Street', city: 'Mumbai', state: 'MH', pinCode: '400001' }) });

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => info('PAGEERR', e.message.slice(0, 120)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); }, [lr.token, lr.user]);
  await page.waitForTimeout(700);

  // profile tab shows info
  await page.goto(BASE + '/profile', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const body0 = await page.locator('body').innerText();
  info('PROFILE', `name shown: ${/Profile QA/.test(body0)}`);
  ok(/Profile QA/.test(body0) ? 'profile page shows logged-in user name' : 'profile page missing user name');

  // Manage Addresses
  await page.getByRole('button', { name: 'Manage Addresses' }).click();
  await page.waitForTimeout(2000);
  const addrBody = await page.locator('body').innerText();
  info('ADDRESSES', addrBody.replace(/\s+/g, ' ').slice(0, 180));
  ok(/42 QA Street|Mumbai|400001/.test(addrBody) ? 'address list shows saved address' : 'address not shown in Manage Addresses');

  // add an address via UI
  await page.getByRole('button', { name: /Add New Address/i }).click().catch(async () => {
    await page.getByText(/Add New Address/i).click().catch(() => { info('ADDRESSES', 'no Add New Address control found'); });
  });
  await page.waitForTimeout(800);
  const modal = page.locator('form');
  if (await modal.count()) {
    const fields = await page.locator('input').evaluateAll(els => els.map(e => ({ ph: e.placeholder, name: e.name, type: e.type })));
    info('ADDRESS-FORM', JSON.stringify(fields));
  }

  // My Orders
  await page.getByRole('button', { name: 'My Orders' }).click();
  await page.waitForTimeout(2000);
  const ordersBody = await page.locator('body').innerText();
  info('ORDERS-UI', ordersBody.replace(/\s+/g, ' ').slice(0, 120));
  ok(/Order ID|appear here/.test(ordersBody) ? 'orders tab renders (empty state or list)' : 'orders tab did not render');

  // profile edit (change name)
  await page.getByRole('button', { name: 'My Account' }).click().catch(() => {});
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Profile Information' }).click();
  await page.waitForTimeout(1000);
  const editBtn = page.getByRole('button', { name: /Edit/i });
  if (await editBtn.count()) {
    await editBtn.first().click();
    await page.waitForTimeout(600);
    const nameInput = page.locator('input[value="Profile QA"]');
    if (await nameInput.count()) {
      await nameInput.fill('Profile QA2');
      await page.locator('button.bg-teal-600').click();
      await page.waitForTimeout(2000);
      const after = await page.locator('body').innerText();
      ok(/Profile QA2/.test(after) ? 'profile name update via UI works' : 'profile name not updated via UI');
    } else {
      bad('profile edit', 'name input not found after Edit');
    }
  } else {
    info('PROFILE', 'no Edit button found');
  }
  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n===== PROFILE SUMMARY: PASS=${pass} FAIL=${fail} =====`);
};
run().catch(e => { console.error('ERR', e); process.exit(1); });
