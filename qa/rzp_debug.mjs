import { chromium } from 'playwright-core';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mongoose = require('C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/Backend/node_modules/mongoose');
const dotenv = require('C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/Backend/node_modules/dotenv');
dotenv.config({ path: 'C:/Users/Suraj Kumar/Desktop/June/HOME PROJECTS/CARTIFY-APP/Backend/.env' });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5174';
const API = 'http://localhost:5000';

const run = async () => {
  const TS = Date.now();
  await new Promise(r => setTimeout(r, 65000));
  const email = `rzp${TS}@test.com`;
  await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'RZ Buyer', email, password: 'rzpPass1' }) });
  const lr = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'rzpPass1' }) }).then(r => r.json());
  await fetch(API + '/api/addresses/add', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lr.token }, body: JSON.stringify({ fullName: 'RZ Buyer', phone: '9876501234', street: '42 QA', city: 'Mumbai', state: 'MH', pinCode: '400001' }) });

  const browser = await chromium.launch({ executablePath: CHROME, headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const msgs = [];
  const net = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`[${m.type()}] ${m.text().slice(0, 180)}`); });
  page.on('pageerror', e => msgs.push(`[PAGEERR] ${e.message.slice(0, 200)}`));
  page.on('response', r => { if (r.url().includes('razorpay')) net.push(`${r.status()} ${r.url().slice(0, 90)}`); });
  page.on('requestfailed', r => net.push(`FAILED ${r.url().slice(0, 90)} :: ${r.failure()?.errorText}`));

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
  const hasRzpGlobal = await page.evaluate(() => typeof window.Razorpay);
  info(`window.Razorpay before pay: ${hasRzpGlobal}`);
  await page.getByRole('button', { name: /rupees/ }).click();
  await page.waitForTimeout(6000);
  const post = await page.evaluate(() => ({
    rzpGlobal: typeof window.Razorpay,
    scripts: [...document.scripts].map(s => s.src).filter(s => s.includes('razorpay')),
    iframes: [...document.querySelectorAll('iframe')].map(i => (i.id || i.name || i.src || '').slice(0, 60)),
    forms: [...document.forms].map(f => f.action.slice(0, 80)),
    toasts: [...document.querySelectorAll('div')].filter(d => d.textContent.includes('Payment') || d.textContent.includes('Razorpay') || d.textContent.includes('gateway')).slice(0, 3).map(d => d.textContent.trim().slice(0, 120)),
    modalEls: [...document.querySelectorAll('[id*="razorpay"],[class*="razorpay"],[data-razorpay]')].slice(0, 5).map(e => `${e.tagName}#${e.id}.${e.className}`.slice(0, 70))
  }));
  info('POST-PAY DOM', JSON.stringify(post, null, 1));
  console.log('--- console/warnings ---'); msgs.forEach(m => console.log(m));
  console.log('--- razorpay network ---'); (net.length ? net : ['(none)']).forEach(n => console.log(n));
  await browser.close();
  function info(tag, d) { console.log(`[INFO] ${tag} :: ${d}`); }
};
run().catch(e => { console.error('ERR', e); process.exit(1); });
