const express = require('express');
const { logger } = require('../utils/logger');
const mongoose = require('mongoose');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id));

// POST /api/wishlist/add — authenticated user ki wishlist mein product add kare
// Duplicate product add hone se rokta hai (already wishlisted toh message de dega)
// Invalid product ID handle karta hai
router.post('/add', protect, async (req, res) => {
  try {
    const { productId } = req.body;

    // Product ID must be provided and valid format mein ho
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }
    if (!isValidId(productId)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    // Product exist karta hai ya nahi — check kare DB se
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Wishlist entry create/update — unique index se duplicate automatically reject hoga
    const wishlistItem = await Wishlist.findOneAndUpdate(
      { userId: req.user._id, productId },
      { productId, userId: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Agar naya entry bana then success, agar existing tha toh bhi same response
    res.status(200).json({
      success: true,
      message: 'Product added to wishlist',
      product: {
        _id: product._id,
        title: product.title,
        price: product.price,
        image: product.image,
        category: product.category,
        description: product.description,
        countInStock: product.countInStock,
        rating: product.rating,
      }
    });
  } catch (error) {
    // Duplicate key error (E11000) — tabiha duplicate add kiya ja raha hai
    // Unique index ki wajah se, lekin gracefully handle karte hain
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Product already in wishlist' });
    }

    logger.error({ err: error }, 'Wishlist add error:');
    res.status(500).json({ message: 'Failed to add to wishlist' });
  }
});

// POST /api/wishlist/remove — authenticated user ki wishlist se product remove kare
// Sirf apni wishlist se hi remove ho sakta hai (ownership protection)
router.post('/remove', protect, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }
    if (!isValidId(productId)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    // Sirf apni wishlist se delete — userId match karega
    const deleted = await Wishlist.deleteOne({
      userId: req.user._id,
      productId: new mongoose.Types.ObjectId(productId)
    });

    // Agar entry mil gayi toh delete successful, warna bhi gracefully handle
    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      deleted: deleted.deletedCount > 0
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }
    logger.error({ err: error }, 'Wishlist remove error:');
    res.status(500).json({ message: 'Failed to remove from wishlist' });
  }
});

// GET /api/wishlist — current user ki wishlist fetch kare
// Sirf apni wishlist hi dikhega (ownership protection — userId filter)
router.get('/', protect, async (req, res) => {
  try {
    // Sirf apni wishlist items fetch kare — userId se filter
    const wishlistItems = await Wishlist.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    if (wishlistItems.length === 0) {
      return res.status(200).json({ products: [], count: 0 });
    }

    // Product IDs nikale aur live product data fetch kare
    const productIds = wishlistItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    // Map product data ke saath — order maintain karne ke liye
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const enrichedProducts = wishlistItems
      .map((item) => {
        const product = productMap.get(item.productId.toString());
        if (!product) return null; // Product delete ho gaya toh skip
        return {
          _id: product._id,
          title: product.title,
          price: product.price,
          image: product.image,
          category: product.category,
          description: product.description,
          countInStock: product.countInStock,
          rating: product.rating,
          wishlistedAt: item.createdAt,
        };
      })
      .filter(Boolean);

    res.status(200).json({
      products: enrichedProducts,
      count: enrichedProducts.length
    });
  } catch (error) {
    logger.error({ err: error }, 'Wishlist fetch error:');
    res.status(500).json({ message: 'Failed to fetch wishlist' });
  }
});

module.exports = router;
