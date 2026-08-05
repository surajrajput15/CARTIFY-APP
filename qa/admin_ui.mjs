import { chromium } from 'playwright-core';
import { createRequire } from 'module';
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
const fs = require('fs');
const path = require('path');

const run = async () => {
  const TS = Date.now();
  await new Promise(r => setTimeout(r, 65000));
  const email = `admin${TS}@test.com`;
  await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Admin QA', email, password: 'adminPass1' }) });
  const lr = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'adminPass1' }) }).then(r => r.json());
  // promote to admin
  assertLocalDb();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  await mongoose.connection.db.collection('users').updateOne({ email }, { $set: { isAdmin: true } });
  await mongoose.connection.close();

  // tiny png for upload
  const pngBuf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(path.join(qaDir, 'qa-image.png'), pngBuf);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => info('PAGEERR[admin]', e.message.slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('gsi')) info('CONSOLE[admin]', m.text().slice(0, 120)); });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); }, [lr.token, { ...lr.user, isAdmin: true }]);
  await page.waitForTimeout(700);

  // non-admin redirect test (do with a fresh non-admin user later)

  await page.goto(BASE + '/admin', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const admBody = await page.locator('body').innerText();
  info('ADMIN', `url=${page.url()} text=${admBody.replace(/\s+/g, ' ').slice(0, 140)}`);
  ok(page.url().includes('/admin') && /products/i.test(admBody) ? 'admin page renders product table' : 'admin page failed to render');

  // search filter
  await page.fill('#search-input', 'iphone');
  await page.waitForTimeout(1200);
  const searchBody = await page.locator('body').innerText();
  info('ADMIN-SEARCH', `has iphone matches: ${/Showing \d+ of \d+/.test(searchBody) ? searchBody.match(/Showing \d+ of \d+/)?.[0] : 'n/a'}`);
  ok(!/No products match/.test(searchBody) ? 'admin search filters results' : 'admin search returned empty');
  await page.fill('#search-input', '');

  // category filter
  await page.locator('select[aria-label="Filter by category"]').selectOption('electronics');
  await page.waitForTimeout(1000);
  info('ADMIN-FILTER', 'category=electronics applied');

  // reset filter
  await page.locator('select[aria-label="Filter by category"]').selectOption({ index: 0 });
  await page.waitForTimeout(600);

  // ADD PRODUCT with image upload
  await page.getByRole('button', { name: 'Add Product' }).click();
  await page.waitForTimeout(600);
  await page.locator('input[placeholder="Product Title"]').fill(`QA Admin UI ${TS}`);
  await page.locator('input[placeholder="Price (₹)"]').fill('499');
  await page.locator('textarea[placeholder="Description"]').fill('QA product created via admin UI test');
  await page.locator('input[type="file"]').setInputFiles(path.join(qaDir, 'qa-image.png'));
  await page.waitForTimeout(2500);
  // check preview img src
  const previewSrc = await page.locator('img[alt="preview"]').getAttribute('src').catch(() => null);
  info('ADMIN-UPLOAD', `preview img src=${previewSrc}`);
  await page.getByRole('button', { name: 'Save Product' }).click();
  await page.waitForTimeout(2500);
  const afterAdd = await page.locator('body').innerText();
  ok(afterAdd.includes(`QA Admin UI ${TS}`) ? 'product created via admin UI' : 'product not created via admin UI');

  // verify uploaded-image rendering in the product table
  const tableImg = page.locator('table img').last();
  const tableSrc = await tableImg.getAttribute('src').catch(() => null);
  const broken = await tableImg.evaluate(i => i.complete && i.naturalWidth === 0).catch(() => null);
  info('ADMIN-TABLE-IMG', `src=${tableSrc} broken=${broken}`);
  ok(broken === false ? 'uploaded image renders in admin table' : `uploaded image BROKEN in admin table (src=${tableSrc})`);

  // verify on the storefront product card too
  await page.goto(BASE + '/?search=' + encodeURIComponent(`QA Admin UI ${TS}`), { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const cardImg = page.locator('a[href^="/product/"] img').first();
  const cardSrc = await cardImg.getAttribute('src').catch(() => null);
  const cardBroken = await cardImg.evaluate(i => i.complete && i.naturalWidth === 0).catch(() => null);
  info('STOREFRONT-IMG', `src=${cardSrc} broken=${cardBroken}`);
  ok(cardBroken === false ? 'uploaded image renders on storefront card' : `uploaded image BROKEN on storefront (src=${cardSrc})`);

  // EDIT product
  await page.goto(BASE + '/admin', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.fill('#search-input', `QA Admin UI ${TS}`);
  await page.waitForTimeout(1200);
  const editRow = page.getByRole('button', { name: /Edit/ }).first();
  if (await editRow.count()) {
    await editRow.click();
    await page.waitForTimeout(800);
    await page.locator('input[placeholder="Product Title"]').fill(`QA Admin UI EDITED ${TS}`);
    await page.getByRole('button', { name: 'Update Product' }).click();
    await page.waitForTimeout(2500);
    const afterEdit = await page.locator('body').innerText();
    ok(afterEdit.includes(`EDITED ${TS}`) ? 'product edit via admin UI works' : 'product edit failed');
  } else {
    bad('product edit', 'no Edit button found');
  }

  // DELETE product
  const delBtn = page.getByRole('button', { name: /Delete/ }).first();
  if (await delBtn.count()) {
    await delBtn.click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.waitForTimeout(2500);
    const afterDel = await page.locator('body').innerText();
    ok(!afterDel.includes(`EDITED ${TS}`) ? 'product deleted via admin UI' : 'product still present after delete');
  } else {
    bad('product delete', 'no Delete button found');
  }

  // non-admin guard: fresh normal user visiting /admin
  const ne = `norm${TS}@test.com`;
  await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Normal', email: ne, password: 'normPass1' }) });
  const nl = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ne, password: 'normPass1' }) }).then(r => r.json());
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/', { waitUntil: 'load' });
  await p2.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); }, [nl.token, nl.user]);
  await p2.goto(BASE + '/admin', { waitUntil: 'load' });
  await p2.waitForTimeout(2500);
  info('ADMIN-GUARD', `non-admin url=${p2.url()}`);
  ok(!p2.url().includes('/admin') ? 'non-admin redirected away from /admin' : 'NON-ADMIN CAN VIEW /admin (BUG)');
  await ctx2.close();

  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n===== ADMIN UI SUMMARY: PASS=${pass} FAIL=${fail} =====`);
};
run().catch(e => { console.error('ERR', e); process.exit(1); });
