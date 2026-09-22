// TASK 6 helper — ensures an admin session exists for regression admin tests.
// Uses the LOCAL database only (assertLocalDb guard). Creates/promotes a dedicated
// QA admin with a random password, logs in via the real API, and stores the
// session cookies + ids in temp files (all deleted after the regression run).
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const qaDir = __dirname;
const backendDir = path.resolve(qaDir, '..', 'Backend');
const backendRequire = createRequire(path.join(backendDir, 'package.json'));
const { loadBackendEnv, getMongoose, assertLocalDb } = require('./qa-utils.cjs');

loadBackendEnv();
const ADMIN_EMAIL = 'task6.admin.qa@example.com';
const CRED_FILE = path.join(qaDir, '.task6_admin_creds.json');
const COOKIE_FILE = path.join(qaDir, '.task6_admin_cookies.json');
const ID_FILE = path.join(qaDir, '.task6_admin_id.json');
const API = 'http://localhost:5000';

(async () => {
  assertLocalDb();
  const mongoose = getMongoose();
  const bcrypt = backendRequire('bcryptjs');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const users = mongoose.connection.db.collection('users');

  const password = 'T6' + require('crypto').randomBytes(9).toString('base64url') + 'aA1';
  const hash = await bcrypt.hash(password, 10);

  const existing = await users.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    await users.updateOne({ _id: existing._id }, { $set: { isAdmin: true, password: hash, name: 'Task6 QA Admin' } });
    console.log('[admin-helper] existing QA admin promoted/reset:', String(existing._id));
    fs.writeFileSync(ID_FILE, JSON.stringify(String(existing._id)));
  } else {
    const r = await users.insertOne({ name: 'Task6 QA Admin', email: ADMIN_EMAIL, password: hash, isAdmin: true });
    console.log('[admin-helper] QA admin created:', String(r.insertedId));
    fs.writeFileSync(ID_FILE, JSON.stringify(String(r.insertedId)));
  }
  await mongoose.connection.close();

  fs.writeFileSync(CRED_FILE, JSON.stringify({ email: ADMIN_EMAIL, password }));
  // Real API login (session cookies, not a forged token)
  const res = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
  });
  if (res.status !== 200) { console.error('[admin-helper] login failed', res.status); process.exit(1); }
  const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const jar = {};
  for (const c of set) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(jar));
  console.log('[admin-helper] admin session cookies saved:', Object.keys(jar).join(', '));
})().catch((e) => { console.error('[admin-helper] FATAL', e); process.exit(1); });
