const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');

const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Delete the on-disk file behind an uploaded image URL (/uploads/<name>), or the
// Cloudinary asset behind a cloudinary:// URL, if any. Remote URLs and seed-data
// images are left untouched. Errors are swallowed — a leftover file is harmless;
// a missing file is not worth failing the request over.
const unlinkUploadedImage = (imageUrl) => {
  if (typeof imageUrl !== 'string') return;

  if (imageUrl.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, '..', 'uploads', path.basename(imageUrl));
    fs.unlink(filePath, () => {});
    return;
  }

  if (imageUrl.includes('/image/upload/cartify/')) {
    // Extract public id from a URL like https://res.cloudinary.com/<name>/image/upload/cartify/<hex>
    const match = imageUrl.match(/\/image\/upload\/(.+)$/);
    if (match) {
      const publicId = match[1].replace(/^v\d+\//, '');
      cloudinary.uploader.destroy(publicId, () => {});
    }
  }
};

// Utility: Escape all regex special characters to prevent ReDoS (Regular Expression DoS)
// Without this, a malicious user could inject patterns like "(?:.*)*" into $regex,
// causing catastrophic backtracking that freezes the Node.js event loop.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 1. GET API: Products with search, category filter & pagination
router.get('/', async (req, res) => {
    try {
        // Product list is safe to cache briefly — stale-while-revalidate keeps it fresh.
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
        const { search, category, page, limit } = req.query;
        const query = {};

        if (search) {
            // Trim whitespace — prevents accidental empty searches from sneaking through
            const trimmed = search.trim();

            // Ignore empty search strings (e.g. user typed only spaces)
            if (trimmed.length > 0) {
                // Reject overly long queries (ReDoS risk scales with input length)
                // 100 chars is more than enough for legitimate product searches
                if (trimmed.length > 100) {
                    return res.status(400).json({ message: "Search query too long (max 100 characters)" });
                }

                // Escape regex metacharacters so user input is treated as literal text
                // This neutralises ReDoS payloads like "((.*)*)*" or "(a+)+b"
                const safeSearch = escapeRegex(trimmed);

                query.title = { $regex: safeSearch, $options: 'i' };
            }
        }

        if (category && category !== 'all') {
            query.category = category;
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 12;
        const skip = (pageNum - 1) * limitNum;

        const products = await Product.find(query).skip(skip).limit(limitNum);
        const total = await Product.countDocuments(query);

        res.status(200).json({
            products,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        console.error("❌ Products route error:", error.message);
        res.status(500).json({ message: "Failed to fetch products" });
    }
});

// 2. POST API: Add a new product (Admin only)
router.post('/add', protect, admin, auditLogMiddleware('CREATE_PRODUCT', 'Product'), async (req, res) => {
    try {
        const allowedFields = ['title', 'description', 'price', 'category', 'image', 'rating', 'countInStock'];
        const sanitized = {};

        for (const field of allowedFields) {
            if (req.body[field] === undefined) continue;

            if (field === 'title') {
                const val = typeof req.body.title === 'string' ? req.body.title.trim() : '';
                if (!val) {
                    return res.status(400).json({ message: "Title is required and must be non-empty" });
                }
                sanitized.title = val;
            } else if (field === 'description') {
                const val = typeof req.body.description === 'string' ? req.body.description.trim() : '';
                if (!val) {
                    return res.status(400).json({ message: "Description is required and must be non-empty" });
                }
                if (val.length > 2000) {
                    return res.status(400).json({ message: "Description must be at most 2000 characters" });
                }
                sanitized.description = val;
            } else if (field === 'price') {
                const price = Number(req.body.price);
                if (isNaN(price) || price <= 0) {
                    return res.status(400).json({ message: "Price must be a positive number" });
                }
                sanitized.price = price;
            } else if (field === 'category') {
                const val = typeof req.body.category === 'string' ? req.body.category.trim() : '';
                if (!val) {
                    return res.status(400).json({ message: "Category is required and must be non-empty" });
                }
                sanitized.category = val;
            } else if (field === 'image') {
                const val = typeof req.body.image === 'string' ? req.body.image.trim() : '';
                if (!val) {
                    return res.status(400).json({ message: "Image URL is required and must be non-empty" });
                }
                sanitized.image = val;
            } else if (field === 'rating') {
                const { rate, count } = req.body.rating || {};
                const parsedRate = rate !== undefined ? Number(rate) : 0;
                const parsedCount = count !== undefined ? Number(count) : 0;
                if (rate !== undefined && (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 5)) {
                    return res.status(400).json({ message: "Rating rate must be between 0 and 5" });
                }
                if (count !== undefined && (isNaN(parsedCount) || parsedCount < 0 || !Number.isInteger(parsedCount))) {
                    return res.status(400).json({ message: "Rating count must be a non-negative integer" });
                }
                sanitized.rating = { rate: parsedRate, count: parsedCount };
            } else if (field === 'countInStock') {
                const stock = Number(req.body.countInStock);
                if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
                    return res.status(400).json({ message: "Stock must be a non-negative integer" });
                }
                sanitized.countInStock = stock;
            }
        }

        const required = ['title', 'description', 'price', 'category', 'image'];
        const missing = required.filter(f => sanitized[f] === undefined);
        if (missing.length > 0) {
            return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
        }

        const newProduct = new Product(sanitized);
        await newProduct.save();
        res.status(201).json({ message: "Product added successfully", product: newProduct });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        console.error("❌ Product add error:", error);
        res.status(500).json({ message: "Failed to add product" });
    }
});

// 3. POST API: Insert many products at once (Admin only)
router.post('/seed', protect, admin, auditLogMiddleware('BULK_CREATE_PRODUCTS', 'Product'), async (req, res, next) => {
    try {
        if (!Array.isArray(req.body) || req.body.length === 0) {
            return res.status(400).json({ message: "Please provide an array of products to seed" });
        }
        // insertMany() inserts the whole array into the database in one call
        const products = await Product.insertMany(req.body); 
        res.status(201).json({ message: "Store is now stocked! All products added! 🛒🎉", count: products.length });
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        console.error("❌ Products seed error:", error);
        res.status(500).json({ message: "Failed to seed products" });
    }
});

// 4. GET API: Fetch a single product by its ID
router.get('/:id', async (req, res, next) => {
    try {
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
        const product = await Product.findById(req.params.id); 
        if (!product) {
            return res.status(404).json({ message: "Product not found! 😢" });
        }
        res.status(200).json(product);
    } catch (error) {
        if (error.name === 'CastError') {
            return next(error);
        }
        console.error("❌ Product fetch by ID error:", error);
        res.status(500).json({ message: "Failed to fetch product" });
    }
});

// 5. DELETE API: Clear all products (Admin only)
router.delete('/clear', protect, admin, auditLogMiddleware('DELETE_ALL_PRODUCTS', 'Product'), async (req, res) => {
    try {
        await Product.deleteMany({});
        res.status(200).json({ message: "Database cleared successfully! 🧹✨" });
    } catch (error) {
        console.error("❌ Product delete error:", error);
        res.status(500).json({ message: "Failed to delete product" });
    }
});

// 6. DELETE API: Delete a single product (Admin only)
router.delete('/:id', protect, admin, auditLogMiddleware('DELETE_PRODUCT', 'Product'), async (req, res, next) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Clean up the uploaded image file so deleted products don't leak disk space.
        unlinkUploadedImage(product.image);
        res.status(200).json({ message: "Product deleted successfully! 🗑️" });
    } catch (error) {
        if (error.name === 'CastError') {
            return next(error);
        }
        console.error("❌ Product delete error:", error);
        res.status(500).json({ message: "Failed to delete product" });
    }
});

// 7. PATCH API: Update single product (Admin only)
router.patch('/:id', protect, admin, auditLogMiddleware('UPDATE_PRODUCT', 'Product'), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const previousImage = product.image;

        const allowedFields = ['title', 'price', 'description', 'category', 'image', 'rating', 'countInStock'];
        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'price') {
                    const price = Number(req.body.price);
                    if (isNaN(price) || price <= 0) {
                        return res.status(400).json({ message: "Price must be a positive number" });
                    }
                    updates.price = price;
                } else if (field === 'countInStock') {
                    const stock = Number(req.body.countInStock);
                    if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
                        return res.status(400).json({ message: "Stock must be a non-negative integer" });
                    }
                    updates.countInStock = stock;
                } else if (field === 'rating') {
                    const { rate, count } = req.body.rating || {};
                    const parsedRate = rate !== undefined ? Number(rate) : product.rating.rate;
                    const parsedCount = count !== undefined ? Number(count) : product.rating.count;
                    // Same bounds as the POST /add validator — prevents rating corruption
                    // (e.g. rate > 5 or negative) through the update path.
                    if (rate !== undefined && (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 5)) {
                        return res.status(400).json({ message: "Rating rate must be between 0 and 5" });
                    }
                    if (count !== undefined && (isNaN(parsedCount) || parsedCount < 0 || !Number.isInteger(parsedCount))) {
                        return res.status(400).json({ message: "Rating count must be a non-negative integer" });
                    }
                    updates.rating = { rate: parsedRate, count: parsedCount };
                } else if (field === 'image') {
                    if (!req.body.image || typeof req.body.image !== 'string' || !req.body.image.trim()) {
                        return res.status(400).json({ message: "Image URL is required" });
                    }
                    updates.image = req.body.image.trim();
                } else if (field === 'category') {
                    if (!req.body.category || typeof req.body.category !== 'string' || !req.body.category.trim()) {
                        return res.status(400).json({ message: "Category is required" });
                    }
                    updates.category = req.body.category.trim();
                } else if (field === 'title') {
                    if (!req.body.title || typeof req.body.title !== 'string' || !req.body.title.trim()) {
                        return res.status(400).json({ message: "Title is required" });
                    }
                    updates.title = req.body.title.trim();
                } else if (field === 'description') {
                    if (!req.body.description || typeof req.body.description !== 'string' || !req.body.description.trim()) {
                        return res.status(400).json({ message: "Description is required" });
                    }
                    updates.description = req.body.description.trim();
                } else {
                    updates[field] = req.body[field];
                }
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No valid fields provided to update" });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            updates,
            { returnDocument: 'after', runValidators: true }
        );

        // If the image was replaced with a new one, remove the old uploaded file.
        if (updates.image && updates.image !== previousImage) {
            unlinkUploadedImage(previousImage);
        }

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            product: updatedProduct
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid product ID format" });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        console.error("❌ Product update error:", error);
        res.status(500).json({ message: "Failed to update product" });
    }
});

module.exports = router;