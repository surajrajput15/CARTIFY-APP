const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { adminMutateGuard } = require('../utils/routeLimiters');
const { evaluateCoupon, findBestCoupon, findAvailableCoupons } = require('../utils/couponEngine');

// Validation helper
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const validateCoupon = (body, isUpdate = false) => {
    const errors = [];
    
    if (!isUpdate) {
        if (!body.code || body.code.trim().length < 3) {
            errors.push('Code must be at least 3 characters');
        }
        if (!body.type) {
            errors.push('Type is required ("percentage" or "fixed")');
        }
        if (body.value === undefined) {
            errors.push('Value is required');
        }
        if (!body.validUntil) {
            errors.push('Valid until date is required');
        }
    }

    if (Array.isArray(body.applicableCategories) && body.applicableCategories.some(c => typeof c !== 'string' || !c.trim())) {
        errors.push('Applicable categories must be non-empty strings');
    }
    for (const field of ['applicableProducts', 'excludedProducts']) {
        if (body[field] !== undefined && (!Array.isArray(body[field]) || body[field].some(id => typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)))) {
            errors.push(`${field} must be an array of product IDs`);
        }
    }

    if (body.type && !['percentage', 'fixed'].includes(body.type)) {
        errors.push('Type must be either "percentage" or "fixed"');
    }
    
    if (body.value !== undefined && (typeof body.value !== 'number' || !(body.value > 0) || body.value > 10000000)) {
        errors.push('Value must be a positive number up to 10000000');
    }
    
    if (body.value !== undefined && body.value > 100 && (body.type === 'percentage' || (!body.type && isUpdate))) {
        // On update without explicit type, validate against the stored type at handler level;
        // this pre-check catches the common create + explicit-type update cases.
        errors.push('Percentage value cannot exceed 100');
    }
    
    if (body.minOrderAmount !== undefined && (typeof body.minOrderAmount !== 'number' || body.minOrderAmount < 0)) {
        errors.push('Minimum order amount must be a positive number');
    }
    
    if (body.maxDiscount !== undefined && body.maxDiscount !== null && (typeof body.maxDiscount !== 'number' || body.maxDiscount < 0)) {
        errors.push('Maximum discount must be a positive number');
    }
    
    if (body.usageLimit !== undefined && body.usageLimit !== null && (!Number.isInteger(body.usageLimit) || body.usageLimit < 1)) {
        errors.push('Usage limit must be a positive integer');
    }
    
    if (body.userLimit !== undefined && (!Number.isInteger(body.userLimit) || body.userLimit < 1)) {
        errors.push('User limit must be a positive integer');
    }
    
    if (body.validUntil && isNaN(new Date(body.validUntil).getTime())) {
        errors.push('Valid until date is invalid');
    }
    
    if (body.validFrom && isNaN(new Date(body.validFrom).getTime())) {
        errors.push('Valid from date is invalid');
    }

    if (body.validFrom && body.validUntil) {
        const from = new Date(body.validFrom);
        const until = new Date(body.validUntil);
        if (!isNaN(from.getTime()) && !isNaN(until.getTime()) && from >= until) {
            errors.push('Valid from date must be before valid until date');
        }
    }
    
    return errors;
};

// 1. CREATE COUPON (Admin only)
router.post('/', protect, admin, adminMutateGuard, auditLogMiddleware('CREATE_COUPON', 'Coupon'), async (req, res) => {
    try {
        const errors = validateCoupon(req.body);
        if (errors.length > 0) {
            return res.status(400).json({ message: 'Validation failed', errors });
        }
        
        const couponData = {
            code: req.body.code.trim().toUpperCase(),
            type: req.body.type,
            value: req.body.value,
            minOrderAmount: req.body.minOrderAmount || 0,
            maxDiscount: req.body.maxDiscount || null,
            usageLimit: req.body.usageLimit || null,
            userLimit: req.body.userLimit || 1,
            applicableCategories: req.body.applicableCategories || [],
            applicableProducts: req.body.applicableProducts || [],
            excludedProducts: req.body.excludedProducts || [],
            validFrom: req.body.validFrom ? new Date(req.body.validFrom) : new Date(),
            validUntil: new Date(req.body.validUntil),
            isActive: req.body.isActive !== false
        };
        
        const coupon = new Coupon(couponData);
        await coupon.save();
        
        res.status(201).json({ message: 'Coupon created successfully', coupon });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Coupon code already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        logger.error({ err: error }, "❌ Coupon create error:");
        res.status(500).json({ message: "Error creating coupon" });
    }
});

// 2. GET ALL COUPONS (Admin only)
router.get('/', protect, admin, async (req, res) => {
    try {
        const { page = 1, limit = 20, isActive, search } = req.query;
        const query = {};
        
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }
        
        if (search) {
            const term = search.trim().toUpperCase().slice(0, 20);
            if (term) query.code = { $regex: escapeRegex(term), $options: 'i' };
        }
        
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;
        
        const [coupons, total] = await Promise.all([
            Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
            Coupon.countDocuments(query)
        ]);
        
        res.status(200).json({
            coupons,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        logger.error({ err: error }, "❌ Coupons fetch error:");
        res.status(500).json({ message: "Error fetching coupons" });
    }
});

// 3. COUPON USAGE ANALYTICS (admin) — MUST be registered before GET /:id so
// the literal 'analytics' path is never swallowed by the :id param matcher.
// Redemption volume + discount paid out per coupon, aggregated over Paid
// orders only (honest: money actually spent, Pending excluded).
router.get('/analytics', protect, admin, async (req, res) => {
    try {
        const [overview, byCode] = await Promise.all([
            Order.aggregate([
                { $match: { paymentStatus: 'Paid', couponCode: { $ne: null } } },
                { $group: { _id: null, orders: { $sum: 1 }, discountGiven: { $sum: '$discountAmount' } } }
            ]),
            Order.aggregate([
                { $match: { paymentStatus: 'Paid', couponCode: { $ne: null } } },
                { $group: { _id: '$couponCode', orders: { $sum: 1 }, discountGiven: { $sum: '$discountAmount' } } }
            ]).sort({ orders: -1 }).limit(50)
        ]);

        res.status(200).json({
            overview: overview[0] || { orders: 0, discountGiven: 0 },
            byCode,
        });
    } catch (error) {
        logger.error({ err: error }, "❌ Coupon analytics error:");
        res.status(500).json({ message: "Error fetching coupon analytics" });
    }
});

// 3. GET SINGLE COUPON (Admin only)
router.get('/:id', protect, admin, async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        res.status(200).json(coupon);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid coupon ID" });
        }
        logger.error({ err: error }, "❌ Coupon fetch error:");
        res.status(500).json({ message: "Error fetching coupon" });
    }
});

// 4. VALIDATE COUPON (User facing - for checkout)
router.post('/validate', protect, async (req, res) => {
    try {
        const { code, orderAmount } = req.body;
        // Default items to [] and reject non-arrays — downstream uses
        // items.length / items.some, which would throw a TypeError on garbage.
        const items = Array.isArray(req.body.items) ? req.body.items : [];

        if (typeof code !== 'string' || !code.trim()) {
            return res.status(400).json({ message: 'Coupon code is required' });
        }
        if (typeof orderAmount !== 'number' || orderAmount < 0) {
            return res.status(400).json({ message: 'Valid order amount is required' });
        }

        const coupon = await Coupon.findOne({
            code: code.trim().toUpperCase(),
        });

        if (!coupon) {
            return res.status(404).json({ message: 'Invalid or expired coupon code' });
        }

        // Shared evaluation engine — identical rules + discount math to charge-time
        // (paymentRoutes), so a coupon preview can never drift from what will be
        // applied when the order actually goes through Razorpay.
        const check = await evaluateCoupon(coupon, { orderAmount, items });

        if (!check.valid) {
            return res.status(400).json({ message: check.message });
        }

        // Per-user usage limit (checked here, debited later on Paid only).
        const userUsage = coupon.usedBy.filter(u => u.userId?.toString() === req.user._id.toString()).length;
        if (userUsage >= coupon.userLimit) {
            return res.status(400).json({ message: 'You have already used this coupon maximum times' });
        }

        res.status(200).json({
            valid: true,
            coupon: {
                code: coupon.code,
                type: coupon.type,
                value: coupon.value,
                discount: check.discount,
                finalAmount: check.finalAmount,
            }
        });
    } catch (error) {
        logger.error({ err: error }, "❌ Coupon validation error:");
        res.status(500).json({ message: "Error validating coupon" });
    }
});

// 3b. AUTO-APPLY BEST COUPON (customer) — find the single highest-saving valid
// coupon for the live cart. Same engine as /validate so the suggested coupon is
// exactly what charge-time would honour. Stacks nothing: one coupon per order.
router.post('/best', protect, async (req, res) => {
    try {
        const { orderAmount } = req.body;
        const items = Array.isArray(req.body.items) ? req.body.items : [];

        if (typeof orderAmount !== 'number' || orderAmount < 0) {
            return res.status(400).json({ message: 'Valid order amount is required' });
        }

        const result = await findBestCoupon({
            userId: req.user._id,
            orderAmount,
            items,
        });

        res.status(200).json({
            found: result.found,
            coupon: result.coupon,
            discount: result.discount,
            message: result.found
                ? `Best available coupon ${result.coupon.code} saves you ${result.coupon.discount.toFixed(2)}`
                : 'No applicable coupons for this cart',
        });
    } catch (error) {
        logger.error({ err: error }, "❌ Coupon best-pick error:");
        res.status(500).json({ message: "Error finding best coupon" });
    }
});

// 3c. GET ALL AVAILABLE COUPONS (customer) — returns all eligible coupons for
// the cart, sorted by discount descending. Used for "Available Coupons" modal.
router.post('/available', protect, async (req, res) => {
    try {
        const { orderAmount } = req.body;
        const items = Array.isArray(req.body.items) ? req.body.items : [];

        if (typeof orderAmount !== 'number' || orderAmount < 0) {
            return res.status(400).json({ message: 'Valid order amount is required' });
        }

        const result = await findAvailableCoupons({
            userId: req.user._id,
            orderAmount,
            items,
        });

        res.status(200).json({
            coupons: result.coupons,
            count: result.coupons.length,
        });
    } catch (error) {
        logger.error({ err: error }, "❌ Coupon available list error:");
        res.status(500).json({ message: "Error fetching available coupons" });
    }
});

// 5. UPDATE COUPON (Admin only)
router.put('/:id', protect, admin, adminMutateGuard, auditLogMiddleware('UPDATE_COUPON', 'Coupon'), async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        
        const errors = validateCoupon(req.body, true);
        if (errors.length > 0) {
            return res.status(400).json({ message: 'Validation failed', errors });
        }
        // Effective-type guard: a value>100 update on a stored percentage coupon
        // must fail even when `type` is omitted from the body (free-order prevention).
        const effectiveType = req.body.type || coupon.type;
        if (req.body.value !== undefined && effectiveType === 'percentage' && req.body.value > 100) {
            return res.status(400).json({ message: 'Validation failed', errors: ['Percentage value cannot exceed 100'] });
        }
        
        const allowedUpdates = [
            'code', 'type', 'value', 'minOrderAmount', 'maxDiscount', 
            'usageLimit', 'userLimit', 'applicableCategories',
            'applicableProducts', 'excludedProducts', 'validFrom',
            'validUntil', 'isActive'
        ];
        
        const updates = {};
        for (const field of allowedUpdates) {
            if (req.body[field] !== undefined) {
                if (field === 'code') {
                    updates[field] = req.body[field].trim().toUpperCase();
                } else if (field === 'validFrom' || field === 'validUntil') {
                    updates[field] = new Date(req.body[field]);
                } else {
                    updates[field] = req.body[field];
                }
            }
        }
        
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { returnDocument: 'after', runValidators: true }
        );
        
        res.status(200).json({ message: 'Coupon updated successfully', coupon: updatedCoupon });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid coupon ID" });
        }
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Coupon code already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        logger.error({ err: error }, "❌ Coupon update error:");
        res.status(500).json({ message: "Error updating coupon" });
    }
});

// 6. DELETE COUPON (Admin only)
router.delete('/:id', protect, admin, adminMutateGuard, auditLogMiddleware('DELETE_COUPON', 'Coupon'), async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        res.status(200).json({ message: "Coupon deleted successfully" });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid coupon ID" });
        }
        logger.error({ err: error }, "❌ Coupon delete error:");
        res.status(500).json({ message: "Error deleting coupon" });
    }
});

// 7. TOGGLE COUPON STATUS (Admin only)
router.patch('/:id/toggle', protect, admin, adminMutateGuard, auditLogMiddleware('TOGGLE_COUPON', 'Coupon'), async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        
        coupon.isActive = !coupon.isActive;
        await coupon.save();
        
        res.status(200).json({ 
            message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`, 
            coupon 
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid coupon ID" });
        }
        logger.error({ err: error }, "❌ Coupon toggle error:");
        res.status(500).json({ message: "Error toggling coupon status" });
    }
});

module.exports = router;