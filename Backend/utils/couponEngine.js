const Product = require('../models/Product');
const Coupon = require('../models/Coupon');

// Single source of truth for coupon evaluation. BOTH the checkout preview
// (POST /api/coupons/validate) and the charge-time path (paymentRoutes
// create-order) must run through these functions so a coupon can never look
// valid to the user and then be rejected at payment time (or vice-versa).
//
// invariants:
//   - discount is computed in integer paise (no float drift)
//   - category/product/exclusion rules are enforced with LIVE product data
//   - exactly ONE coupon may be applied to an order (no stacking)
let computeDiscountPaise = (coupon, orderPaise) => {
  if (!coupon) return 0;
  let discountPaise = 0;
  if (coupon.type === 'percentage') {
    discountPaise = Math.round(orderPaise * (coupon.value / 100));
    if (coupon.maxDiscount) {
      discountPaise = Math.min(discountPaise, Math.round(coupon.maxDiscount * 100));
    }
  } else {
    discountPaise = Math.min(Math.round(coupon.value * 100), orderPaise);
  }
  return discountPaise;
};

// items: [{ productId }] from the client cart
// productCategories: Map<productId-string, category-string> (server-looked-up)
async function resolveItemCategories(items, productCategories = new Map()) {
  const ids = (items || [])
    .map((i) => i?.productId)
    .filter(Boolean)
    .filter((id) => !productCategories.has(String(id)));
  if (ids.length === 0) return productCategories;
  const prods = await Product.find({ _id: { $in: ids } }).select('category').lean();
  prods.forEach((p) => {
    if (!productCategories.has(String(p._id))) productCategories.set(String(p._id), p.category);
  });
  return productCategories;
}

// Evaluates every business rule EXCEPT per-user usage limits (those need the
// user's usage history and are checked by canUserUse / recordUsage).
async function evaluateCoupon(coupon, { orderAmount, items = [], productCategories = new Map() }) {
  if (!coupon) return { valid: false, message: 'Invalid or expired coupon code' };
  if (!coupon.isActive) return { valid: false, message: 'Invalid or expired coupon code' };

  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validUntil) {
    return { valid: false, message: 'Invalid or expired coupon code' };
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: 'Coupon usage limit reached' };
  }

  if (orderAmount < coupon.minOrderAmount) {
    return { valid: false, message: `Minimum order amount of ₹${coupon.minOrderAmount} required` };
  }

  const cats = await resolveItemCategories(items, productCategories);

  // Categories: need at least one matching category among live cart products.
  if (coupon.applicableCategories.length > 0) {
    const hasCategory = (items || []).some((item) => {
      const cat = cats.get(String(item?.productId));
      return cat && coupon.applicableCategories.includes(cat);
    });
    if (!hasCategory) {
      return { valid: false, message: 'Coupon not applicable to items in your cart' };
    }
  }

  // Products: at least one cart item must be an applicable product.
  if (coupon.applicableProducts.length > 0) {
    const hasValidProduct = (items || []).some((item) =>
      coupon.applicableProducts.some((pid) => pid.toString() === String(item?.productId))
    );
    if (!hasValidProduct) {
      return { valid: false, message: 'Coupon not applicable to items in your cart' };
    }
  }

  // Exclusions: NO cart item may be excluded.
  if (coupon.excludedProducts.length > 0) {
    const hasExcluded = (items || []).some((item) =>
      coupon.excludedProducts.some((pid) => pid.toString() === String(item?.productId))
    );
    if (hasExcluded) {
      return { valid: false, message: 'Coupon not valid for some items in your cart' };
    }
  }

  const orderPaise = Math.round(orderAmount * 100);
  const discountPaise = computeDiscountPaise(coupon, orderPaise);

  return {
    valid: true,
    discountPaise,
    discount: discountPaise / 100,
    finalAmountPaise: orderPaise - discountPaise,
    finalAmount: (orderPaise - discountPaise) / 100,
  };
}

// Charge-time wrapper: same rules + per-user usage limit. Mirror of /validate
// one-for-one (preview must equal charge).
async function applyCouponAtCheckout(coupon, userId, { orderAmount, items = [], productCategories = new Map() }) {
  if (!coupon) return { valid: false, message: 'Invalid coupon code' };
  if (!coupon.canUserUse(userId)) {
    return { valid: false, message: 'You have already used this coupon maximum times' };
  }
  return evaluateCoupon(coupon, { orderAmount, items, productCategories });
}

// Auto-apply: among all currently-active coupons, pick the one that saves the
// customer the most — with usage limits and applicability live-checked against
// the cart. Returns the winning coupon (or null) and its discount.
async function findBestCoupon({ userId, orderAmount, items = [] }) {
  const active = await Coupon.find({
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  });

  const productCategories = await resolveItemCategories(items);

  let best = null;
  let bestPaise = 0;

  for (const coupon of active) {
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) continue;
    if (userId != null && !coupon.canUserUse(userId)) continue;
    const check = await evaluateCoupon(coupon, { orderAmount, items, productCategories });
    if (check.valid && check.discountPaise > bestPaise) {
      bestPaise = check.discountPaise;
      best = coupon;
    }
  }

  if (!best) return { found: false, coupon: null, discount: 0 };
  const check = await evaluateCoupon(best, { orderAmount, items, productCategories });
  return {
    found: true,
    coupon: {
      code: best.code,
      type: best.type,
      value: best.value,
      discount: check.discount,
      finalAmount: check.finalAmount,
    },
    discount: check.discount,
  };
}

// Returns ALL eligible coupons for the given cart, sorted by discount descending.
// Used for "Available Coupons" modal/dropdown.
async function findAvailableCoupons({ userId, orderAmount, items = [] }) {
  const active = await Coupon.find({
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  });

  const productCategories = await resolveItemCategories(items);

  const eligible = [];

  for (const coupon of active) {
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) continue;
    if (userId != null && !coupon.canUserUse(userId)) continue;
    const check = await evaluateCoupon(coupon, { orderAmount, items, productCategories });
    if (check.valid) {
      eligible.push({
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscount: coupon.maxDiscount,
        validUntil: coupon.validUntil,
        applicableCategories: coupon.applicableCategories,
        applicableProducts: coupon.applicableProducts,
        excludedProducts: coupon.excludedProducts,
        discount: check.discount,
        finalAmount: check.finalAmount,
      });
    }
  }

  // Sort by discount descending (highest savings first)
  eligible.sort((a, b) => b.discount - a.discount);

  return { coupons: eligible };
}

module.exports = {
  computeDiscountPaise,
  evaluateCoupon,
  applyCouponAtCheckout,
  findBestCoupon,
  findAvailableCoupons,
  resolveItemCategories,
};