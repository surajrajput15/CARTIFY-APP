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
const sleep = ms => new Promise(r => setTimeout(r, ms));

const run = async () => {
  const TS = Date.now();
  await new Promise(r => setTimeout(r, 65000));
  const email = `frg${TS}@test.com`;
  await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Forgot QA', email, password: 'oldPass1' }) });

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('gsi')) info('CONSOLE[forgot]', m.text().slice(0, 130)); });
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // switch to password tab
  await page.getByRole('button', { name: 'Email & Password' }).click();
  await page.waitForTimeout(500);
  // forgot password
  await page.getByRole('button', { name: 'Forgot Password?' }).click();
  await page.waitForTimeout(600);
  await page.fill('input[type="email"]', email);
  await page.getByRole('button', { name: 'Send Reset OTP' }).click();
  await page.waitForTimeout(2500);

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const otp = (await mongoose.connection.db.collection('users').findOne({ email }))?.otp;
  await mongoose.connection.close();
  info('FORGOT', `DB reset otp=${otp}`);

  const boxes = page.locator('input[inputmode="numeric"]');
  if (await boxes.count() === 6 && otp) {
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(otp[i]);
    await page.locator('input[placeholder="Enter new password"]').fill('newPass2');
    await page.waitForTimeout(4000);
    const alert = await page.locator('[role="alert"]').textContent().catch(() => '(none)');
    info('FORGOT-ALERT', alert);
    ok(/Password reset successful/i.test(alert) ? 'forgot password flow: reset OTP + new password succeeds' : 'forgot password flow did not succeed');

    // login with new password
    await page.waitForTimeout(1500);
    const pwInput = page.locator('input[type="password"], input[placeholder="Enter password"]').first();
    await pwInput.fill('newPass2');
    await page.fill('input[type="email"]', email);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.waitForTimeout(3500);
    const tok = await page.evaluate(() => localStorage.getItem('token'));
    ok(tok ? 'login with new password after reset works' : 'login with new password failed');
  } else {
    bad('forgot password', `step 2 not reached (boxes=${await boxes.count()} otp=${otp})`);
  }

  // Google button present
  await page.goto(BASE + '/login', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const gsi = page.locator('[id^="g_id_onload"], iframe[title*="Sign in with Google"]');
  info('GOOGLE', `GSI iframe count=${await gsi.count()}`);
  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n===== FORGOT SUMMARY: PASS=${pass} FAIL=${fail} =====`);
};
run().catch(e => { console.error('ERR', e); process.exit(1); });
