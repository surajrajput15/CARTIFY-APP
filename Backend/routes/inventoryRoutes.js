const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const InventoryItem = require('../models/InventoryItem');
const Warehouse = require('../models/Warehouse');
const { protect, admin } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { adminMutateGuard } = require('../utils/routeLimiters');
const { recomputeAllProducts, setWarehouseQuantity, clearWarehouseRows } = require('../utils/inventory');
const { buildVariantKey } = require('../utils/variants');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ADMIN: inventory alerts (#7). Any InventoryItem row whose quantity is at or
// below its lowStockThreshold triggers an alert. Threshold defaults to 0, so
// empty rows alert by design; a row can opt for a higher threshold so stock
// dips below the useful minimum surface early.
//    GET /inventory/alerts?warehouse=ID   -> optional single-warehouse filter
router.get('/alerts', protect, admin, async (req, res, next) => {
  try {
    const filter = { $expr: { $lte: ['$quantity', '$lowStockThreshold'] } };
    if (req.query.warehouse) {
      if (!isValidId(req.query.warehouse)) {
        return res.status(400).json({ message: 'Invalid warehouse ID' });
      }
      filter.warehouseId = new mongoose.Types.ObjectId(req.query.warehouse);
    }

    const pipeline = [
      { $match: filter },
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
        $lookup: {
          from: 'warehouses',
          localField: 'warehouseId',
          foreignField: '_id',
          as: 'w',
        },
      },
      { $unwind: { path: '$w', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 1, productId: 1, warehouseId: 1, variantKey: 1,
          quantity: 1, lowStockThreshold: 1, createdAt: 1, updatedAt: 1,
          productTitle: '$p.title',
          productImage: '$p.image',
          productCategory: '$p.category',
          productPrice: '$p.price',
          warehouseName: '$w.name',
          warehouseCode: '$w.code',
          critical: { $lte: ['$quantity', 0] },
        },
      },
      { $sort: { quantity: 1, updatedAt: -1 } },
      { $limit: 200 },
    ];

    const rows = await InventoryItem.aggregate(pipeline);
    const allCritical = await InventoryItem.countDocuments({ ...filter, quantity: { $lte: 0 } });

    res.status(200).json({
      total: rows.length,
      criticalCount: allCritical,
      lowCount: rows.length - allCritical,
      alerts: rows,
    });
  } catch (error) {
    logger.error({ err: error }, 'Inventory alerts error');
    next(error);
  }
});

// ADMIN: full ledger of every per-warehouse row, optionally filtered.
//    GET /:warehouseId        -> everything inside one warehouse
//    GET /:warehouseId?product=ID -> only that product's rows (admin edit view)
//    GET /:warehouseId?search=q   -> product-title search within the warehouse
router.get('/:warehouseId', protect, admin, async (req, res, next) => {
  try {
    if (!isValidId(req.params.warehouseId)) {
      return res.status(400).json({ message: 'Invalid warehouse ID' });
    }
    const filter = { warehouseId: new mongoose.Types.ObjectId(req.params.warehouseId) };

    const pipeline = [
      { $match: filter },
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
          _id: 1, productId: 1, warehouseId: 1, variantKey: 1,
          quantity: 1, lowStockThreshold: 1, createdAt: 1, updatedAt: 1,
          productTitle: '$p.title',
          productImage: '$p.image',
          productCategory: '$p.category',
          productPrice: '$p.price',
          hasVariants: { $gt: [{ $size: { $ifNull: ['$p.variants', []] } }, 0] },
        },
      },
    ];

    if (req.query.product) {
      const pid = req.query.product;
      if (!isValidId(pid)) return res.status(400).json({ message: 'Invalid product ID' });
      pipeline[0].$match.productId = new mongoose.Types.ObjectId(pid);
    }
    if (req.query.search) {
      pipeline.push({ $match: { productTitle: { $regex: req.query.search, $options: 'i' } } });
    }
    pipeline.push({ $sort: { createdAt: -1 } });

    const [rows, warehouse] = await Promise.all([
      InventoryItem.aggregate(pipeline),
      Warehouse.findById(req.params.warehouseId).select('name code').lean(),
    ]);
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });

    res.status(200).json({ warehouse, items: rows });
  } catch (error) {
    logger.error({ err: error }, 'Inventory list error');
    next(error);
  }
});

// ADMIN: set / upsert one product's quantity at a warehouse.
//    PUT /:warehouseId/product/:productId   { variantKey?, quantity }
router.put('/:warehouseId/product/:productId', protect, admin, adminMutateGuard, auditLogMiddleware('UPDATE_INVENTORY', 'InventoryItem'), async (req, res, next) => {
  try {
    const { warehouseId, productId } = req.params;
    if (!isValidId(warehouseId) || !isValidId(productId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const quantity = Number(req.body.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ message: 'quantity must be a non-negative number' });
    }
    const variantKey = typeof req.body.variantKey === 'string' && req.body.variantKey ? req.body.variantKey : null;

    const [product, warehouse] = await Promise.all([
      require('../models/Product').findById(productId),
      Warehouse.findById(warehouseId),
    ]);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });

    // Guard: variant products only accept rows for a real variant key; non-variant
    // products only accept the base (null) row. Prevents phantom SKUs.
    if (product.variants && product.variants.length > 0) {
      const validKeys = product.variants.map(buildVariantKey);
      if (!variantKey || !validKeys.includes(variantKey)) {
        return res.status(400).json({ message: 'This product has variants; provide a valid variantKey' });
      }
    } else if (variantKey) {
      return res.status(400).json({ message: 'This product has no variants; provide quantity without variantKey' });
    }

    await setWarehouseQuantity({ productId, warehouseId, variantKey, quantity });
    res.status(200).json({ message: 'Stock updated', quantity });
  } catch (error) {
    logger.error({ err: error }, 'Inventory set error');
    next(error);
  }
});

// ADMIN: clear all rows for a product at a warehouse (decommission / restock-out).
router.delete('/:warehouseId/product/:productId', protect, admin, adminMutateGuard, auditLogMiddleware('DELETE_INVENTORY', 'InventoryItem'), async (req, res, next) => {
  try {
    const { warehouseId, productId } = req.params;
    if (!isValidId(warehouseId) || !isValidId(productId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    await clearWarehouseRows({ productId, warehouseId, performedBy: req.user._id, note: 'rows cleared from warehouse' });
    res.status(200).json({ message: 'Warehouse rows cleared' });
  } catch (error) {
    logger.error({ err: error }, 'Inventory clear error');
    next(error);
  }
});

// ADMIN: recompute every Product's sellable stock from inventory rows (migration/heal).
router.post('/recompute', protect, admin, adminMutateGuard, auditLogMiddleware('RECOMPUTE_INVENTORY', 'InventoryItem'), async (req, res, next) => {
  try {
    const result = await recomputeAllProducts();
    res.status(200).json({ message: `Recomputed ${result.updated} products`, updated: result.updated });
  } catch (error) {
    logger.error({ err: error }, 'Inventory recompute error');
    next(error);
  }
});

module.exports = router;