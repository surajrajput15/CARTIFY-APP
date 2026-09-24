const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const InventoryItem = require('../models/InventoryItem');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const { buildTestApp } = require('./testApp');

const app = buildTestApp();
const PASSWORD = 'Password123';

const createAccount = async ({ name, email, role = 'customer', isAdmin = false, assignedWarehouseId = null }) => {
  const password = await bcrypt.hash(PASSWORD, 10);
  return User.create({ name, email, password, role, isAdmin, assignedWarehouseId });
};

const login = async (agent, email) => {
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
};

const makeProduct = async () =>
  Product.create({
    title: 'Wh Stock Test',
    price: 100,
    description: 'T',
    category: 'electronics',
    image: 'img.jpg',
    countInStock: 5,
  });

describe('Admin Staff Management', () => {
  let adminAgent, customerAgent;
  let adminUser, customer;
  let warehouse;

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Warehouse.deleteMany({}),
      InventoryItem.deleteMany({}),
      StockTransaction.deleteMany({}),
      Product.deleteMany({}),
    ]);

    adminAgent = request.agent(app);
    customerAgent = request.agent(app);

    adminUser = await createAccount({ name: 'Admin', email: 'admins@test.com', isAdmin: true });
    await login(adminAgent, 'admins@test.com');
    customer = await createAccount({ name: 'Customer', email: 'custs@test.com' });
    await login(customerAgent, 'custs@test.com');
    warehouse = await Warehouse.create({ name: 'Test WH', code: 'TESTWH', city: 'Delhi', state: 'DL' });
  });

  it('rejects non-admin callers', async () => {
    await customerAgent.get('/api/admin/staff').expect(403);
    await customerAgent.post('/api/admin/staff').send({}).expect(403);
  });

  it('creates a warehouse staff account with an assigned warehouse', async () => {
    const res = await adminAgent.post('/api/admin/staff').send({
      name: 'W Staff', email: 'wstaff@test.com', password: 'Password123', role: 'warehouse', warehouseId: warehouse._id.toString(),
    }).expect(201);
    expect(res.body.user.role).toBe('warehouse');
    expect(String(res.body.user.assignedWarehouseId)).toBe(warehouse._id.toString());
  });

  it('rejects warehouse staff creation without a valid warehouse', async () => {
    const res = await adminAgent.post('/api/admin/staff').send({
      name: 'W2', email: 'w2@test.com', password: 'Password123', role: 'warehouse',
    }).expect(400);
    expect(res.body.message).toMatch(/warehouseId is required/i);
  });

  it('rejects a duplicate email', async () => {
    await createAccount({ name: 'X', email: 'dup@test.com' });
    const res = await adminAgent.post('/api/admin/staff').send({
      name: 'X2', email: 'dup@test.com', password: 'Password123', role: 'delivery',
    }).expect(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('lists staff and assigns a warehouse to an existing account', async () => {
    const staff = await createAccount({ name: 'Del', email: 'del@test.com', role: 'delivery' });
    await adminAgent.patch(`/api/admin/staff/${staff._id}`)
      .send({ warehouseId: warehouse._id.toString() }).expect(200);

    // Re-query list — the account should now surface with its warehouse.
    const res = await adminAgent.get('/api/admin/staff').expect(200);
    expect(res.body.staff.some((s) => String(s.assignedWarehouseId?._id || s.assignedWarehouseId) === warehouse._id.toString())).toBe(true);
  });

  it('demotes staff back to customer', async () => {
    const staff = await createAccount({ name: 'Del2', email: 'del2@test.com', role: 'delivery' });
    const res = await adminAgent.delete(`/api/admin/staff/${staff._id}`).expect(200);
    expect(res.body.message).toMatch(/demoted/i);
    const db = await User.findById(staff._id).lean();
    expect(db.role).toBe('customer');
    expect(db.assignedWarehouseId).toBe(null);
  });
});

describe('Warehouse Staff Portal', () => {
  let adminAgent, staffAgent, otherStaffAgent, customerAgent;
  let adminUser, warehouse, otherWarehouse, product, staffId;

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Warehouse.deleteMany({}),
      InventoryItem.deleteMany({}),
      StockTransaction.deleteMany({}),
      Product.deleteMany({}),
    ]);

    adminAgent = request.agent(app);
    staffAgent = request.agent(app);
    otherStaffAgent = request.agent(app);
    customerAgent = request.agent(app);

    adminUser = await createAccount({ name: 'Admin', email: 'admine@test.com', isAdmin: true });
    await login(adminAgent, 'admine@test.com');

    warehouse = await Warehouse.create({ name: 'Noida WH', code: 'NOIDA', city: 'Noida', state: 'UP' });
    otherWarehouse = await Warehouse.create({ name: 'Mumbai WH', code: 'MUM', city: 'Mumbai', state: 'MH' });

    const staffUser = await createAccount({ name: 'Staff', email: 'staffp@test.com', role: 'warehouse', assignedWarehouseId: warehouse._id });
    staffId = staffUser._id;
    await login(staffAgent, 'staffp@test.com');
    const otherStaff = await createAccount({ name: 'Other', email: 'otherp@test.com', role: 'warehouse', assignedWarehouseId: otherWarehouse._id });
    await login(otherStaffAgent, 'otherp@test.com');
    const cust = await createAccount({ name: 'Cust', email: 'custp@test.com' });
    await login(customerAgent, 'custp@test.com');

    product = await makeProduct();
  });

  it('scopes dashboard to the assigned warehouse', async () => {
    await InventoryItem.create({ productId: product._id, warehouseId: warehouse._id, quantity: 3, lowStockThreshold: 0 });
    await InventoryItem.create({ productId: product._id, warehouseId: otherWarehouse._id, quantity: 50, lowStockThreshold: 0 });

    const res = await staffAgent.get('/api/warehouse/dashboard').expect(200);
    expect(res.body.warehouse.code).toBe('NOIDA');
    expect(res.body.skus).toBe(1);
    expect(res.body.units).toBe(3);
  });

  it('returns 403 when the account has no assigned warehouse', async () => {
    const noWH = await createAccount({ name: 'NoWH', email: 'nowh@test.com', role: 'warehouse', assignedWarehouseId: null });
    const tmpAgent = request.agent(app);
    await login(tmpAgent, 'nowh@test.com');
    const res = await tmpAgent.get('/api/warehouse/dashboard').expect(403);
    expect(res.body.message).toMatch(/no warehouse assigned/i);
    // Cleanup
    await User.deleteOne({ _id: noWH._id });
  });

  it('only shows this warehouse inventory', async () => {
    await InventoryItem.create({ productId: product._id, warehouseId: warehouse._id, quantity: 3 });
    await InventoryItem.create({ productId: product._id, warehouseId: otherWarehouse._id, quantity: 50 });

    const res = await staffAgent.get('/api/warehouse/inventory').expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(3);
  });

  it('lets staff update their own stock but not other warehouses', async () => {
    await staffAgent.put(`/api/warehouse/inventory/${product._id}`)
      .send({ quantity: 7 }).expect(200);

    const mine = await InventoryItem.findOne({ warehouseId: warehouse._id, productId: product._id }).lean();
    expect(mine.quantity).toBe(7);
    const theirs = await InventoryItem.findOne({ warehouseId: otherWarehouse._id, productId: product._id }).lean();
    expect(theirs).toBeNull();

    await otherStaffAgent.put(`/api/warehouse/inventory/${product._id}`)
      .send({ quantity: 99 }).expect(200);
    const theirsNow = await InventoryItem.findOne({ warehouseId: otherWarehouse._id, productId: product._id }).lean();
    expect(theirsNow.quantity).toBe(99);
    const mineStill = await InventoryItem.findOne({ warehouseId: warehouse._id, productId: product._id }).lean();
    expect(mineStill.quantity).toBe(7);
  });

  it('rejects stock edits that violate variant rules', async () => {
    const res = await staffAgent.put(`/api/warehouse/inventory/${product._id}`)
      .send({ quantity: 5, variantKey: 'S-RED' }).expect(400);
    expect(res.body.message).toMatch(/no variants/i);
  });

  it('shows low-stock alerts for this warehouse only', async () => {
    await InventoryItem.create({ productId: product._id, warehouseId: warehouse._id, quantity: 0, lowStockThreshold: 0 });
    await InventoryItem.create({ productId: product._id, warehouseId: otherWarehouse._id, quantity: 0, lowStockThreshold: 0 });

    const res = await staffAgent.get('/api/warehouse/alerts').expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.alerts[0].critical).toBe(true);
  });

  it('lists its own ledger and other warehouses for transfer', async () => {
    await InventoryItem.create({ productId: product._id, warehouseId: warehouse._id, quantity: 10 });
    await staffAgent.put(`/api/warehouse/inventory/${product._id}`).send({ quantity: 12 }).expect(200);

    const ledger = await staffAgent.get('/api/warehouse/ledger').expect(200);
    expect(ledger.body.transactions.length).toBeGreaterThanOrEqual(1);

    const picker = await staffAgent.get('/api/warehouse/other-warehouses').expect(200);
    expect(picker.body.warehouses).toHaveLength(1);
    expect(picker.body.warehouses[0].code).toBe('MUM');
  });

  it('transfers stock out of the assigned warehouse only', async () => {
    await InventoryItem.create({ productId: product._id, warehouseId: warehouse._id, quantity: 10 });

    await staffAgent.post('/api/warehouse/transfer')
      .send({ productId: product._id.toString(), quantity: 4, toWarehouseId: otherWarehouse._id.toString() })
      .expect(200);

    const source = await InventoryItem.findOne({ warehouseId: warehouse._id, productId: product._id }).lean();
    expect(source.quantity).toBe(6);
    const dest = await InventoryItem.findOne({ warehouseId: otherWarehouse._id, productId: product._id }).lean();
    expect(dest.quantity).toBe(4);
  });

  it('refuses insufficient-stock transfers', async () => {
    await InventoryItem.create({ productId: product._id, warehouseId: warehouse._id, quantity: 2 });
    const res = await staffAgent.post('/api/warehouse/transfer')
      .send({ productId: product._id.toString(), quantity: 5, toWarehouseId: otherWarehouse._id.toString() })
      .expect(400);
    expect(res.body.message).toMatch(/insufficient/i);
  });

  it('rejects non-warehouse callers', async () => {
    await customerAgent.get('/api/warehouse/dashboard').expect(403);
    await adminAgent.get('/api/warehouse/dashboard').expect(403);
    await customerAgent.post('/api/warehouse/transfer').send({}).expect(403);
  });
});