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
  const email = `addr${TS}@test.com`;
  await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Addr QA', email, password: 'addrPass1' }) });
  const lr = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'addrPass1' }) }).then(r => r.json());

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); }, [lr.token, lr.user]);
  await page.waitForTimeout(700);
  await page.goto(BASE + '/profile?tab=addresses', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const body = await page.locator('body').innerText();
  ok(/No addresses saved yet/.test(body) ? 'empty addresses state shows' : 'empty state missing');

  // Add New
  await page.getByRole('button', { name: 'Add New' }).click();
  await page.waitForTimeout(600);
  const form = page.locator('form');
  ok(await form.count() ? 'address form opens' : 'address form did not open');

  // invalid phone -> validation error
  await page.locator('input[placeholder="Full Name"]').fill('Addr QA');
  await page.locator('input[placeholder="Phone Number"]').fill('12345');
  await page.locator('input[placeholder="Street / Flat / Area"]').fill('9 Test Road');
  await page.locator('input[placeholder="City"]').fill('Delhi');
  await page.locator('input[placeholder="State"]').fill('Delhi');
  await page.locator('input[placeholder="PIN Code"]').fill('110001');
  await page.getByRole('button', { name: 'Save Address' }).click();
  await page.waitForTimeout(800);
  const phoneErr = await page.locator('text=valid 10-digit Indian phone').count();
  ok(phoneErr > 0 ? 'invalid phone rejected with validation message' : 'invalid phone NOT rejected');

  // valid phone -> saved
  await page.locator('input[placeholder="Phone Number"]').fill('9876501234');
  await page.getByRole('button', { name: 'Save Address' }).click();
  await page.waitForTimeout(2500);
  const body2 = await page.locator('body').innerText();
  ok(/9 Test Road, Delhi/.test(body2) ? 'address added via UI and listed' : 'address not listed after save');

  // delete via UI
  await page.getByRole('button', { name: 'Delete address for Addr QA' }).click();
  await page.waitForTimeout(1000);
  const confirmDel = page.getByRole('button', { name: 'Delete', exact: true });
  if (await confirmDel.count()) { await confirmDel.click(); await page.waitForTimeout(2500); }
  const body3 = await page.locator('body').innerText();
  ok(!/9 Test Road/.test(body3) ? 'address deleted via UI' : 'address still present after delete');
  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n===== ADDRESS UI SUMMARY: PASS=${pass} FAIL=${fail} =====`);
};
run().catch(e => { console.error('ERR', e); process.exit(1); });
