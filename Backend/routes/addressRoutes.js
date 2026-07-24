const express = require('express');
const router = express.Router();
const Address = require('../models/Address');
const { protect } = require('../middleware/auth');

// 1. ADD NEW ADDRESS
router.post('/add', protect, async (req, res) => {
    try {
        const newAddress = new Address({ ...req.body, userId: req.user._id });
        const savedAddress = await newAddress.save();
        res.status(201).json(savedAddress);
    } catch (error) {
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
router.delete('/:id', protect, async (req, res) => {
    try {
        const address = await Address.findById(req.params.id);
        if (!address) return res.status(404).json({ message: "Address not found" });
        if (address.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "You can only delete your own addresses." });
        }
        await Address.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Address deleted successfully" });
    } catch (error) {
        console.error("❌ Address delete error:", error);
        res.status(500).json({ message: "Error deleting address" });
    }
});

module.exports = router;