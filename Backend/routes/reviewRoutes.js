const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// POST /api/v1/reviews — customer creates a review
router.post('/', protect, async (req, res, next) => {
    try {
        const { productId, rating, title, comment } = req.body || {};

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Valid productId required' });
        }
        if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
            return res.status(400).json({ message: 'Rating must be integer 1-5' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const existing = await Review.findOne({ product: productId, user: req.user._id });
        if (existing) {
            return res.status(409).json({ message: 'You have already reviewed this product' });
        }

        const review = await Review.create({
            product: productId,
            user: req.user._id,
            userName: req.user.name,
            rating,
            title: String(title || '').trim(),
            comment: String(comment || '').trim(),
            status: 'pending',
            verified: false
        });

        res.status(201).json({ review });
    } catch (error) {
        logger.error({ err: error }, 'Create review error');
        next(error);
    }
});

// GET /api/v1/reviews/product/:productId — public approved reviews for a product
router.get('/product/:productId', async (req, res, next) => {
    try {
        const { productId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid productId' });
        }

        const reviews = await Review.find({ product: productId, status: 'approved' })
            .select('userName rating title comment createdAt verified')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ reviews });
    } catch (error) {
        logger.error({ err: error }, 'Fetch product reviews error');
        next(error);
    }
});

// GET /api/v1/reviews/my — customer's own reviews
router.get('/my', protect, async (req, res, next) => {
    try {
        const reviews = await Review.find({ user: req.user._id })
            .populate('product', 'title image')
            .select('product rating title comment status createdAt')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ reviews });
    } catch (error) {
        logger.error({ err: error }, 'Fetch my reviews error');
        next(error);
    }
});

module.exports = router;