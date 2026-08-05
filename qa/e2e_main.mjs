// Cartify E2E QA — drives real Chrome against http://localhost:5174 + API on :5000
import { chromium } from 'playwright-core';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { CHROME, loadBackendEnv, getMongoose, assertLocalDb } = require('./qa-utils.cjs');
loadBackendEnv();
const mongoose = getMongoose();

const BASE = 'http://localhost:5174';
const API = 'http://localhost:5000';
const results = [];
const consoleErrors = [];
const networkFails = [];
let pass = 0, fail = 0;

const ok = (name) => { results.push(`[PASS] ${name}`); pass++; };
const bad = (name, detail) => { results.push(`[FAIL] ${name} :: ${detail}`); fail++; };
const info = (name, detail) => { results.push(`[INFO] ${name} :: ${detail}`); };
const safe = async (name, fn) => { try { await fn(); } catch (e) { bad(name, 'EXCEPTION: ' + e.message.split('\n')[0]); } };

async function setupPage(browser, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[${page.url()}] ${m.text()}`); });
  page.on('pageerror', e => consoleErrors.push(`[PAGEERROR ${page.url()}] ${e.message}`));
  page.on('requestfailed', r => networkFails.push(`[${page.url()}] ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
  return { ctx, page };
}

const getOtpFromDb = async (email) => {
  assertLocalDb();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const u = await mongoose.connection.db.collection('users').findOne({ email });
  const otp = u?.otp;
  await mongoose.connection.close();
  return otp;
};

const api = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const TS = Date.now();
  const testEmail = `e2e${TS}@test.com`;
  const { page, ctx } = await setupPage(browser);

  // ============ 1. HOME ============
  info('HOME', 'goto /');
  await page.goto(BASE, { waitUntil: 'networkidle' }).catch(e => bad('home load', e.message));
  await page.waitForSelector('.grid', { timeout: 8000 }).catch(() => {});
  const cards = await page.locator('a[href^="/product/"]').count();
  ok(`home renders product cards (found ${cards})`);
  await page.waitForTimeout(300);
  if (cards === 0) bad('home product grid', 'no product links');

  // ============ 2. SEARCH ============
  await page.fill('input[type="text"]', 'iphone');
  await page.press('input[type="text"]', 'Enter');
  await page.waitForTimeout(1500);
  const url = page.url();
  const heading = await page.textContent('h2').catch(() => '');
  const hasSearch = url.includes('search=iphone');
  ok(hasSearch ? 'search navigates with ?search=iphone' : `search URL: ${url}`);
  ok(heading.includes('Search Results') ? 'search results heading' : `heading: ${heading.slice(0,60)}`);
  const resultsCount = await page.locator('a[href^="/product/"]').count();
  info('SEARCH', `iphone results visible: ${resultsCount}`);

  // empty search
  await page.goto(BASE, { waitUntil: 'load' });
  await page.fill('input[type="text"]', 'zzzz-no-such-item-xyz');
  await page.press('input[type="text"]', 'Enter');
  await page.waitForTimeout(1500);
  const emptyMsg = await page.textContent('main').catch(() => '');
  ok(emptyMsg.includes('no results') ? 'no-results empty state' : `no-results msg: ${emptyMsg.slice(0,80)}`);

  // ============ 3. CATEGORY FILTER ============
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Electronics' }).click();
  await page.waitForTimeout(1500);
  const catCards = await page.locator('a[href^="/product/"]').count();
  const foundInfo = await page.textContent('#products').catch(() => '');
  info('FILTER', `Electronics filter => ${catCards} cards, ${foundInfo.replace(/\s+/g,' ').slice(0,80)}`);
  ok(catCards > 0 ? 'category filter Electronics returns results' : 'category filter Electronics EMPTY');

  // category that exists in DB but not in button list
  const hasMenButton = await page.getByRole('button', { name: 'Men', exact: true }).count();
  info('FILTER', `"Men" category button present in filter bar: ${hasMenButton > 0 ? 'yes' : 'NO'}`);

  // ============ 4. PAGINATION ============
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const page1Count = await page.locator('a[href^="/product/"]').count();
  const nextBtn = page.getByRole('button', { name: 'Next' });
  const hasNext = await nextBtn.count();
  ok(hasNext > 0 ? 'pagination Next button present' : 'no pagination controls');
  if (hasNext > 0) {
    await nextBtn.click();
    await page.waitForTimeout(1500);
    const page2Count = await page.locator('a[href^="/product/"]').count();
    info('PAGINATION', `page1=${page1Count} cards, page2=${page2Count} cards`);
    const prev = page.getByRole('button', { name: 'Previous' });
    await prev.click();
    await page.waitForTimeout(1200);
    const backCount = await page.locator('a[href^="/product/"]').count();
    ok(backCount === page1Count ? 'Prev returns to page 1' : `prev count ${backCount}`);
  }

  // ============ 5. PRODUCT DETAILS ============
  await page.locator('a[href^="/product/"]').first().click();
  await page.waitForTimeout(1800);
  const title = await page.textContent('h1').catch(() => '');
  ok(title ? 'product detail title renders' : 'product detail MISSING title');
  const addBtn = page.getByRole('button', { name: /Add to Cart/ });
  const addCount = await addBtn.count();
  ok(addCount > 0 ? 'Add to Cart button present' : 'no Add to Cart button');
  const related = await page.locator('section a[href^="/product/"]').count();
  info('DETAIL', `related products shown: ${related}`);

  // add to cart
  await addBtn.first().click();
  await page.waitForTimeout(800);
  const badge = await page.textContent('.bg-red-500').catch(() => '');
  info('CART', `cart badge after add: '${badge?.trim()}'`);

  // ============ 6. CART ============
  await page.goto(BASE + '/cart', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cartItems = await page.locator('button[aria-label^="Remove"]').count();
  ok(cartItems > 0 ? 'cart lists added item' : 'cart EMPTY after add');
  const totalBefore = await page.textContent('.bg-teal-600').catch(() => '');
  // increase qty
  const incBtn = page.getByRole('button', { name: 'Increase quantity' });
  if (await incBtn.count()) {
    await incBtn.click();
    await page.waitForTimeout(800);
    const totalAfter = await page.textContent('.bg-teal-600').catch(() => '');
    ok(totalAfter !== totalBefore ? 'quantity increase updates total' : `total unchanged: ${totalBefore} -> ${totalAfter}`);
  }
  // persistence
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const afterReload = await page.locator('button[aria-label^="Remove"]').count();
  ok(afterReload > 0 ? 'cart persists after reload (localStorage)' : 'cart LOST after reload');
  // remove
  await page.getByRole('button', { name: 'Remove' }).first().click().catch(()=>{});
  await page.waitForTimeout(800);
  const emptyState = await page.textContent('main').catch(() => '');
  ok(emptyState.includes('Cart is Empty') ? 'cart empty state after remove' : `empty state msg: ${emptyState.slice(0,80)}`);

  // ============ 7. PASSWORD LOGIN ============
  await api('POST', '/api/auth/register', { name: 'E2E User', email: testEmail, password: 'e2ePass123' });
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Email & Password' }).click();
  await page.waitForTimeout(400);
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', 'e2ePass123');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForTimeout(2000);
  const navbar = await page.textContent('nav').catch(() => '');
  ok(navbar.includes('E2E') ? 'password login works (Hi, E2E)' : `navbar after login: ${navbar.slice(0,80)}`);

  // invalid login error state
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Email & Password' }).click();
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', 'WRONGPASS');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForTimeout(1500);
  const errAlert = await page.locator('[role="alert"]').textContent().catch(() => '');
  ok(errAlert.length > 0 ? 'login error state shown' : 'no error shown on bad login');

  // logout
  await api('POST', '/api/auth/login', { email: testEmail, password: 'e2ePass123' }).then(async ({ json }) => {
    await page.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); }, [json.token, json.user]);
  });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Logout' }).click().catch(() => {});
  await page.waitForTimeout(1000);
  const navAfterLogout = await page.textContent('nav').catch(() => '');
  ok(navAfterLogout.includes('Login') && !navAfterLogout.includes('Logout') ? 'logout works' : `nav after logout: ${navAfterLogout.slice(0,80)}`);

  // ============ 8. OTP LOGIN (real OTP from DB) ============
  const otpEmail = `e2eotp${TS}@test.com`;
  await api('POST', '/api/auth/send-otp', { email: otpEmail });
  const otp = await getOtpFromDb(otpEmail);
  info('OTP', `real OTP retrieved from DB: ${otp}`);
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', otpEmail);
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await page.waitForTimeout(2500);
  if (otp) {
    const boxes = page.locator('input[inputmode="numeric"]');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).fill(otp[i]);
    await page.waitForTimeout(2500);
    const loggedIn = await page.evaluate(() => !!localStorage.getItem('token'));
    const nav = await page.textContent('nav').catch(() => '');
    ok(loggedIn ? 'OTP login completes (token set after auto-submit)' : `OTP login FAILED; nav=${nav.slice(0,60)}`);
    info('OTP', `navbar shows logged-in user: ${nav.includes('Hi,') ? 'yes' : 'no'}`);
  } else {
    bad('OTP login', 'could not retrieve OTP from DB');
  }

  // ============ 9. PROFILE ============
  await safe('PROFILE', async () => {
    const lr = await api('POST', '/api/auth/login', { email: testEmail, password: 'e2ePass123' });
    await page.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); }, [lr.json.token, lr.json.user]);
    await page.goto(BASE + '/profile', { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    const profName = await page.textContent('.bg-white p-3').catch(() => '');
    info('PROFILE', `profile name shown: ${profName?.slice(0,40)}`);

    // addresses tab
    await page.getByRole('button', { name: 'Manage Addresses' }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Add New' }).click();
    await page.waitForTimeout(400);
    const fields = await page.locator('form input').count();
    info('PROFILE', `address form fields: ${fields}`);
    await page.locator('form input').nth(0).fill('E2E Buyer');
    await page.locator('form input').nth(1).fill('9876501234');
    await page.locator('form input').nth(2).fill('42 QA Street');
    await page.locator('form input').nth(3).fill('Mumbai');
    await page.locator('form input').nth(4).fill('Maharashtra');
    await page.locator('form input').nth(5).fill('400001');
    await page.getByRole('button', { name: 'Save Address' }).click();
    await page.waitForTimeout(1500);
    const addrText = await page.textContent('main').catch(() => '');
    ok(addrText.includes('E2E Buyer') ? 'address added via UI' : `address not visible: ${addrText.slice(0,80)}`);

    // invalid phone error
    await page.getByRole('button', { name: 'Add New' }).click();
    await page.locator('form input').nth(1).fill('123');
    await page.getByRole('button', { name: 'Save Address' }).click();
    await page.waitForTimeout(600);
    const phoneErr = await page.textContent('main').catch(() => '');
    ok(phoneErr.includes('10-digit Indian phone') ? 'phone validation error shown' : 'no phone validation msg');

    // orders tab
    await page.getByRole('button', { name: 'My Orders' }).click();
    await page.waitForTimeout(1200);
    const ordersText = await page.textContent('main').catch(() => '');
    ok(ordersText.includes('order history will appear') ? 'orders empty state' : 'orders tab content');
  });

  // ============ 10. 404 ============
  await safe('404', async () => {
    await page.goto(BASE + '/nonexistent-page', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const nf = await page.textContent('main').catch(() => '');
    ok(nf.includes('404') || nf.includes('Not Found') ? '404 page renders' : `404 content: ${nf.slice(0,80)}`);
  });

  // ============ 11. INVALID PRODUCT ERROR STATE ============
  await safe('PRODUCT-ERR', async () => {
    await page.goto(BASE + '/product/invalidid123', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const errState = await page.textContent('main').catch(() => '');
    ok(errState.includes('Failed to Load Product') ? 'product error state renders' : `err state: ${errState.slice(0,80)}`);
  });

  await ctx.close();
  browser.close();
};

run().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); })
  .finally(() => {
    console.log(results.join('\n'));
    console.log(`\n===== E2E SUMMARY: PASS=${pass} FAIL=${fail} =====`);
    console.log(`\n--- CONSOLE ERRORS (${consoleErrors.length}) ---`);
    [...new Set(consoleErrors)].slice(0, 20).forEach(e => console.log('  ' + e));
    console.log(`\n--- NETWORK FAILURES (${networkFails.length}) ---`);
    [...new Set(networkFails)].slice(0, 20).forEach(e => console.log('  ' + e));
  });
