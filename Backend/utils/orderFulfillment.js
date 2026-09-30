const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');
const { logger } = require('./logger');
const { buildVariantKey } = require('./variants');

// Shared order finalisation used by BOTH the client verify-payment endpoint and the
// Razorpay webhook, so a captured payment is reconciled exactly once no matter which
// path wins the race.
//
//   - Atomic Pending -> Paid transition (only one concurrent caller can win).
//   - Removes the TTL expiry so a paid order is never auto-purged.
//   - Reserves stock per-item with an atomic $gte filter; tracked (numeric) stock only.
//   - Synchronizes warehouse InventoryItem rows and writes StockTransaction audit rows.
//   - If ANY tracked item can no longer be fulfilled, ALL decrements applied so far are
//     rolled back (compensating $inc) so stock is never left partially consumed, the
//     order is flagged stockShortfall, and the admin can refund it.
//
// Returns { finalised, order, shortfall }:
//   finalised=false  → another request/webhook already finalised it (idempotent replay).
//   finalised=true   → this caller won; order is the finalised document.
async function finalisePaidOrder(order, { paymentId } = {}) {
  const setFields = {
    paymentStatus: 'Paid',
    paidAt: new Date(),
    status: 'Processing',
  };
  if (paymentId) setFields.razorpayPaymentId = paymentId;

  const finalisedOrder = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'Pending' },
    { $set: setFields, $unset: { expireAt: 1 } },
    { returnDocument: 'after' }
  );

  if (!finalisedOrder) {
    return { finalised: false, order };
  }

  const productIds = finalisedOrder.orderItems.map(item => item.productId);
  // .lean() skips Mongoose schema-default hydration so legacy products that genuinely
  // have no countInStock field stay `undefined` and are correctly NOT treated as tracked.
  const stockProducts = await Product.find({ _id: { $in: productIds } }).lean();
  const stockByProductId = new Map(
    stockProducts.map(p => [p._id.toString(), p.countInStock])
  );

  // Reserve per item and track exactly which decrements were applied, so a partial
  // failure can be cleanly rolled back (bulkWrite does not expose per-op results, and
  // an unmatched $gte filter is not an error — so we run each op individually).
  const appliedDecrements = [];
  const appliedWarehouseDecrements = [];
  let stockReserved = true;

  for (const item of finalisedOrder.orderItems) {
    // Variant-aware reservation: when the order line carries a variantKey and the
    // product still has that variant, decrement the VARIANT stock atomically
    // (same $gte + compensating rollback pattern as flat stock).
    if (item.variantKey) {
      const product = stockProducts.find(p => p._id.toString() === item.productId.toString());
      const variant = product?.variants?.find((v) => buildVariantKey(v) === item.variantKey);
      if (variant) {
        const result = await Product.updateOne(
          { _id: item.productId, 'variants.size': variant.size || null, 'variants.color': variant.color || null, 'variants.stock': { $gte: item.quantity } },
          { $inc: { 'variants.$.stock': -item.quantity } }
        );
        if (result.modifiedCount === 1) {
          appliedDecrements.push({ productId: item.productId, quantity: item.quantity, variantKey: item.variantKey });

          // Synchronize warehouse InventoryItem rows
          let remainingToDeduct = item.quantity;
          const invRows = await InventoryItem.find({ productId: item.productId, variantKey: item.variantKey, quantity: { $gt: 0 } }).sort({ quantity: -1 });
          for (const row of invRows) {
            if (remainingToDeduct <= 0) break;
            const take = Math.min(row.quantity, remainingToDeduct);
            row.quantity -= take;
            await row.save();
            remainingToDeduct -= take;
            appliedWarehouseDecrements.push({ rowId: row._id, quantity: take, warehouseId: row.warehouseId, productId: item.productId, variantKey: item.variantKey });
            await StockTransaction.create({
              type: 'adjustment',
              productId: item.productId,
              warehouseId: row.warehouseId,
              variantKey: item.variantKey,
              quantityDelta: -take,
              balanceAfter: row.quantity,
              note: `Order sale #${finalisedOrder._id}`
            }).catch(() => {});
          }
          continue;
        }
        stockReserved = false;
        break;
      }
      // Variant disappeared between checkout and verify — fall through to flat
      // stock handling so the order can still be fulfilled or flagged.
    }

    const stock = stockByProductId.get(item.productId.toString());
    if (stock == null) continue; // legacy product, untracked stock

    const result = await Product.updateOne(
      { _id: item.productId, countInStock: { $gte: item.quantity } },
      { $inc: { countInStock: -item.quantity } }
    );

    if (result.modifiedCount === 1) {
      appliedDecrements.push({ productId: item.productId, quantity: item.quantity });

      // Synchronize warehouse InventoryItem rows
      let remainingToDeduct = item.quantity;
      const invRows = await InventoryItem.find({ productId: item.productId, variantKey: null, quantity: { $gt: 0 } }).sort({ quantity: -1 });
      for (const row of invRows) {
        if (remainingToDeduct <= 0) break;
        const take = Math.min(row.quantity, remainingToDeduct);
        row.quantity -= take;
        await row.save();
        remainingToDeduct -= take;
        appliedWarehouseDecrements.push({ rowId: row._id, quantity: take, warehouseId: row.warehouseId, productId: item.productId, variantKey: null });
        await StockTransaction.create({
          type: 'adjustment',
          productId: item.productId,
          warehouseId: row.warehouseId,
          variantKey: null,
          quantityDelta: -take,
          balanceAfter: row.quantity,
          note: `Order sale #${finalisedOrder._id}`
        }).catch(() => {});
      }
    } else {
      stockReserved = false;
      break; // stop trying to reserve further stock for this order
    }
  }

  if (!stockReserved) {
    // Compensate: undo every decrement we applied so stock is never partially consumed
    // for an order that cannot be fully fulfilled.
    for (const d of appliedDecrements) {
      if (d.variantKey) {
        const parsed = d.variantKey.split('|');
        await Product.updateOne(
          { _id: d.productId, 'variants.size': parsed[0] || null, 'variants.color': parsed[1] || null },
          { $inc: { 'variants.$.stock': d.quantity } }
        );
      } else {
        await Product.updateOne(
          { _id: d.productId },
          { $inc: { countInStock: d.quantity } }
        );
      }
    }
    for (const wd of appliedWarehouseDecrements) {
      await InventoryItem.findByIdAndUpdate(wd.rowId, { $inc: { quantity: wd.quantity } });
    }
    await Order.findByIdAndUpdate(order._id, { stockShortfall: true });
    return { finalised: true, order: finalisedOrder, shortfall: true };
  }

  // Debit coupon usage exactly once, on the clean Paid path only (never on
  // shortfall — that order goes to refund, not fulfilment). Best-effort: a
  // debit failure must never roll back an already-captured payment; the
  // mismatch stays visible in logs for admin reconciliation.
  if (finalisedOrder.couponCode) {
    try {
      const coupon = await Coupon.findOne({ code: finalisedOrder.couponCode });
      if (coupon) {
        const debited = await coupon.recordUsage(finalisedOrder.userId);
        if (!debited) {
          logger.warn({ orderId: order._id }, 'Coupon usage limit hit concurrently — paid order kept, needs admin review');
        }
      } else {
        logger.warn({ orderId: order._id }, 'Paid order references unknown coupon');
      }
    } catch (couponError) {
      logger.error({ err: couponError, orderId: order._id }, 'Coupon usage debit failed');
    }
  }

  return { finalised: true, order: finalisedOrder, shortfall: false };
}

/**
 * Restores product stock and warehouse inventory items when an order is cancelled or refunded.
 * Idempotent: checks if stock was already restored (order.stockRestored).
 * Only restores if order was Paid and had not experienced a stockShortfall.
 */
async function restoreOrderStock(order) {
  if (!order || order.stockRestored) {
    return { restored: false, reason: 'already_restored' };
  }

  // If the order never had stock successfully reserved (e.g. pending or shortfall), skip
  if (order.paymentStatus !== 'Paid' || order.stockShortfall) {
    return { restored: false, reason: 'no_stock_reserved' };
  }

  for (const item of (order.orderItems || [])) {
    if (item.variantKey) {
      const parsed = item.variantKey.split('|');
      await Product.updateOne(
        { _id: item.productId, 'variants.size': parsed[0] || null, 'variants.color': parsed[1] || null },
        { $inc: { 'variants.$.stock': item.quantity } }
      );
      // Restore warehouse row
      const invRow = await InventoryItem.findOne({ productId: item.productId, variantKey: item.variantKey });
      if (invRow) {
        invRow.quantity += item.quantity;
        await invRow.save();
        await StockTransaction.create({
          type: 'adjustment',
          productId: item.productId,
          warehouseId: invRow.warehouseId,
          variantKey: item.variantKey,
          quantityDelta: item.quantity,
          balanceAfter: invRow.quantity,
          note: `Order cancellation restock #${order._id}`
        }).catch(() => {});
      }
    } else {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { countInStock: item.quantity } }
      );
      // Restore warehouse row
      const invRow = await InventoryItem.findOne({ productId: item.productId, variantKey: null });
      if (invRow) {
        invRow.quantity += item.quantity;
        await invRow.save();
        await StockTransaction.create({
          type: 'adjustment',
          productId: item.productId,
          warehouseId: invRow.warehouseId,
          variantKey: null,
          quantityDelta: item.quantity,
          balanceAfter: invRow.quantity,
          note: `Order cancellation restock #${order._id}`
        }).catch(() => {});
      }
    }
  }

  // Release coupon usage if coupon was applied
  if (order.couponCode) {
    try {
      const coupon = await Coupon.findOne({ code: order.couponCode });
      if (coupon && typeof coupon.releaseUsage === 'function') {
        await coupon.releaseUsage(order.userId);
      }
    } catch (couponError) {
      logger.error({ err: couponError, orderId: order._id }, 'Coupon usage release failed');
    }
  }

  await Order.findByIdAndUpdate(order._id, { $set: { stockRestored: true } });
  return { restored: true };
}

module.exports = { finalisePaidOrder, restoreOrderStock };