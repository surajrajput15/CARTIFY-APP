const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');
const { buildTestApp } = require('./testApp');

const app = buildTestApp();

const createTestUser = async ({ email, isAdmin = false }) => {
  const hashedPassword = await bcrypt.hash('Password123', 10);
  return User.create({ name: 'T', email, password: hashedPassword, isAdmin });
};

describe('Warehouse & Inventory', () => {
  let adminAgent, userAgent, admin, user, product, variantProduct;

  beforeEach(async () => {
    await Promise.all([Warehouse.deleteMany({}), InventoryItem.deleteMany({}), StockTransaction.deleteMany({}), User.deleteMany({}), Product.deleteMany({})]);

    adminAgent = request.agent(app);
    userAgent = request.agent(app);
    admin = await createTestUser({ email: `wh${Date.now()}a@t.com`, isAdmin: true });
    user = await createTestUser({ email: `wh${Date.now()}u@t.com` });

    await adminAgent.post('/api/auth/login').send({ email: admin.email, password: 'Password123' });
    await userAgent.post('/api/auth/login').send({ email: user.email, password: 'Password123' });

    product = await Product.create({
      title: 'Blender', price: 3000, description: 'T', category: 'home',
      image: 'b.jpg', countInStock: 0,
    });
    variantProduct = await Product.create({
      title: 'Hoodie', price: 2000, description: 'T', category: 'clothing',
      image: 'h.jpg', countInStock: 0,
      variants: [
        { size: 'M', color: 'Black', stock: 0, sku: 'M-BLACK' },
        { size: 'L', color: 'Black', stock: 0, sku: 'L-BLACK' },
      ],
    });
  });

  describe('warehouse CRUD', () => {
    it('rejects non-admins', async () => {
      const res = await userAgent.post('/api/warehouses').send({ name: 'X', code: 'X1', city: 'C', state: 'S' });
      expect(res.status).toBe(403);
    });

    it('creates, lists and rejects duplicate codes', async () => {
      const created = await adminAgent.post('/api/warehouses').send({ name: 'East', code: 'EST', city: 'Kolkata', state: 'WB' });
      expect(created.status).toBe(201);
      const wId = created.body._id;

      const list = await adminAgent.get('/api/warehouses');
      expect(list.status).toBe(200);
      expect(list.body.warehouses).toHaveLength(1);
      expect(list.body.warehouses[0].skuCount).toBe(0);

      const dupe = await adminAgent.post('/api/warehouses').send({ name: 'East2', code: 'EST', city: 'C', state: 'S' });
      expect(dupe.status).toBe(409);

      const updated = await adminAgent.patch(`/api/warehouses/${wId}`).send({ city: 'Howrah' });
      expect(updated.status).toBe(200);
      expect(updated.body.city).toBe('Howrah');
    });
  });

  describe('inventory rows & product sync', () => {
    it('non-variant: sums warehouse rows into countInStock', async () => {
      const wh = await Warehouse.create({ name: 'North', code: 'NTH', city: 'Delhi', state: 'DL' });

      const set1 = await adminAgent.put(`/api/inventory/${wh._id}/product/${product._id}`).send({ quantity: 12 });
      expect(set1.status).toBe(200);

      const rows = await adminAgent.get(`/api/inventory/${wh._id}`);
      expect(rows.status).toBe(200);
      expect(rows.body.items).toHaveLength(1);
      expect(rows.body.items[0].quantity).toBe(12);
      expect(rows.body.items[0].productTitle).toBe('Blender');

      const after = await Product.findById(product._id);
      expect(after.countInStock).toBe(12);
    });

    it('variant: restricts to real variantKeys and syncs variants[].stock', async () => {
      const wh = await Warehouse.create({ name: 'South', code: 'STH', city: 'Chennai', state: 'TN' });
      const pid = variantProduct._id;

      const bad = await adminAgent.put(`/api/inventory/${wh._id}/product/${pid}`).send({ quantity: 5 });
      expect(bad.status).toBe(400);

      const badKey = await adminAgent.put(`/api/inventory/${wh._id}/product/${pid}`).send({ variantKey: 'ZZ|Pink', quantity: 5 });
      expect(badKey.status).toBe(400);

      const ok = await adminAgent.put(`/api/inventory/${wh._id}/product/${pid}`).send({ variantKey: 'M|Black', quantity: 5 });
      expect(ok.status).toBe(200);

      const after = await Product.findById(pid);
      expect(after.variants[0].stock).toBe(5);
      expect(after.countInStock).toBe(5);

      // second warehouse stacks on top
      const wh2 = await Warehouse.create({ name: 'West', code: 'WST', city: 'Mumbai', state: 'MH' });
      await adminAgent.put(`/api/inventory/${wh2._id}/product/${pid}`).send({ variantKey: 'M|Black', quantity: 3 });
      const after2 = await Product.findById(pid);
      expect(after2.variants[0].stock).toBe(8);
      expect(after2.countInStock).toBe(8);
    });

    it('refuses deleting a warehouse that still holds stock', async () => {
      const wh = await Warehouse.create({ name: 'Test', code: 'TST', city: 'C', state: 'S' });
      await InventoryItem.create({ productId: product._id, warehouseId: wh._id, variantKey: null, quantity: 4 });

      const del = await adminAgent.delete(`/api/warehouses/${wh._id}`);
      expect(del.status).toBe(409);

      await InventoryItem.deleteMany({ warehouseId: wh._id });
      const del2 = await adminAgent.delete(`/api/warehouses/${wh._id}`);
      expect(del2.status).toBe(200);
    });

    it('recompute heals derived stock from rows', async () => {
      const wh = await Warehouse.create({ name: 'Rec', code: 'REC', city: 'C', state: 'S' });
      await InventoryItem.create({ productId: product._id, warehouseId: wh._id, variantKey: null, quantity: 9 });
      await Product.updateOne({ _id: product._id }, { $set: { countInStock: 0 } });

      const res = await adminAgent.post('/api/inventory/recompute');
      expect(res.status).toBe(200);
      const after = await Product.findById(product._id);
      expect(after.countInStock).toBe(9);
    });
  });

  describe('stock ledger & transfers', () => {
    it('records a ledger row on every inventory adjustment', async () => {
      const wh = await Warehouse.create({ name: 'Ledger', code: 'LDG', city: 'C', state: 'S' });
      await adminAgent.put(`/api/inventory/${wh._id}/product/${product._id}`).send({ quantity: 15 });

      const ledger = await adminAgent.get('/api/stock/ledger');
      expect(ledger.status).toBe(200);
      expect(ledger.body.transactions).toHaveLength(1);
      expect(ledger.body.transactions[0].type).toBe('adjustment');
      expect(ledger.body.transactions[0].quantityDelta).toBe(15);
      expect(ledger.body.transactions[0].balanceAfter).toBe(15);
      expect(ledger.body.transactions[0].productTitle).toBe('Blender');
    });

    it('transfers stock between warehouses and writes paired ledger rows', async () => {
      const from = await Warehouse.create({ name: 'FromHub', code: 'FRM', city: 'C', state: 'S' });
      const to = await Warehouse.create({ name: 'ToHub', code: 'TOH', city: 'C2', state: 'S2' });
      await InventoryItem.create({ productId: product._id, warehouseId: from._id, variantKey: null, quantity: 10 });

      const res = await adminAgent.post('/api/stock/transfer').send({
        productId: product._id, quantity: 4, fromWarehouseId: from._id, toWarehouseId: to._id, note: 'rebalance',
      });
      expect(res.status).toBe(200);

      const [fromRow, toRow] = await Promise.all([
        InventoryItem.findOne({ warehouseId: from._id, productId: product._id }),
        InventoryItem.findOne({ warehouseId: to._id, productId: product._id }),
      ]);
      expect(fromRow.quantity).toBe(6);
      expect(toRow.quantity).toBe(4);

      const prod = await Product.findById(product._id);
      expect(prod.countInStock).toBe(10); // conserved across warehouses

      const ledger = await adminAgent.get('/api/stock/ledger');
      expect(ledger.body.transactions).toHaveLength(2);
      const outRow = ledger.body.transactions.find((t) => t.type === 'transfer_out');
      const inRow = ledger.body.transactions.find((t) => t.type === 'transfer_in');
      expect(outRow.quantityDelta).toBe(-4);
      expect(inRow.quantityDelta).toBe(4);
      expect(String(outRow.transferId)).toBe(String(inRow.transferId));
    });

    it('refuses transfers when source has insufficient stock', async () => {
      const from = await Warehouse.create({ name: 'Src', code: 'SRC', city: 'C', state: 'S' });
      const to = await Warehouse.create({ name: 'Dst', code: 'DST', city: 'C2', state: 'S2' });
      await InventoryItem.create({ productId: product._id, warehouseId: from._id, variantKey: null, quantity: 2 });

      const res = await adminAgent.post('/api/stock/transfer').send({
        productId: product._id, quantity: 9, fromWarehouseId: from._id, toWarehouseId: to._id,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Insufficient stock|insufficient/i);
    });

    it('refuses transfer to the same warehouse', async () => {
      const wh = await Warehouse.create({ name: 'Same', code: 'SAM', city: 'C', state: 'S' });
      const res = await adminAgent.post('/api/stock/transfer').send({
        productId: product._id, quantity: 1, fromWarehouseId: wh._id, toWarehouseId: String(wh._id),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('inventory alerts', () => {
    it('rejects non-admins', async () => {
      const res = await userAgent.get('/api/inventory/alerts');
      expect(res.status).toBe(403);
    });

    it('flags rows at or below lowStockThreshold, defaulting to empty', async () => {
      const wh = await Warehouse.create({ name: 'Alert Hub', code: 'ALH', city: 'C', state: 'S' });
      // Empty row (qty 0, threshold 0) — alerts by default.
      await InventoryItem.create({ productId: product._id, warehouseId: wh._id, variantKey: null, quantity: 0 });
      // Row at its raised threshold (qty 3 == threshold 3) — alerts.
      await InventoryItem.create({ productId: variantProduct._id, warehouseId: wh._id, variantKey: 'M|Black', quantity: 3, lowStockThreshold: 3 });
      // Healthy row (qty 20, threshold 0) — no alert.
      const healthy = await Product.create({ title: 'Kettle', price: 1500, description: 'T', category: 'home', image: 'k.jpg', countInStock: 0 });
      await InventoryItem.create({ productId: healthy._id, warehouseId: wh._id, variantKey: null, quantity: 20 });

      const res = await adminAgent.get('/api/inventory/alerts');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.criticalCount).toBe(1);
      expect(res.body.lowCount).toBe(1);
      const titles = res.body.alerts.map((a) => a.productTitle);
      expect(titles).toContain('Blender');
      expect(titles).toContain('Hoodie');
      expect(titles).not.toContain('Kettle');
      expect(res.body.alerts[0].warehouseName).toBe('Alert Hub');
    });

    it('filters by warehouse and rejects bad warehouse ids', async () => {
      const whA = await Warehouse.create({ name: 'Hub A', code: 'HBA', city: 'C', state: 'S' });
      const whB = await Warehouse.create({ name: 'Hub B', code: 'HBB', city: 'C2', state: 'S2' });
      await InventoryItem.create({ productId: product._id, warehouseId: whA._id, variantKey: null, quantity: 0 });
      await InventoryItem.create({ productId: product._id, warehouseId: whB._id, variantKey: null, quantity: 0 });

      const scoped = await adminAgent.get(`/api/inventory/alerts?warehouse=${whA._id}`);
      expect(scoped.status).toBe(200);
      expect(scoped.body.total).toBe(1);
      expect(scoped.body.alerts[0].warehouseCode).toBe('HBA');

      const bad = await adminAgent.get('/api/inventory/alerts?warehouse=not-an-id');
      expect(bad.status).toBe(400);
    });
  });
});