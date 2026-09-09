const express = require('express');
const { logger } = require('../utils/logger');
const { normalizeIndianPhone, normalizePinCode } = require('../utils/normalize');
const router = express.Router();
const Address = require('../models/Address');
const { protect } = require('../middleware/auth');

// 1. ADD NEW ADDRESS
router.post('/add', protect, async (req, res, next) => {
    try {
        // Strict allowlist + server-side validation. The raw body is never spread
        // into the document, so a client can't inject extra fields (userId etc.).
        const allowedFields = ['fullName', 'phone', 'street', 'city', 'state', 'pinCode', 'isDefault'];
        const sanitized = {};

        for (const field of allowedFields) {
            const raw = req.body[field];
            if (field === 'isDefault') {
                sanitized[field] = Boolean(raw);
            } else {
                const val = typeof raw === 'string' ? raw.trim() : '';
                if (!val) {
                    return res.status(400).json({ message: `${field} is required and must be non-empty` });
                }
                sanitized[field] = val;
            }
        }

        // Accept friendly formats ("+91 ...", spaces, dashes) but store
        // canonical digits so checkout validation always agrees with the book.
        const cleanPhone = normalizeIndianPhone(sanitized.phone);
        if (!cleanPhone) {
            return res.status(400).json({ message: 'Phone must be a valid 10-digit Indian number starting with 6, 7, 8 or 9' });
        }
        sanitized.phone = cleanPhone;
        const cleanPin = normalizePinCode(sanitized.pinCode);
        if (!cleanPin) {
            return res.status(400).json({ message: 'PIN code must be exactly 6 digits' });
        }
        sanitized.pinCode = cleanPin;

        // If setting as default, unset any existing default for this user
        if (sanitized.isDefault) {
            await Address.updateMany(
                { userId: req.user._id, isDefault: true },
                { $set: { isDefault: false } }
            );
        }

        const newAddress = new Address({ ...sanitized, userId: req.user._id });
        const savedAddress = await newAddress.save();
        res.status(201).json(savedAddress);
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        // Handle duplicate key error for unique partial index
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Default address already exists' });
        }
        logger.error({ err: error }, "❌ Address save error:");
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
        logger.error({ err: error }, "❌ Address fetch error:");
        res.status(500).json({ message: "Error fetching addresses" });
    }
});

// 3. UPDATE ADDRESS (including setting as default)
router.put('/:id', protect, async (req, res, next) => {
    try {
        const address = await Address.findById(req.params.id);
        if (!address) return res.status(404).json({ message: "Address not found" });
        if (address.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "You can only update your own addresses." });
        }

        const allowedFields = ['fullName', 'phone', 'street', 'city', 'state', 'pinCode', 'isDefault'];
        const sanitized = {};

        for (const field of allowedFields) {
            const raw = req.body[field];
            if (field === 'isDefault') {
                sanitized[field] = Boolean(raw);
            } else if (raw !== undefined) {
                const val = typeof raw === 'string' ? raw.trim() : '';
                if (val) sanitized[field] = val;
            }
        }

        if (sanitized.phone) {
            const cleanPhone = normalizeIndianPhone(sanitized.phone);
            if (!cleanPhone) {
                return res.status(400).json({ message: 'Phone must be a valid 10-digit Indian number starting with 6, 7, 8 or 9' });
            }
            sanitized.phone = cleanPhone;
        }
        if (sanitized.pinCode) {
            const cleanPin = normalizePinCode(sanitized.pinCode);
            if (!cleanPin) {
                return res.status(400).json({ message: 'PIN code must be exactly 6 digits' });
            }
            sanitized.pinCode = cleanPin;
        }

        // If setting as default, unset any existing default for this user
        if (sanitized.isDefault) {
            await Address.updateMany(
                { userId: req.user._id, isDefault: true, _id: { $ne: address._id } },
                { $set: { isDefault: false } }
            );
        }

        const updatedAddress = await Address.findByIdAndUpdate(
            req.params.id,
            { $set: sanitized },
            { returnDocument: 'after', runValidators: true }
        );
        res.status(200).json(updatedAddress);
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Default address already exists' });
        }
        logger.error({ err: error }, "❌ Address update error:");
        res.status(500).json({ message: "Error updating address" });
    }
});

// 4. DELETE ADDRESS
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
        logger.error({ err: error }, "❌ Address delete error:");
        res.status(500).json({ message: "Error deleting address" });
    }
});

module.exports = router;