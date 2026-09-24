const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const Campaign = require('../models/Campaign');
const { protect, admin } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { adminMutateGuard } = require('../utils/routeLimiters');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ADMIN: list all campaigns.
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const list = await Campaign.find({}).sort({ createdAt: -1 }).lean();
    res.status(200).json({ campaigns: list });
  } catch (error) {
    logger.error({ err: error }, 'Campaign list error');
    next(error);
  }
});

// PUBLIC: currently-live campaigns (storefront banners + product badges).
// Returns the campaign snapshot + the helper the client needs to compute badge
// eligibility, without exposing admin-only fields.
router.get('/active', async (req, res, next) => {
  try {
    const now = new Date();
    const live = await Campaign.find({ isActive: true })
      .where('startDate').lte(now)
      .where('endDate').gte(now)
      .lean();
    const payload = live.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug || null,
      description: c.description,
      bannerText: c.bannerText,
      bannerImage: c.bannerImage,
      bannerColor: c.bannerColor,
      discountType: c.discountType,
      discountValue: c.discountValue,
      maxDiscount: c.maxDiscount ?? null,
      minOrderAmount: c.minOrderAmount || 0,
      eligibleCategories: c.eligibleCategories || [],
      eligibleProductIds: c.eligibleProductIds || [],
    }));
    res.status(200).json({ campaigns: payload });
  } catch (error) {
    logger.error({ err: error }, 'Active campaign error');
    next(error);
  }
});

// PUBLIC: eligibility + line discount helper for product cards.
//    GET /active/price/:productId?price=1999   -> { campaign, discountedPrice, lineDiscount }
router.get('/active/price/:productId', async (req, res, next) => {
  try {
    if (!isValidId(req.params.productId)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }
    const price = Number(req.query.price);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ message: 'price query is required' });
    }
    const { findBestCampaignForCart } = require('../utils/campaignEngine');
    const product = await require('../models/Product').findById(req.params.productId).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const best = await findBestCampaignForCart({
      items: [{ productId: product._id, quantity: 1, price, category: product.category }],
    });

    if (!best) {
      return res.status(200).json({ discountedPrice: price, lineDiscount: 0, campaign: null });
    }
    const discount = Math.min(best.discountPaise / 100, price);
    return res.status(200).json({
      discountedPrice: Math.round((price - discount) * 100) / 100,
      lineDiscount: Math.round(discount * 100) / 100,
      campaign: {
        _id: best.campaign._id,
        name: best.campaign.name,
        discountType: best.campaign.discountType,
        discountValue: best.campaign.discountValue,
        bannerText: best.campaign.bannerText || '',
        bannerColor: best.campaign.bannerColor || null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Campaign price error');
    next(error);
  }
});

// Sanitize + validate a campaign payload (shared by create/update).
const parsePayload = (body) => {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) errors.push('name is required');
  const discountType = body.discountType;
  if (!['percentage', 'fixed'].includes(discountType)) errors.push('discountType must be "percentage" or "fixed"');
  const discountValue = Number(body.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0) errors.push('discountValue must be a positive number');

  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (isNaN(startDate.getTime())) errors.push('startDate is required');
  if (isNaN(endDate.getTime())) errors.push('endDate is required');
  if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate.getTime() > endDate.getTime()) {
    errors.push('startDate must be before endDate');
  }

  const maxDiscount = body.maxDiscount == null || body.maxDiscount === '' ? null : Number(body.maxDiscount);
  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) {
    errors.push('maxDiscount must be a positive number when provided');
  }
  const minOrderAmount = Number(body.minOrderAmount) || 0;
  if (minOrderAmount < 0) errors.push('minOrderAmount cannot be negative');

  const eligibleCategories = Array.isArray(body.eligibleCategories)
    ? body.eligibleCategories.map((c) => String(c).toLowerCase().trim()).filter(Boolean)
    : [];
  const eligibleProductIds = Array.isArray(body.eligibleProductIds)
    ? body.eligibleProductIds.filter(isValidId)
    : [];

  if (errors.length) return { errors };
  return {
    data: {
      name,
      slug: body.slug ? String(body.slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-') : undefined,
      description: typeof body.description === 'string' ? body.description.trim() : '',
      bannerText: typeof body.bannerText === 'string' ? body.bannerText.trim() : '',
      bannerImage: typeof body.bannerImage === 'string' && body.bannerImage ? body.bannerImage : null,
      bannerColor: body.bannerColor || '#0f766e',
      discountType,
      discountValue,
      maxDiscount,
      minOrderAmount,
      eligibleCategories,
      eligibleProductIds,
      startDate,
      endDate,
      isActive: body.isActive !== false,
    },
  };
};

// ADMIN: create campaign.
router.post('/', protect, admin, adminMutateGuard, auditLogMiddleware('CREATE_CAMPAIGN', 'Campaign'), async (req, res, next) => {
  try {
    const parsed = parsePayload(req.body);
    if (parsed.errors) return res.status(400).json({ message: parsed.errors.join(', ') });

    if (parsed.data.slug) {
      const dup = await Campaign.findOne({ slug: parsed.data.slug });
      if (dup) return res.status(409).json({ message: 'A campaign with this slug already exists' });
    }

    const campaign = await Campaign.create({ ...parsed.data, createdBy: req.user._id });
    res.status(201).json({ campaign });
  } catch (error) {
    logger.error({ err: error }, 'Campaign create error');
    next(error);
  }
});

// ADMIN: update campaign (partial).
router.patch('/:id', protect, admin, adminMutateGuard, auditLogMiddleware('UPDATE_CAMPAIGN', 'Campaign'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid campaign id' });
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const parsed = parsePayload({ ...campaign.toObject(), ...req.body });
    if (parsed.errors) return res.status(400).json({ message: parsed.errors.join(', ') });

    if (parsed.data.slug) {
      const dup = await Campaign.findOne({ slug: parsed.data.slug, _id: { $ne: campaign._id } });
      if (dup) return res.status(409).json({ message: 'A campaign with this slug already exists' });
    }

    Object.assign(campaign, parsed.data);
    await campaign.save();
    res.status(200).json({ campaign });
  } catch (error) {
    logger.error({ err: error }, 'Campaign update error');
    next(error);
  }
});

// ADMIN: toggle active.
router.patch('/:id/toggle', protect, admin, adminMutateGuard, auditLogMiddleware('TOGGLE_CAMPAIGN', 'Campaign'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid campaign id' });
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    campaign.isActive = !campaign.isActive;
    await campaign.save();
    res.status(200).json({ campaign });
  } catch (error) {
    logger.error({ err: error }, 'Campaign toggle error');
    next(error);
  }
});

// ADMIN: delete campaign.
router.delete('/:id', protect, admin, adminMutateGuard, auditLogMiddleware('DELETE_CAMPAIGN', 'Campaign'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid campaign id' });
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.status(200).json({ message: 'Campaign deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Campaign delete error');
    next(error);
  }
});

module.exports = router;