const express = require('express');
const router = express.Router();
const Address = require('../models/Address');
const { protect } = require('../middleware/auth');

// 1. ADD NEW ADDRESS
router.post('/add', protect, async (req, res, next) => {
    try {
        // Strict allowlist + server-side validation. The raw body is never spread
        // into the document, so a client can't inject extra fields (userId etc.).
        const allowedFields = ['fullName', 'phone', 'street', 'city', 'state', 'pinCode'];
        const sanitized = {};

        for (const field of allowedFields) {
            const raw = req.body[field];
            const val = typeof raw === 'string' ? raw.trim() : '';
            if (!val) {
                return res.status(400).json({ message: `${field} is required and must be non-empty` });
            }
            sanitized[field] = val;
        }

        if (!/^[6-9]\d{9}$/.test(sanitized.phone)) {
            return res.status(400).json({ message: 'Phone must be a valid 10-digit Indian number starting with 6, 7, 8 or 9' });
        }
        if (!/^\d{6}$/.test(sanitized.pinCode)) {
            return res.status(400).json({ message: 'PIN code must be exactly 6 digits' });
        }

        const newAddress = new Address({ ...sanitized, userId: req.user._id });
        const savedAddress = await newAddress.save();
        res.status(201).json(savedAddress);
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        console.error("❌ Address save error:", error);
        res.status(500).json({ message: "Error saving address" });
    }
});

// 2. GET USER ADDRESSES
router.get('/:userId', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.userId) {
            return res.status(403).json({ message: "You can only view your own addresses." });
        }
        const addresses = await Address.find({ userId: req.params.userId });
        res.status(200).json(addresses);
    } catch (error) {
        console.error("❌ Address fetch error:", error);
        res.status(500).json({ message: "Error fetching addresses" });
    }
});

// 3. DELETE ADDRESS
router.delete('/:id', protect, async (req, res, next) => {
    try {
        const address = await Address.findById(req.params.id);
        if (!address) return res.status(404).json({ message: "Address not found" });
        if (address.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "You can only delete your own addresses." });
        }
        await Address.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Address deleted successfully" });
    } catch (error) {
        if (error.name === 'CastError') {
            return next(error);
        }
        console.error("❌ Address delete error:", error);
        res.status(500).json({ message: "Error deleting address" });
    }
});

module.exports = router;