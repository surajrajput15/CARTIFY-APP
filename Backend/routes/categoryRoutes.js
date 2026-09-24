const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { adminMutateGuard } = require('../utils/routeLimiters');

// Canonical slugify (no deps): lowercase, keep alnum + hyphens, collapse rest.
const slugify = (str) =>
  String(str).toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

// Validate the optional GPS-free metadata fields once, in one place.
const sanitizeBody = (body) => {
  const out = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 100) return { error: 'name must be 1-100 characters' };
    out.name = name;
  }
  if (body.description !== undefined) {
    const d = typeof body.description === 'string' ? body.description.trim() : '';
    if (d.length > 500) return { error: 'description must be at most 500 characters' };
    out.description = d;
  }
  if (body.image !== undefined) {
    const img = typeof body.image === 'string' ? body.image.trim() : '';
    if (img.length > 500) return { error: 'image URL must be at most 500 characters' };
    out.image = img || null;
  }
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) return { error: 'sortOrder must be a number' };
    out.sortOrder = Math.trunc(n);
  }
  return { out };
};

// PUBLIC: list active categories (storefront picker). Cheap, cache-friendly.
router.get('/', async (req, res, next) => {
  try {
    const includeInactive = req.query.all === 'true';
    const filter = includeInactive ? {} : { isActive: true };
    const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean();

    // Product count per category (single aggregation, not N queries).
    const counts = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map((c) => [c._id, c.count]));

    res.status(200).json({
      categories: categories.map((c) => ({
        ...c,
        productCount: countMap.get(c.name) || 0
      }))
    });
  } catch (error) {
    logger.error({ err: error }, 'Category list error');
    next(error);
  }
});

// ADMIN: create category
router.post('/add', protect, admin, adminMutateGuard, auditLogMiddleware('CREATE_CATEGORY', 'Category'), async (req, res, next) => {
  try {
    const { error, out } = sanitizeBody(req.body);
    if (error) return res.status(400).json({ message: error });
    if (!out.name) return res.status(400).json({ message: 'name is required' });

    const slug = slugify(out.name);
    if (!slug) return res.status(400).json({ message: 'name must contain alphanumeric characters' });

    // Idempotent-ish: reject duplicates by name OR slug (case-insensitive via slug).
    const existing = await Category.findOne({ $or: [{ slug }, { name: out.name }] });
    if (existing) {
      return res.status(409).json({ message: 'A category with this name already exists' });
    }

    const category = new Category({ ...out, slug });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A category with this name already exists' });
    logger.error({ err: error }, 'Category create error');
    next(error);
  }
});

// ADMIN: update category (partial)
router.patch('/:id', protect, admin, adminMutateGuard, auditLogMiddleware('UPDATE_CATEGORY', 'Category'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid category ID format' });
    }
    const { error, out } = sanitizeBody(req.body);
    if (error) return res.status(400).json({ message: error });
    if (Object.keys(out).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    if (out.name) {
      const slug = slugify(out.name);
      const dupe = await Category.findOne({ slug, _id: { $ne: req.params.id } });
      if (dupe) return res.status(409).json({ message: 'A category with this name already exists' });
      out.slug = slug;
    }

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: out },
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Category not found' });
    res.status(200).json(updated);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A category with this name already exists' });
    logger.error({ err: error }, 'Category update error');
    next(error);
  }
});

// ADMIN: delete category (products are NOT touched — taxonomy only)
router.delete('/:id', protect, admin, adminMutateGuard, auditLogMiddleware('DELETE_CATEGORY', 'Category'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid category ID format' });
    }
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Category not found' });
    res.status(200).json({ message: 'Category deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Category delete error');
    next(error);
  }
});

module.exports = router;