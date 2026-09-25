// Seed demo accounts (customer, delivery, warehouse) — never admin.
// Usage:
//   Local dry run (no DB writes):
//     node scripts/seedDemoAccounts.js --dry-run
//   Local seed:
//     node scripts/seedDemoAccounts.js --target=local --print-credentials-once
//   Production seed (Render Shell, uses Render's MONGO_URI):
//     node scripts/seedDemoAccounts.js --target=production --confirm-production --print-credentials-once
//
// Optional overrides (env or CLI):
//   SEED_CUSTOMER_EMAIL / --customer-email, SEED_DELIVERY_EMAIL / --delivery-email,
//   SEED_WAREHOUSE_EMAIL / --warehouse-email, SEED_DELIVERY_PHONE / --delivery-phone,
//   SEED_WAREHOUSE_CODE / --warehouse-code, SEED_WAREHOUSE_NAME, SEED_WAREHOUSE_CITY,
//   SEED_WAREHOUSE_STATE.
//
// Safety: refuses admin roles, owner-allowlist emails (ADMIN_EMAILS), and any
// production run without BOTH --target=production and --confirm-production.

const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const { isOwnerEmail, applyOwnerRole } = require('../utils/ownerValidator');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_ROLES = ['customer', 'delivery', 'warehouse'];

const parseArgs = (argv) => {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) out[arg.slice(2)] = true;
    else out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return out;
};

const fail = (message) => {
  console.error(`Refused: ${message}`);
  process.exit(1);
};

const mongoHost = (uri) => {
  try {
    return new URL(String(uri)).hostname.toLowerCase();
  } catch {
    const m = String(uri || '').match(/:\/\/([^/?@]+@)?([^/?:]+)/);
    return (m && m[2] ? m[2] : '').toLowerCase();
  }
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const genPassword = (length = 16) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits)];
  for (let i = chars.length; i < length; i += 1) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const genPhone = () => `9${String(crypto.randomInt(100000000, 999999999))}`;

const validatePlan = (accounts) => {
  const seen = new Set();
  for (const account of accounts) {
    if (!ALLOWED_ROLES.includes(account.role)) {
      fail(`role '${account.role}' is not seedable (admin excluded by design)`);
    }
    if (!account.name || !account.name.trim()) fail('every demo account needs a name');
    const email = normalizeEmail(account.email);
    if (!EMAIL_RE.test(email)) fail(`invalid email '${account.email}'`);
    if (seen.has(email)) fail(`duplicate email '${email}' in seed plan`);
    seen.add(email);
    if (isOwnerEmail(email)) {
      fail(`'${email}' is on the owner allowlist (ADMIN_EMAILS) — seed refuses owner/admin-linked addresses`);
    }
  }
};

const upsertAccount = async ({ name, email, role, phone, password, assignedWarehouseId }) => {
  const existing = await User.findOne({ email });
  const hashed = await bcrypt.hash(password, 10);
  if (existing) {
    if (existing.isAdmin || existing.role === 'admin' || isOwnerEmail(existing.email)) {
      fail(`existing user '${email}' is admin/owner-linked — seed will not touch it`);
    }
    if (existing.status !== 'active') {
      fail(`existing user '${email}' has status '${existing.status}' — reactivate it manually before re-seeding`);
    }
    existing.name = name;
    existing.password = hashed;
    existing.role = role;
    existing.phone = phone || existing.phone || null;
    if (role === 'warehouse') existing.assignedWarehouseId = assignedWarehouseId;
    else if (existing.assignedWarehouseId && role !== 'warehouse') existing.assignedWarehouseId = null;
    existing.isAdmin = false;
    await existing.save();
    await applyOwnerRole(existing);
    return { email, role, mode: 'updated', id: String(existing._id) };
  }
  const created = await User.create({
    name,
    email,
    password: hashed,
    role,
    phone: phone || null,
    assignedWarehouseId: role === 'warehouse' ? assignedWarehouseId : null,
    status: 'active',
    isAdmin: false,
  });
  await applyOwnerRole(created);
  return { email, role, mode: 'created', id: String(created._id) };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const target = String(args.target || process.env.SEED_TARGET || 'local').toLowerCase();
  const dryRun = Boolean(args['dry-run']);
  const printCredentials = Boolean(args['print-credentials-once']);
  const confirmProduction = Boolean(args['confirm-production']);

  if (!['local', 'production'].includes(target)) fail(`unknown --target='${target}' (use local|production)`);

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri && !dryRun) fail('MONGO_URI is not set');
  const host = mongoUri ? mongoHost(mongoUri) : '(none)';
  const isLocalHost = LOCAL_HOSTS.has(host);

  if (target === 'local' && !dryRun && !isLocalHost) {
    fail(`--target=local but MONGO_URI points at '${host}' — refusing to touch a non-local DB`);
  }
  if (target === 'production' && !(confirmProduction && !dryRun)) {
    if (dryRun) {
      console.log(`[dry-run] production plan validated (DB host '${host}') — re-run with --confirm-production to execute`);
    } else {
      fail('production seeding needs BOTH --target=production and --confirm-production');
    }
  }
  if (target === 'production' && isLocalHost && !dryRun) {
    fail(`--target=production but MONGO_URI points at local host '${host}'`);
  }

  const warehouseCode = String(args['warehouse-code'] || process.env.SEED_WAREHOUSE_CODE || 'DEMO01').trim().toUpperCase();
  if (!warehouseCode || warehouseCode.length > 10) fail('warehouse code must be 1-10 chars');
  const warehouseSpec = {
    name: String(args['warehouse-name'] || process.env.SEED_WAREHOUSE_NAME || 'Demo Warehouse').trim(),
    code: warehouseCode,
    city: String(args['warehouse-city'] || process.env.SEED_WAREHOUSE_CITY || 'Delhi').trim(),
    state: String(args['warehouse-state'] || process.env.SEED_WAREHOUSE_STATE || 'Delhi').trim(),
  };
  if (!warehouseSpec.name || !warehouseSpec.city || !warehouseSpec.state) fail('warehouse name/city/state are required');

  const accounts = [
    {
      role: 'customer',
      name: String(args['customer-name'] || process.env.SEED_CUSTOMER_NAME || 'Demo Customer').trim(),
      email: normalizeEmail(args['customer-email'] || process.env.SEED_CUSTOMER_EMAIL || 'demo.customer@example.com'),
      phone: null,
      password: genPassword(),
    },
    {
      role: 'delivery',
      name: String(args['delivery-name'] || process.env.SEED_DELIVERY_NAME || 'Demo Delivery Partner').trim(),
      email: normalizeEmail(args['delivery-email'] || process.env.SEED_DELIVERY_EMAIL || 'demo.delivery@example.com'),
      phone: String(args['delivery-phone'] || process.env.SEED_DELIVERY_PHONE || genPhone()).trim(),
      password: genPassword(),
    },
    {
      role: 'warehouse',
      name: String(args['warehouse-staff-name'] || process.env.SEED_WAREHOUSE_STAFF_NAME || 'Demo Warehouse Staff').trim(),
      email: normalizeEmail(args['warehouse-email'] || process.env.SEED_WAREHOUSE_EMAIL || 'demo.warehouse@example.com'),
      phone: null,
      password: genPassword(),
    },
  ];
  validatePlan(accounts);

  if (dryRun) {
    console.log(JSON.stringify({
      target,
      dbHost: host,
      warehouse: warehouseSpec,
      accounts: accounts.map(({ role, email, name, phone }) => ({ role, email, name, phone: phone || null })),
    }, null, 2));
    return;
  }

  await mongoose.connect(mongoUri);

  let warehouse = await Warehouse.findOne({ code: warehouseSpec.code });
  if (!warehouse) {
    try {
      warehouse = await Warehouse.create({ ...warehouseSpec, isActive: true });
    } catch (err) {
      if (err && err.code === 11000) {
        warehouse = await Warehouse.findOne({ name: warehouseSpec.name });
      }
      if (!warehouse) throw err;
    }
  }

  const results = [];
  for (const account of accounts) {
    results.push(await upsertAccount({
      ...account,
      assignedWarehouseId: account.role === 'warehouse' ? warehouse._id : null,
    }));
  }

  console.log('Demo accounts ready (admin excluded):');
  for (const result of results) {
    const extra = result.role === 'warehouse' ? ` warehouse=${warehouse.code}` : '';
    console.log(`- ${result.mode} ${result.role} ${result.email} (id ${result.id})${extra}`);
  }

  if (printCredentials) {
    console.log('Initial passwords (shown once — rotate immediately, do not commit or paste into tickets):');
    for (const account of accounts) {
      console.log(`- ${account.role} ${account.email} :: ${account.password}`);
    }
  } else {
    console.log('Passwords were hashed and stored; re-run with --print-credentials-once to display them once, then rotate.');
  }

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error('Seed failed:', err && err.message ? err.message : err);
  try { await mongoose.disconnect(); } catch { /* already closed */ }
  process.exit(1);
});
