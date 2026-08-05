// Shared QA helpers — portable paths + local-database safety guard.
// QA scripts must only ever run against a local development database, never
// against a production cluster. Every script that touches MongoDB must call
// assertLocalDb() (or connectQaMongo()) before connecting.
const path = require('path');
const { createRequire } = require('module');

// qa/ lives next to Backend/ inside the monorepo. Derive all paths relative to
// this file so the scripts stay portable and never hard-code a developer's
// machine path (username, Desktop, drive letters, etc.).
const qaDir = __dirname;
const backendDir = path.resolve(qaDir, '..', 'Backend');
const backendRequire = createRequire(path.join(backendDir, 'package.json'));

const getMongoose = () => backendRequire('mongoose');
const getDotenv = () => backendRequire('dotenv');

const loadBackendEnv = () => getDotenv().config({ path: path.join(backendDir, '.env') });

// Only these MongoDB hosts are allowed for QA. Anything else is treated as a
// production (or unknown) database and execution is aborted immediately.
const ALLOWED_QA_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

const mongoHost = (uri) => {
  try {
    return new URL(uri).hostname.toLowerCase();
  } catch {
    return uri.replace(/^mongodb(\+srv)?:\/\//, '').split(/[/:?#]/)[0].toLowerCase();
  }
};

const assertLocalDb = () => {
  const uri = process.env.MONGO_URI || '';
  const host = mongoHost(uri);
  if (!ALLOWED_QA_HOSTS.includes(host)) {
    console.error('Refusing to run QA scripts against production database.');
    process.exit(1);
  }
};

const connectQaMongo = async () => {
  const mongoose = getMongoose();
  loadBackendEnv();
  assertLocalDb();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  return mongoose;
};

// Chrome binary: allow an explicit override, otherwise use the standard install
// path for the current platform. No developer-specific paths are embedded.
const CHROME =
  process.env.CHROME_PATH ||
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/google-chrome');

module.exports = {
  qaDir,
  backendDir,
  CHROME,
  getMongoose,
  getDotenv,
  loadBackendEnv,
  assertLocalDb,
  connectQaMongo,
};
