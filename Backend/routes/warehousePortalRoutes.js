const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const Warehouse = require('../models/Warehouse');
const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');
const { protect, warehouse } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { staffActionGuard } = require('../utils/routeLimiters');
const { setWarehouseQuantity, transferStock } = require('../utils/inventory');
const { buildVariantKey } = require('../utils/variants');

// Warehouse staff portal (B11-B14). Every route is scoped to the caller's
// assigned warehouse (req.user.assignedWarehouseId) — a warehouse partner can
// only see and edit their own warehouse's stock, never anyone else's.

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Resolve the staff member's warehouse; 403 if admin hasn't assigned one.
const myWarehouse = async (req, res) => {
  const id = req.user.assignedWarehouseId;
  if (!isValidId(id)) {
    res.status(403).json({ message: 'No warehouse assigned to your account. Contact an admin.' });
    return null;
  }
  const warehouseDoc = await Warehouse.findById(id);
  if (!warehouseDoc) {
    res.status(403).json({ message: 'Your assigned warehouse no longer exists. Contact an admin.' });
    return null;
  }
  return warehouseDoc;
};

// GET /api/warehouse/dashboard — headline numbers for this warehouse.
router.get('/dashboard', protect, warehouse, async (req, res, next) => {
  try {
    const w = await myWarehouse(req, res);
    if (!w) return;

    const [alerts, criticalRows, skuRows] = await Promise.all([
      InventoryItem.countDocuments({ warehouseId: w._id, $expr: { $lte: ['$quantity', '$lowStockThreshold'] } }),
      InventoryItem.countDocuments({ warehouseId: w._id, quantity: { $lte: 0 } }),
      InventoryItem.aggregate([
        { $match: { warehouseId: w._id } },
        { $group: { _id: null, skus: { $sum: 1 }, units: { $sum: '$quantity' } } },
      ]),
    ]);
    const agg = skuRows[0] || { skus: 0, units: 0 };

    res.status(200).json({
      warehouse: {
        _id: w._id, name: w.name, code: w.code, city: w.city,
        state: w.state, addressLine: w.addressLine, managerName: w.managerName,
      },
      skus: agg.skus,
      units: agg.units,
      alerts,
      critical: criticalRows,
    });
  } catch (error) {
    logger.error({ err: error }, 'Warehouse dashboard error');
    next(error);
  }
});

// GET /api/warehouse/inventory — this warehouse's stock rows (with product detail).
router.get('/inventory', protect, warehouse, async (req, res, next) => {
  try {
    const w = await myWarehouse(req, res);
    if (!w) return;

    const pipeline = [
      { $match: { warehouseId: w._id } },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'p',
        },
      },
      { $unwind: { path: '$p', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 1, productId: 1, variantKey: 1, quantity: 1,
          lowStockThreshold: 1, updatedAt: 1,
          productTitle: '$p.title',
          productImage: '$p.image',
          productCategory: '$p.category',
          hasVariants: { $gt: [{ $size: { $ifNull: ['$p.variants', []] } }, 0] },
        },
      },
    ];
    if (req.query.search) {
      pipeline.push({ $match: { productTitle: { $regex: req.query.search, $options: 'i' } } });
    }
    pipeline.push({ $sort: { updatedAt: -1 } });

    const items = await InventoryItem.aggregate(pipeline);
    res.status(200).json({ warehouse: { _id: w._id, name: w.name, code: w.code }, items });
  } catch (error) {
    logger.error({ err: error }, 'Warehouse inventory error');
    next(error);
  }
});

// PUT /api/warehouse/inventory/:productId — set absolute quantity here (scoped).
router.put('/inventory/:productId', protect, warehouse, staffActionGuard, auditLogMiddleware('UPDATE_INVENTORY', 'InventoryItem'), async (req, res, next) => {
  try {
    const w = await myWarehouse(req, res);
    if (!w) return;

    const { productId } = req.params;
    if (!isValidId(productId)) return res.status(400).json({ message: 'Invalid product ID' });

    const quantity = Number(req.body.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ message: 'quantity must be a non-negative number' });
    }
    const variantKey = typeof req.body.variantKey === 'string' && req.body.variantKey ? req.body.variantKey : null;

    const product = await require('../models/Product').findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.variants && product.variants.length > 0) {
      const validKeys = product.variants.map(buildVariantKey);
      if (!variantKey || !validKeys.includes(variantKey)) {
        return res.status(400).json({ message: 'This product has variants; provide a valid variantKey' });
      }
    } else if (variantKey) {
      return res.status(400).json({ message: 'This product has no variants; provide quantity without variantKey' });
    }

    await setWarehouseQuantity({ productId, warehouseId: w._id, variantKey, quantity, performedBy: req.user._id, note: 'warehouse portal restock' });
    res.status(200).json({ message: 'Stock updated', quantity });
  } catch (error) {
    logger.error({ err: error }, 'Warehouse inventory set error');
    next(error);
  }
});

// GET /api/warehouse/alerts — low-stock alerts for THIS warehouse only.
router.get('/alerts', protect, warehouse, async (req, res, next) => {
  try {
    const w = await myWarehouse(req, res);
    if (!w) return;

    const rows = await InventoryItem.aggregate([
      { $match: { warehouseId: w._id, $expr: { $lte: ['$quantity', '$lowStockThreshold'] } } },
      { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'p' } },
      { $unwind: { path: '$p', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 1, productId: 1, variantKey: 1, quantity: 1, lowStockThreshold: 1,
          productTitle: '$p.title', productImage: '$p.image',
          critical: { $lte: ['$quantity', 0] },
        },
      },
      { $sort: { quantity: 1, updatedAt: -1 } },
      { $limit: 200 },
    ]);
    res.status(200).json({ total: rows.length, alerts: rows });
  } catch (error) {
    logger.error({ err: error }, 'Warehouse alerts error');
    next(error);
  }
});

// GET /api/warehouse/ledger — this warehouse's stock movement history.
router.get('/ledger', protect, warehouse, async (req, res, next) => {
  try {
    const w = await myWarehouse(req, res);
    if (!w) return;

    const rows = await StockTransaction.aggregate([
      { $match: { warehouseId: w._id } },
      { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'warehouses', localField: 'oppositeWarehouseId', foreignField: '_id', as: 'opposite' } },
      { $unwind: { path: '$opposite', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          type: 1, variantKey: 1, quantityDelta: 1, balanceAfter: 1, note: 1, transferId: 1, createdAt: 1,
          productTitle: { $ifNull: ['$product.title', null] },
          oppositeWarehouseName: { $ifNull: ['$opposite.name', null] },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
    ]);
    res.status(200).json({ transactions: rows });
  } catch (error) {
    logger.error({ err: error }, 'Warehouse ledger error');
    next(error);
  }
});

// GET /api/warehouse/other-warehouses — destination picker for transfers.
router.get('/other-warehouses', protect, warehouse, async (req, res, next) => {
  try {
    const w = await myWarehouse(req, res);
    if (!w) return;
    const list = await Warehouse.find({ _id: { $ne: w._id }, isActive: true })
      .sort({ name: 1 })
      .select('name code city state')
      .lean();
    res.status(200).json({ warehouses: list });
  } catch (error) {
    logger.error({ err: error }, 'Warehouse picker error');
    next(error);
  }
});

// POST /api/warehouse/transfer — move stock OUT of this warehouse to another.
router.post('/transfer', protect, warehouse, staffActionGuard, auditLogMiddleware('TRANSFER_STOCK', 'StockTransaction'), async (req, res, next) => {
  try {
    const w = await myWarehouse(req, res);
    if (!w) return;

    const { productId, variantKey = null, quantity, toWarehouseId, note = '' } = req.body;
    if (!productId || !toWarehouseId) {
      return res.status(400).json({ message: 'productId and toWarehouseId are required' });
    }
    if (!isValidId(productId) || !isValidId(toWarehouseId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: 'quantity must be a positive integer' });
    }

    const product = await require('../models/Product').findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.variants && product.variants.length > 0) {
      const validKeys = product.variants.map(buildVariantKey);
      if (!variantKey || !validKeys.includes(variantKey)) {
        return res.status(400).json({ message: 'This product has variants; provide a valid variantKey' });
      }
    } else if (variantKey) {
      return res.status(400).json({ message: 'This product has no variants; transfer without variantKey' });
    }

    const result = await transferStock({
      productId, variantKey: variantKey || null, quantity: qty,
      fromWarehouseId: w._id, toWarehouseId, performedBy: req.user._id, note,
    });

    res.status(200).json({
      message: `${qty} unit(s) transferred ${w.code} → stock out`,
      transferId: result.transferId,
      sourceBalance: result.sourceBalance,
    });
  } catch (error) {
    if (/insufficient/i.test(error.message || '')) {
      return res.status(400).json({ message: error.message });
    }
    logger.error({ err: error }, 'Warehouse transfer error');
    next(error);
  }
});

module.exports = router;