const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();
const Coupon = require('../models/Coupon');
const { protect, admin } = require('../middleware/auth');

// Validation helper
const validateCoupon = (body, isUpdate = false) => {
    const errors = [];
    
    if (!isUpdate) {
        if (!body.code || body.code.trim().length < 3) {
            errors.push('Code must be at least 3 characters');
        }
    }
    
    if (body.type && !['percentage', 'fixed'].includes(body.type)) {
        errors.push('Type must be either "percentage" or "fixed"');
    }
    
    if (body.value !== undefined && (typeof body.value !== 'number' || body.value < 0)) {
        errors.push('Value must be a positive number');
    }
    
    if (body.type === 'percentage' && body.value !== undefined && body.value > 100) {
        errors.push('Percentage value cannot exceed 100');
    }
    
    if (body.minOrderAmount !== undefined && (typeof body.minOrderAmount !== 'number' || body.minOrderAmount < 0)) {
        errors.push('Minimum order amount must be a positive number');
    }
    
    if (body.maxDiscount !== undefined && body.maxDiscount !== null && (typeof body.maxDiscount !== 'number' || body.maxDiscount < 0)) {
        errors.push('Maximum discount must be a positive number');
    }
    
    if (body.usageLimit !== undefined && body.usageLimit !== null && (typeof body.usageLimit !== 'number' || body.usageLimit < 1)) {
        errors.push('Usage limit must be a positive integer');
    }
    
    if (body.userLimit !== undefined && (typeof body.userLimit !== 'number' || body.userLimit < 1)) {
        errors.push('User limit must be a positive integer');
    }
    
    if (body.validUntil && isNaN(new Date(body.validUntil).getTime())) {
        errors.push('Valid until date is invalid');
    }
    
    if (body.validFrom && isNaN(new Date(body.validFrom).getTime())) {
        errors.push('Valid from date is invalid');
    }
    
    return errors;
};

// 1. CREATE COUPON (Admin only)
router.post('/', protect, admin, async (req, res) => {
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
            return res.status(400).json({ message: 'Coupon code already exists' });
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
            query.code = { $regex: search.trim().toUpperCase(), $options: 'i' };
        }
        
        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 20, 100);
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
            isActive: true,
            validFrom: { $lte: new Date() },
            validUntil: { $gte: new Date() }
        });
        
        if (!coupon) {
            return res.status(404).json({ message: 'Invalid or expired coupon code' });
        }
        
        // Check usage limit
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ message: 'Coupon usage limit reached' });
        }
        
        // Check user-specific limit
        const userUsage = coupon.usedBy.filter(u => u.userId?.toString() === req.user._id.toString()).length;
        if (userUsage >= coupon.userLimit) {
            return res.status(400).json({ message: 'You have already used this coupon maximum times' });
        }
        
        // Check minimum order amount
        if (orderAmount < coupon.minOrderAmount) {
            return res.status(400).json({ 
                message: `Minimum order amount of ₹${coupon.minOrderAmount} required` 
            });
        }
        
        // Check applicable categories/products if specified
        if (coupon.applicableCategories.length > 0 && items.length > 0) {
            // Note: This requires items to have category info
            // We'll do a basic check - items should have category field
            const hasValidCategory = items.some(item => 
                item.category && coupon.applicableCategories.includes(item.category)
            );
            if (!hasValidCategory) {
                return res.status(400).json({ 
                    message: 'Coupon not applicable to items in your cart' 
                });
            }
        }
        
        // Check applicable products
        if (coupon.applicableProducts.length > 0 && items.length > 0) {
            const hasValidProduct = items.some(item => 
                coupon.applicableProducts.some(pId => pId.toString() === item.productId.toString())
            );
            if (!hasValidProduct) {
                return res.status(400).json({ 
                    message: 'Coupon not applicable to items in your cart' 
                });
            }
        }
        
        // Check excluded products
        if (coupon.excludedProducts.length > 0 && items.length > 0) {
            const hasExcludedProduct = items.some(item => 
                coupon.excludedProducts.some(pId => pId.toString() === item.productId.toString())
            );
            if (hasExcludedProduct) {
                return res.status(400).json({ 
                    message: 'Coupon not valid for some items in your cart' 
                });
            }
        }
        
        // Calculate discount
        let discount = 0;
        if (coupon.type === 'percentage') {
            discount = Math.round(orderAmount * (coupon.value / 100));
            if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                discount = coupon.maxDiscount;
            }
        } else {
            discount = coupon.value;
        }
        
        const finalAmount = Math.max(0, orderAmount - discount);
        
        res.status(200).json({
            valid: true,
            coupon: {
                code: coupon.code,
                type: coupon.type,
                value: coupon.value,
                discount,
                finalAmount
            }
        });
    } catch (error) {
        logger.error({ err: error }, "❌ Coupon validation error:");
        res.status(500).json({ message: "Error validating coupon" });
    }
});

// 5. UPDATE COUPON (Admin only)
router.put('/:id', protect, admin, async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        
        const errors = validateCoupon(req.body, true);
        if (errors.length > 0) {
            return res.status(400).json({ message: 'Validation failed', errors });
        }
        
        const allowedUpdates = [
            'type', 'value', 'minOrderAmount', 'maxDiscount', 
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
            return res.status(400).json({ message: 'Coupon code already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        logger.error({ err: error }, "❌ Coupon update error:");
        res.status(500).json({ message: "Error updating coupon" });
    }
});

// 6. DELETE COUPON (Admin only)
router.delete('/:id', protect, admin, async (req, res) => {
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
router.patch('/:id/toggle', protect, admin, async (req, res) => {
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