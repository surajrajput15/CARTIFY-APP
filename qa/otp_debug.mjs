import { chromium } from 'playwright-core';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { CHROME, loadBackendEnv, getMongoose, assertLocalDb } = require('./qa-utils.cjs');
loadBackendEnv();
const mongoose = getMongoose();

const BASE = 'http://localhost:5174';
const API = 'http://localhost:5000';

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const TS = Date.now();
  const email = `otpdbg${TS}@test.com`;
  await fetch(API + '/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  await new Promise(r => setTimeout(r, 2000));
  assertLocalDb();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const u = await mongoose.connection.db.collection('users').findOne({ email });
  await mongoose.connection.close();
  console.log('DB user:', JSON.stringify(u ? { name: u.name, email: u.email, otp: u.otp } : null));

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const seen = [];
  page.on('request', r => {
    if (r.url().includes('/api/auth') && r.method() === 'POST') {
      seen.push(`REQ ${r.url().replace(BASE, '').replace('http://localhost:5000', '[API]')} BODY=${r.postData()}`);
    }
  });
  page.on('response', async r => {
    if (r.url().includes('/api/auth')) {
      let body = '';
      try { body = (await r.text()).slice(0, 300); } catch {}
      seen.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '').replace('http://localhost:5000', '[API]')} ${body}`);
    }
  });
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 200)); });
  page.on('pageerror', e => console.log('PAGE-ERR:', e.message.slice(0, 200)));

  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', email);
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await page.waitForTimeout(2500);
  const boxes = page.locator('input[inputmode="numeric"]');
  console.log('box count:', await boxes.count());
  if (u?.otp) {
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(u.otp[i]);
  }
  await page.waitForTimeout(5000);
  const tok = await page.evaluate(() => localStorage.getItem('token'));
  console.log('token after auto-submit:', tok);
  console.log('URL:', page.url());
  console.log('alert role text:', await page.locator('[role="alert"]').textContent().catch(() => '(none)'));
  console.log('--- API calls seen ---');
  seen.forEach(s => console.log(' ', s));
  await browser.close();
};
run().catch(e => { console.error('ERR', e); process.exit(1); });
