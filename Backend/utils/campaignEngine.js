const Campaign = require('../models/Campaign');

// Campaign engine: the single place that decides whether a campaign applies to a
// cart and how much it discounts. Mirrors the coupon engine's philosophy — the
// preview endpoint and charge-time validation share identical logic.
//
// Currency convention (matches coupon engine + payment routes): all money math is
// done in integer paise; converted to rupees only at the response boundary.

const asPaise = (n) => Math.round(Number(n || 0) * 100);

// Is this campaign live right now? Pass `now` for deterministic tests.
const isCampaignActive = (campaign, now = new Date()) => {
  if (!campaign) return false;
  if (!campaign.isActive) return false;
  const t = new Date(now).getTime();
  return t >= new Date(campaign.startDate).getTime() && t <= new Date(campaign.endDate).getTime();
};

// Does a product qualify for this campaign? Scope rule:
//   - empty eligibleCategories AND empty eligibleProductIds  -> everything
//   - otherwise category match OR explicit product id match.
const productEligible = (campaign, productId, category) => {
  const cats = campaign.eligibleCategories || [];
  const prods = campaign.eligibleProductIds || [];
  if (cats.length === 0 && prods.length === 0) return true;
  const idHit = prods.some((pid) => String(pid) === String(productId));
  const catHit =
    category &&
    cats.some((c) => String(c).toLowerCase() === String(category).toLowerCase());
  return idHit || catHit;
};

// Single-line discount (in rupees to two decimals) for a percentage campaign.
// Fixed campaigns distribute one flat amount across the cart at checkout time,
// so their per-line helper is 0 everywhere but the checkout aggregate.
const lineDiscount = ({ campaign, price, quantity }) => {
  if (!campaign || campaign.discountType === 'fixed') return 0;
  const pct = Number(campaign.discountValue) / 100;
  return Math.round(Number(price) * quantity * pct * 100) / 100;
};

// Evaluate every live campaign against a cart and return the single best one.
// Returns a "plain" shaped campaign (id/name/discount definition) that the
// checkout can snapshot on the Order, plus the discount in paise.
const findBestCampaignForCart = async ({ items, productCategories, now = new Date() }) => {
  // items: [{ productId, quantity, price /* rupees */, category? }]
  if (!Array.isArray(items) || items.length === 0) return null;

  const live = await Campaign.find({ isActive: true }).lean();
  const candidates = live.filter((c) => isCampaignActive(c, now));
  if (candidates.length === 0) return null;

  const orderAmountPaise = items.reduce((s, it) => s + asPaise(it.price) * Number(it.quantity), 0);

  let best = null; // { discountPaise, campaign, eligibleCount }

  for (const campaign of candidates) {
    if (orderAmountPaise < asPaise(campaign.minOrderAmount || 0)) continue;

    const eligibleItems = items.filter((it) =>
      productEligible(campaign, it.productId, it.category || productCategories?.get(String(it.productId)))
    );
    if (eligibleItems.length === 0) continue;

    if (campaign.discountType === 'fixed') {
      const discountPaise = asPaise(campaign.discountValue);
      if (discountPaise <= 0) continue;
      if (!best || discountPaise > best.discountPaise) {
        best = { discountPaise, campaign, eligibleCount: eligibleItems.length };
      }
      continue;
    }

    const lineTotal = eligibleItems.reduce((s, it) => s + asPaise(lineDiscount({ campaign, price: it.price, quantity: it.quantity })), 0);
    let discountPaise = lineTotal;
    if (campaign.maxDiscount != null) {
      discountPaise = Math.min(discountPaise, asPaise(campaign.maxDiscount));
    }
    if (discountPaise <= 0) continue;
    if (!best || discountPaise > best.discountPaise) {
      best = { discountPaise, campaign, eligibleCount: eligibleItems.length };
    }
  }

  return best;
};

// Checkout-time application. cartTotalRupees is the pre-discount order total.
// Returns finalAmount + discount both in rupees and a snapshot-able campaign.
const applyCampaignAtCheckout = async ({ cartTotalRupees, items, productCategories, now = new Date() }) => {
  const base = Number(cartTotalRupees) || 0;
  if (base <= 0) {
    return { valid: false, message: 'Order total must be greater than zero', discount: 0, finalAmount: 0, campaign: null, applied: false };
  }

  const best = await findBestCampaignForCart({ items, productCategories, now });
  if (!best) {
    return { valid: true, discount: 0, finalAmount: base, campaign: null, applied: false };
  }

  const discount = Math.round((best.discountPaise / 100) * 100) / 100;
  const finalAmount = Math.round((base - discount) * 100) / 100;

  return {
    valid: true,
    discount,
    finalAmount: Math.max(0, finalAmount),
    campaign: {
      _id: best.campaign._id,
      name: best.campaign.name,
      slug: best.campaign.slug || null,
      discountType: best.campaign.discountType,
      discountValue: best.campaign.discountValue,
      maxDiscount: best.campaign.maxDiscount ?? null,
      minOrderAmount: best.campaign.minOrderAmount || 0,
      bannerText: best.campaign.bannerText || '',
      bannerColor: best.campaign.bannerColor || '#0f766e',
    },
    applied: true,
  };
};

module.exports = {
  isCampaignActive,
  productEligible,
  lineDiscount,
  findBestCampaignForCart,
  applyCampaignAtCheckout,
};