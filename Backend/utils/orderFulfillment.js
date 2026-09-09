const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const { logger } = require('./logger');

// Shared order finalisation used by BOTH the client verify-payment endpoint and the
// Razorpay webhook, so a captured payment is reconciled exactly once no matter which
// path wins the race.
//
//   - Atomic Pending -> Paid transition (only one concurrent caller can win).
//   - Removes the TTL expiry so a paid order is never auto-purged.
//   - Reserves stock per-item with an atomic $gte filter; tracked (numeric) stock only.
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
  let stockReserved = true;

  for (const item of finalisedOrder.orderItems) {
    const stock = stockByProductId.get(item.productId.toString());
    if (stock == null) continue; // legacy product, untracked stock

    const result = await Product.updateOne(
      { _id: item.productId, countInStock: { $gte: item.quantity } },
      { $inc: { countInStock: -item.quantity } }
    );

    if (result.modifiedCount === 1) {
      appliedDecrements.push({ productId: item.productId, quantity: item.quantity });
    } else {
      stockReserved = false;
      break; // stop trying to reserve further stock for this order
    }
  }

  if (!stockReserved) {
    // Compensate: undo every decrement we applied so stock is never partially consumed
    // for an order that cannot be fully fulfilled.
    for (const d of appliedDecrements) {
      await Product.updateOne(
        { _id: d.productId },
        { $inc: { countInStock: d.quantity } }
      );
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
        await coupon.recordUsage(finalisedOrder.userId);
      } else {
        logger.warn({ orderId: order._id }, 'Paid order references unknown coupon');
      }
    } catch (couponError) {
      logger.error({ err: couponError, orderId: order._id }, 'Coupon usage debit failed');
    }
  }

  return { finalised: true, order: finalisedOrder, shortfall: false };
}

module.exports = { finalisePaidOrder };