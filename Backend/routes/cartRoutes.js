const express = require('express');
const { logger } = require('../utils/logger');
const mongoose = require('mongoose');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id));

// Server-side cart sync. Items are stored as { productId, quantity } and enriched
// with live product data on read, so the client always renders current prices and
// stock. This lets a user's cart survive across devices.

// Convert raw cart items into frontend-shaped product objects.
// Variant carts store { productId, variantKey, quantity } — variantKey is the
// canonical "size|color" wire key (see utils/variants.js). Plain items have no
// variantKey and behave exactly as before (V1 compatibility).
const hydrateItems = (items, products) =>
  items
    .map((item) => {
      const product = products.find((p) => p._id.toString() === (item.productId._id || item.productId).toString());
      if (!product) return null; // product was deleted; drop it
      const base = {
        _id: product._id,
        title: product.title,
        price: product.price,
        image: product.image,
        category: product.category,
        description: product.description,
        countInStock: product.countInStock,
        rating: product.rating,
        quantity: item.quantity,
      };
      if (item.variantKey) {
        const variant = (product.variants || []).find((v) => `${v.size || ''}|${v.color || ''}` === item.variantKey);
        base.variantKey = item.variantKey;
        base.variantSize = variant ? (variant.size || null) : null;
        base.variantColor = variant ? (variant.color || null) : null;
        // Effective unit price includes the variant priceAdjustment; stock is
        // the variant's own stock so quantity caps match checkout rules.
        if (variant) {
          base.price = product.price + (Number(variant.priceAdjustment) || 0);
          base.countInStock = variant.stock;
        }
      }
      return base;
    })
    .filter(Boolean);

// GET /api/cart — fetch the user's saved cart (enriched with live product data)
router.get('/', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart || cart.items.length === 0) {
      return res.status(200).json({ items: [] });
    }

    const productIds = cart.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    res.status(200).json({ items: hydrateItems(cart.items, products) });
  } catch (error) {
    logger.error({ err: error }, 'Cart fetch error:');
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

// POST /api/cart/merge — merge the client's local cart into the server cart and
// return the merged, hydrated result. Used on login so a guest's items survive.
router.post('/merge', protect, async (req, res) => {
  try {
    const localItems = Array.isArray(req.body.items) ? req.body.items : [];
    // Caps mirror the payment limit (qty 1-20) so a stored cart can never
    // hold a quantity that checkout would reject; 100 items bounds the write.
    // variantKey (optional string, max 80 chars) distinguishes variants of the
    // same product; merge keys on productId + variantKey.
    const normalized = localItems
      .slice(0, 100)
      .map((item) => ({
        productId: item.productId || item._id || item.id,
        quantity: Math.min(20, Math.max(1, Math.floor(Number(item.quantity)) || 1)),
        variantKey: typeof item.variantKey === 'string' && item.variantKey.length <= 80 ? item.variantKey : null,
      }))
      .filter((item) => item.productId && isValidId(item.productId));

    if (normalized.length === 0) {
      return res.status(200).json({ items: [] });
    }

    // Reject unknown product ids before they pollute the stored cart.
    // Single fetch reused for both validation and hydration (no double query).
    const fetchedProducts = await Product.find({ _id: { $in: normalized.map((i) => i.productId) } })
      .lean();
    const validSet = new Set(fetchedProducts.map((p) => p._id.toString()));
    const validItems = normalized.filter((i) => validSet.has(i.productId.toString()));

    const cart = await Cart.findOneAndUpdate(
      { userId: req.user._id },
      {},
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Merge: sum quantities for items already present (same product + variant),
    // append new ones.
    const mergedMap = new Map();
    const lineKey = (it) => `${it.productId.toString()}::${it.variantKey || ''}`;
    for (const item of cart.items) {
      mergedMap.set(lineKey(item), { productId: item.productId, quantity: item.quantity, variantKey: item.variantKey || null });
    }
    for (const item of validItems) {
      const key = lineKey(item);
      const existing = mergedMap.get(key);
      if (existing) {
        // Keep the merged total within the payment limit (qty <= 20).
        existing.quantity = Math.min(20, existing.quantity + item.quantity);
      } else {
        mergedMap.set(key, { productId: item.productId, quantity: item.quantity, variantKey: item.variantKey });
      }
    }

    cart.items = Array.from(mergedMap.values());
    await cart.save();

    // Reuse the validation fetch; only fetch cart items not already loaded
    // (pre-existing items absent from this merge request).
    const loadedMap = new Map(fetchedProducts.map((p) => [p._id.toString(), p]));
    const missingIds = cart.items
      .map((i) => i.productId.toString())
      .filter((id) => !loadedMap.has(id));
    let allProducts = fetchedProducts;
    if (missingIds.length > 0) {
      const missing = await Product.find({ _id: { $in: missingIds } }).lean();
      allProducts = [...fetchedProducts, ...missing];
    }
    res.status(200).json({ items: hydrateItems(cart.items, allProducts) });
  } catch (error) {
    logger.error({ err: error }, 'Cart merge error:');
    res.status(500).json({ message: 'Failed to sync cart' });
  }
});

// PUT /api/cart — replace the server cart wholesale with the client's current
// items (called after every local cart mutation while logged in).
router.put('/', protect, async (req, res) => {
  try {
    const localItems = Array.isArray(req.body.items) ? req.body.items : [];
    // Caps mirror the payment limit (qty 1-20) so a stored cart can never
    // hold a quantity that checkout would reject; 100 items bounds the write.
    const normalized = localItems
      .slice(0, 100)
      .map((item) => ({
        productId: item.productId || item._id || item.id,
        quantity: Math.min(20, Math.max(1, Math.floor(Number(item.quantity)) || 1)),
        variantKey: typeof item.variantKey === 'string' && item.variantKey.length <= 80 ? item.variantKey : null,
      }))
      .filter((item) => item.productId && isValidId(item.productId));

    // Drop items whose products no longer exist.
    const products = await Product.find({ _id: { $in: normalized.map((i) => i.productId) } }).lean();
    const validSet = new Set(products.map((p) => p._id.toString()));
    const validItems = normalized.filter((i) => validSet.has(i.productId.toString()));

    await Cart.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { items: validItems } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ items: hydrateItems(validItems, products) });
  } catch (error) {
    logger.error({ err: error }, 'Cart sync error:');
    res.status(500).json({ message: 'Failed to sync cart' });
  }
});

// DELETE /api/cart — clear the server cart (after order placement, or on logout).
router.delete('/', protect, async (req, res) => {
  try {
    await Cart.deleteOne({ userId: req.user._id });
    res.status(200).json({ message: 'Cart cleared' });
  } catch (error) {
    logger.error({ err: error }, 'Cart clear error:');
    res.status(500).json({ message: 'Failed to clear cart' });
  }
});

module.exports = router;