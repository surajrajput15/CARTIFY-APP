const Product = require('../models/Product');
const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');
const { buildVariantKey } = require('./variants');

// Inventory service: the single place that keeps Product's sellable stock
// numbers in sync with per-warehouse InventoryItem rows.
//
// invariants:
//   - InventoryItem rows are the SOURCE OF TRUTH the admin edits.
//   - Product.countInStock (no-variant products) = sum across warehouses of the
//     variantKey:null rows.
//   - Product.variants[].stock (variant products) = sum across warehouses of the
//     rows for that variantKey. Product.countInStock stays the full total so any
//     legacy read is consistent.
//   - The payment/order-fulfillment path still decrements Product numbers
//     directly and is NOT routed through here — the guardrail is that checkout
//     logic is untouched; admin stock edits flow through this service instead.
//   - EVERY mutation writes a StockTransaction ledger row so movement is auditable.

const cents = (n) => Math.max(0, Math.round(Number(n) || 0));

// Record a ledger row. Pure append — never update, never delete.
async function recordTransaction({
  type, productId, warehouseId, variantKey = null, quantityDelta,
  balanceAfter, transferId = null, oppositeWarehouseId = null, note = '', performedBy = null,
}) {
  await StockTransaction.create({
    type, productId, warehouseId, variantKey, quantityDelta,
    balanceAfter,
    transferId,
    oppositeWarehouseId,
    note: note || '',
    performedBy,
  });
}

// Recompute a single product's sellable numbers from its inventory rows.
async function recomputeProductStock(productId) {
  const product = await Product.findById(productId);
  if (!product) return null;

  const rows = await InventoryItem.find({ productId }).lean();
  const perVariant = new Map(); // variantKey -> total
  let grandTotal = 0;
  for (const row of rows) {
    const key = row.variantKey || '__base__';
    perVariant.set(key, (perVariant.get(key) || 0) + (row.quantity || 0));
    grandTotal += row.quantity || 0;
  }

  product.countInStock = grandTotal;

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    for (const v of product.variants) {
      const key = buildVariantKey(v);
      v.stock = perVariant.get(key) || 0;
    }
  }

  await product.save();
  return product;
}

// Recompute ALL products from their inventory rows. Used after bulk edits or a
// migration. Returns { updated, products } count.
async function recomputeAllProducts() {
  const products = await Product.find({}).select('_id').lean();
  let updated = 0;
  for (const p of products) {
    const res = await recomputeProductStock(p._id);
    if (res) updated += 1;
  }
  return { updated };
}

// Set the absolute quantity of one (product, warehouse, variantKey) shelf row —
// upsert semantics. Records an 'adjustment' ledger row for the delta.
async function setWarehouseQuantity({ productId, warehouseId, variantKey = null, quantity, performedBy = null, note = '' }) {
  const qty = cents(quantity);
  const key = variantKey || null;

  const existing = await InventoryItem.findOne({ productId, warehouseId, variantKey: key });
  const before = existing ? existing.quantity : 0;
  const delta = qty - before;

  if (existing) {
    existing.quantity = qty;
    await existing.save();
  } else {
    await InventoryItem.create({ productId, warehouseId, variantKey: key, quantity: qty });
  }

  if (delta !== 0) {
    await recordTransaction({
      type: 'adjustment',
      productId,
      warehouseId,
      variantKey: key,
      quantityDelta: delta,
      balanceAfter: qty,
      note: note || '',
      performedBy,
    });
  }

  const product = await recomputeProductStock(productId);
  return product;
}

// Move stock between warehouses. Deducts from source (validating sufficient
// balance), adds to destination, writes BOTH ledger rows sharing one transferId.
async function transferStock({
  productId, variantKey = null, quantity, fromWarehouseId, toWarehouseId, performedBy = null, note = '',
}) {
  const qty = cents(quantity);
  if (qty <= 0) throw new Error('Transfer quantity must be greater than zero');
  if (String(fromWarehouseId) === String(toWarehouseId)) {
    throw new Error('Source and destination warehouses must be different');
  }
  const key = variantKey || null;

  // ObjectId is required for the transaction Object (upsert filtering on ids).
  const from = new mongoose.Types.ObjectId(fromWarehouseId);
  const to = new mongoose.Types.ObjectId(toWarehouseId);

  const source = await InventoryItem.findOne({ productId, warehouseId: from, variantKey: key });
  const available = source ? source.quantity : 0;
  if (available < qty) {
    throw new Error(`Insufficient stock at source: only ${available} available`);
  }

  const dest = await InventoryItem.findOne({ productId, warehouseId: to, variantKey: key });

  // Destination upsert
  if (dest) {
    dest.quantity += qty;
    await dest.save();
  } else {
    await InventoryItem.create({ productId, warehouseId: to, variantKey: key, quantity: qty });
  }

  // Source decrement
  source.quantity = available - qty;
  if (source.quantity === 0) {
    // keep the row (a 0 shelf) instead of deleting — the ledger references it
  }
  await source.save();

  const transferId = new mongoose.Types.ObjectId();

  await recordTransaction({
    type: 'transfer_out',
    productId, warehouseId: from, variantKey: key,
    quantityDelta: -qty,
    balanceAfter: source.quantity,
    transferId, oppositeWarehouseId: to,
    note: note || '', performedBy,
  });
  await recordTransaction({
    type: 'transfer_in',
    productId, warehouseId: to, variantKey: key,
    quantityDelta: qty,
    balanceAfter: dest ? dest.quantity + qty : qty,
    transferId, oppositeWarehouseId: from,
    note: note || '', performedBy,
  });

  await recomputeProductStock(productId);
  return { transferId, sourceBalance: source.quantity };
}

// Delete every inventory row for a (product, warehouse) — used when a warehouse
// is decommissioned. Ledger rows are NOT deleted (they are the audit trail).
async function clearWarehouseRows({ productId, warehouseId, performedBy = null, note = '' }) {
  const rows = await InventoryItem.find({ productId, warehouseId });
  for (const row of rows) {
    if ((row.quantity || 0) > 0) {
      await recordTransaction({
        type: 'adjustment',
        productId, warehouseId, variantKey: row.variantKey || null,
        quantityDelta: -(row.quantity || 0),
        balanceAfter: 0,
        note: note || 'rows cleared',
        performedBy,
      });
    }
  }
  await InventoryItem.deleteMany({ productId, warehouseId });
  return recomputeProductStock(productId);
}

// Count of distinct sellable SKUs at a warehouse (for the admin warehouse card).
async function warehouseSummary(warehouseId) {
  const [rows, variants] = await Promise.all([
    InventoryItem.find({ warehouseId }).select('quantity').lean(),
    InventoryItem.distinct('variantKey', { warehouseId, variantKey: { $ne: null } }),
  ]);
  return {
    skus: rows.length,
    units: rows.reduce((s, r) => s + (r.quantity || 0), 0),
    variants: variants.length,
  };
}

module.exports = {
  recordTransaction,
  recomputeProductStock,
  recomputeAllProducts,
  setWarehouseQuantity,
  transferStock,
  clearWarehouseRows,
  warehouseSummary,
};