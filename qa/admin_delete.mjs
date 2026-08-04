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
  const email = `admin2${TS}@test.com`;
  await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Admin QA2', email, password: 'adminPass1' }) });
  const lr = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'adminPass1' }) }).then(r => r.json());
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  await mongoose.connection.db.collection('users').updateOne({ email }, { $set: { isAdmin: true } });
  await mongoose.connection.close();

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); }, [lr.token, { ...lr.user, isAdmin: true }]);
  await page.goto(BASE + '/admin', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.fill('#search-input', 'EDITED');
  await page.waitForTimeout(1200);
  const body = await page.locator('body').innerText();
  console.log('search EDITED result contains QA:', /QA Admin UI EDITED/.test(body));
  const del = page.getByRole('button', { name: /Delete QA Admin UI/ });
  if (await del.count()) {
    await del.click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.waitForTimeout(2500);
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    const left = await mongoose.connection.db.collection('products').countDocuments({ title: /QA Admin UI/ });
    const total = await mongoose.connection.db.collection('products').countDocuments();
    await mongoose.connection.close();
    console.log('QA products remaining after delete:', left, '| total:', total);
    console.log(left === 0 ? 'DELETE VIA ADMIN UI: PASS' : 'DELETE VIA ADMIN UI: FAIL');
  } else {
    console.log('DELETE VIA ADMIN UI: FAIL - delete button not found');
  }
  await browser.close();
};
run().catch(e => { console.error('ERR', e); process.exit(1); });
