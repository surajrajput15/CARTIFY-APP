const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// Server-side cart sync. Items are stored as { productId, quantity } and enriched
// with live product data on read, so the client always renders current prices and
// stock. This lets a user's cart survive across devices.

// Convert raw cart items into frontend-shaped product objects.
const hydrateItems = (items, products) =>
  items
    .map((item) => {
      const product = products.find((p) => p._id.toString() === item.productId.toString());
      if (!product) return null; // product was deleted; drop it
      return {
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
    console.error('Cart fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

// POST /api/cart/merge — merge the client's local cart into the server cart and
// return the merged, hydrated result. Used on login so a guest's items survive.
router.post('/merge', protect, async (req, res) => {
  try {
    const localItems = Array.isArray(req.body.items) ? req.body.items : [];
    const normalized = localItems
      .map((item) => ({
        productId: item.productId || item._id || item.id,
        quantity: Math.max(1, Math.floor(Number(item.quantity)) || 1),
      }))
      .filter((item) => item.productId);

    if (normalized.length === 0) {
      return res.status(200).json({ items: [] });
    }

    // Reject unknown product ids before they pollute the stored cart.
    const validIds = await Product.find({ _id: { $in: normalized.map((i) => i.productId) } })
      .select('_id')
      .lean();
    const validSet = new Set(validIds.map((p) => p._id.toString()));
    const validItems = normalized.filter((i) => validSet.has(i.productId.toString()));

    const cart = await Cart.findOneAndUpdate(
      { userId: req.user._id },
      {},
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Merge: sum quantities for items already present, append new ones.
    const mergedMap = new Map();
    for (const item of cart.items) {
      mergedMap.set(item.productId.toString(), { productId: item.productId, quantity: item.quantity });
    }
    for (const item of validItems) {
      const key = item.productId.toString();
      const existing = mergedMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        mergedMap.set(key, { productId: item.productId, quantity: item.quantity });
      }
    }

    cart.items = Array.from(mergedMap.values());
    await cart.save();

    const products = await Product.find({ _id: { $in: cart.items.map((i) => i.productId) } }).lean();
    res.status(200).json({ items: hydrateItems(cart.items, products) });
  } catch (error) {
    console.error('Cart merge error:', error);
    res.status(500).json({ message: 'Failed to sync cart' });
  }
});

// PUT /api/cart — replace the server cart wholesale with the client's current
// items (called after every local cart mutation while logged in).
router.put('/', protect, async (req, res) => {
  try {
    const localItems = Array.isArray(req.body.items) ? req.body.items : [];
    const normalized = localItems
      .map((item) => ({
        productId: item.productId || item._id || item.id,
        quantity: Math.max(1, Math.floor(Number(item.quantity)) || 1),
      }))
      .filter((item) => item.productId);

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
    console.error('Cart sync error:', error);
    res.status(500).json({ message: 'Failed to sync cart' });
  }
});

// DELETE /api/cart — clear the server cart (after order placement, or on logout).
router.delete('/', protect, async (req, res) => {
  try {
    await Cart.deleteOne({ userId: req.user._id });
    res.status(200).json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Cart clear error:', error);
    res.status(500).json({ message: 'Failed to clear cart' });
  }
});

module.exports = router;