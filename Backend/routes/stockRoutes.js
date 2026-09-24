const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const StockTransaction = require('../models/StockTransaction');
const Warehouse = require('../models/Warehouse');
const { protect, admin } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { adminMutateGuard } = require('../utils/routeLimiters');
const { transferStock, setWarehouseQuantity, recordTransaction } = require('../utils/inventory');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// HELPERS ------------------------------------------------------------------
const warehouseBrief = async (id) => {
  const w = await Warehouse.findById(id).select('name code').lean();
  return w || null;
};

// ADMIN: ledger with filters.
//   GET /ledger                     -> latest 100 movements across everything
//   GET /ledger?warehouse=ID        -> only that warehouse
//   GET /ledger?product=ID          -> only that product
//   GET /ledger?search=q            -> product-title search
router.get('/ledger', protect, admin, async (req, res, next) => {
  try {
    const match = {};
    const lookups = [];

    if (req.query.warehouse) {
      if (!isValidId(req.query.warehouse)) return res.status(400).json({ message: 'Invalid warehouse ID' });
      match.warehouseId = new mongoose.Types.ObjectId(req.query.warehouse);
    }
    if (req.query.product) {
      if (!isValidId(req.query.product)) return res.status(400).json({ message: 'Invalid product ID' });
      match.productId = new mongoose.Types.ObjectId(req.query.product);
    }

    const pipeline = [];
    if (Object.keys(match).length) pipeline.push({ $match: match });
    pipeline.push(
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'warehouses',
          localField: 'warehouseId',
          foreignField: '_id',
          as: 'warehouse',
        },
      },
      { $unwind: { path: '$warehouse', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'warehouses',
          localField: 'oppositeWarehouseId',
          foreignField: '_id',
          as: 'oppositeWarehouse',
        },
      },
      { $unwind: { path: '$oppositeWarehouse', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          type: 1,
          variantKey: 1,
          quantityDelta: 1,
          balanceAfter: 1,
          note: 1,
          transferId: 1,
          createdAt: 1,
          productTitle: { $ifNull: ['$product.title', null] },
          warehouseName: { $ifNull: ['$warehouse.name', null] },
          warehouseCode: { $ifNull: ['$warehouse.code', null] },
          oppositeWarehouseName: { $ifNull: ['$oppositeWarehouse.name', null] },
          oppositeWarehouseCode: { $ifNull: ['$oppositeWarehouse.code', null] },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
    );

    if (req.query.search) {
      pipeline.splice(1, 0, { $match: { productTitle: { $regex: req.query.search, $options: 'i' } } });
    }

    const [rows, warehouses] = await Promise.all([
      StockTransaction.aggregate(pipeline),
      Warehouse.find({}).select('name code').lean(),
    ]);

    res.status(200).json({ transactions: rows, warehouses });
  } catch (error) {
    logger.error({ err: error }, 'Stock ledger error');
    next(error);
  }
});

// ADMIN: list warehouses for the transfer picker (active first).
router.get('/warehouses', protect, admin, async (req, res, next) => {
  try {
    const list = await Warehouse.find({}).sort({ isActive: -1, name: 1 }).select('name code city state isActive').lean();
    res.status(200).json({ warehouses: list });
  } catch (error) {
    logger.error({ err: error }, 'Warehouse picker error');
    next(error);
  }
});

// ADMIN: transfer stock between two warehouses.
//   POST /transfer  { productId, variantKey?, quantity, fromWarehouseId, toWarehouseId, note? }
router.post('/transfer', protect, admin, adminMutateGuard, auditLogMiddleware('TRANSFER_STOCK', 'StockTransaction'), async (req, res, next) => {
  try {
    const { productId, variantKey = null, quantity, fromWarehouseId, toWarehouseId, note = '' } = req.body;
    if (!productId || !fromWarehouseId || !toWarehouseId) {
      return res.status(400).json({ message: 'productId, fromWarehouseId and toWarehouseId are required' });
    }
    if (!isValidId(productId) || !isValidId(fromWarehouseId) || !isValidId(toWarehouseId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: 'quantity must be a positive integer' });
    }
    if (fromWarehouseId === toWarehouseId) {
      return res.status(400).json({ message: 'Source and destination must be different warehouses' });
    }

    const [product, fromW, toW] = await Promise.all([
      require('../models/Product').findById(productId),
      Warehouse.findById(fromWarehouseId),
      Warehouse.findById(toWarehouseId),
    ]);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (!fromW) return res.status(404).json({ message: 'Source warehouse not found' });
    if (!toW) return res.status(404).json({ message: 'Destination warehouse not found' });

    // variant products must transfer a real variant key
    if (product.variants && product.variants.length > 0) {
      const { buildVariantKey } = require('../utils/variants');
      const validKeys = product.variants.map(buildVariantKey);
      if (!variantKey || !validKeys.includes(variantKey)) {
        return res.status(400).json({ message: 'This product has variants; provide a valid variantKey' });
      }
    } else if (variantKey) {
      return res.status(400).json({ message: 'This product has no variants; transfer without variantKey' });
    }

    const result = await transferStock({
      productId, variantKey: variantKey || null, quantity: qty,
      fromWarehouseId, toWarehouseId, performedBy: req.user._id, note,
    });

    res.status(200).json({
      message: `${qty} unit(s) transferred ${fromW.code} → ${toW.code}`,
      transferId: result.transferId,
      sourceBalance: result.sourceBalance,
    });
  } catch (error) {
    // insufficient stock & same-warehouse guard surfaces as a client 400
    if (/insufficient/i.test(error.message || '')) {
      return res.status(400).json({ message: error.message });
    }
    logger.error({ err: error }, 'Stock transfer error');
    next(error);
  }
});

// ADMIN: manual balanced adjustment at one warehouse (used by the ledger UI's
// "restock here" quick action — keeps a single ledger row per action).
router.post('/adjust', protect, admin, adminMutateGuard, auditLogMiddleware('ADJUST_STOCK', 'StockTransaction'), async (req, res, next) => {
  try {
    const { productId, variantKey = null, warehouseId, quantity, note = '' } = req.body;
    if (!productId || !warehouseId) {
      return res.status(400).json({ message: 'productId and warehouseId are required' });
    }
    if (!isValidId(productId) || !isValidId(warehouseId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({ message: 'quantity must be a non-negative number' });
    }
    if (String(warehouseId).length && !isValidId(warehouseId)) {
      return res.status(400).json({ message: 'Invalid warehouse ID' });
    }

    const product = await require('../models/Product').findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.variants && product.variants.length > 0) {
      const { buildVariantKey } = require('../utils/variants');
      const validKeys = product.variants.map(buildVariantKey);
      if (!variantKey || !validKeys.includes(variantKey)) {
        return res.status(400).json({ message: 'This product has variants; provide a valid variantKey' });
      }
    } else if (variantKey) {
      return res.status(400).json({ message: 'This product has no variants' });
    }

    await setWarehouseQuantity({
      productId, warehouseId, variantKey: variantKey || null, quantity: qty,
      performedBy: req.user._id, note: note || 'manual adjustment',
    });
    res.status(200).json({ message: 'Stock adjusted', quantity: qty });
  } catch (error) {
    logger.error({ err: error }, 'Stock adjust error');
    next(error);
  }
});

module.exports = router;