const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { protect } = require('../middleware/auth');

// ==========================================
// 🚀 NEW: OTP BASED LOGIN SYSTEM
// ==========================================

// 1. SEND OTP API (Email par 6-digit code bhejna)
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Please enter your email." });

        // User dhundho. Agar naya user hai, toh auto-create kar do (Bina password ke)
        let user = await User.findOne({ email });
        if (!user) {
            const userCount = await User.countDocuments();
            user = new User({ name: 'Awesome User', email, isAdmin: userCount === 0 });
        }

        // Generate 6-digit OTP (e.g. 482910)
        const otp = crypto.randomInt(100000, 1000000).toString();
        
        // OTP aur Expiry Time (10 mins) database mein save karo
        user.otp = otp;
        user.otpExpire = Date.now() + 10 * 60 * 1000; 
        await user.save();

        // Nodemailer se asali Email bhejo
        const message = `Welcome to Cartify!\n\nYour Login OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. Please do not share it with anyone.`;
        
        await sendEmail({
            email: user.email,
            subject: 'Cartify - Your Login OTP 🔐',
            message: message
        });

        res.status(200).json({ message: "OTP sent successfully to your email! 📩" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error sending OTP. Please try again." });
    }
});

// 2. VERIFY OTP API (Email aur OTP check karna)
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found." });

        // Check karo ki OTP match ho raha hai aur expire toh nahi hua
        if (user.otp !== otp || user.otpExpire < Date.now()) {
            return res.status(400).json({ message: "Invalid or Expired OTP." });
        }

        // OTP theek hai! Ab OTP ko database se mita do (Security)
        user.otp = undefined;
        user.otpExpire = undefined;
        await user.save();

        // Login successful! Token generate karo
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: "Login successful! 🎉",
            token,
            user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin }
        });
    } catch (error) {
        console.error("❌ OTP verify error:", error);
        res.status(500).json({ message: "Error verifying OTP." });
    }
});


// ==========================================
// 🗝️ OLD: PASSWORD BASED LOGIN (Fallback)
// ==========================================

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: "Please fill in all fields." });

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: "User already exists." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userCount = await User.countDocuments();
        const newUser = new User({ name, email, password: hashedPassword, isAdmin: userCount === 0 });
        await newUser.save();

        res.status(201).json({ message: "Account created successfully!" });
    } catch (error) {
        console.error("❌ Registration error:", error);
        res.status(500).json({ message: "Server error during registration." });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !user.password) {
            return res.status(400).json({ message: "Invalid credentials or Try OTP Login." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials." });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: "Login successful!",
            token,
            user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin }
        });
    } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({ message: "Server error during login." });
    }
});

// ==========================================
// 🔄 FORGOT PASSWORD ROUTES
// ==========================================

// 1. SEND RESET OTP
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) return res.status(404).json({ message: "User with this email does not exist." });

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 1000000).toString();
        
        user.otp = otp;
        user.otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
        await user.save();

        // Email the OTP
        const message = `You requested a password reset.\n\nYour Password Reset OTP is: ${otp}\n\nIf you did not request this, please ignore this email.`;
        
        await sendEmail({
            email: user.email,
            subject: 'Cartify - Password Reset OTP 🔐',
            message: message
        });

        res.status(200).json({ message: "Password reset OTP sent to your email!" });
    } catch (error) {
        console.error("❌ Forgot password OTP error:", error);
        res.status(500).json({ message: "Error sending reset OTP." });
    }
});

// 2. VERIFY OTP AND SET NEW PASSWORD
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found." });

        // Check if OTP matches and is not expired
        if (user.otp !== otp || user.otpExpire < Date.now()) {
            return res.status(400).json({ message: "Invalid or Expired OTP." });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        // Clear the OTP fields
        user.otp = undefined;
        user.otpExpire = undefined;
        await user.save();

        res.status(200).json({ message: "Password reset successful! You can now login." });
    } catch (error) {
        console.error("❌ Reset password error:", error);
        res.status(500).json({ message: "Error resetting password." });
    }
});

// ==========================================
// 👤 USER PROFILE SETTINGS (UPDATE & DELETE)
// ==========================================

// 1. UPDATE PROFILE (Name change)
router.put('/update/:id', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: "You can only update your own profile." });
        }
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id, 
            { name: req.body.name }, 
            { new: true }
        );
        
        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ 
            message: "Profile updated successfully!", 
            user: { id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, isAdmin: updatedUser.isAdmin } 
        });
    } catch (error) {
        console.error("❌ Profile update error:", error);
        res.status(500).json({ message: "Error updating profile." });
    }
});

// 2. DELETE ACCOUNT
router.delete('/delete/:id', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: "You can only delete your own account." });
        }
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Account deleted permanently." });
    } catch (error) {
        console.error("❌ Account delete error:", error);
        res.status(500).json({ message: "Error deleting account." });
    }
});
// ==========================================
// 🌐 GOOGLE LOGIN ROUTE
// ==========================================
router.post('/google', async (req, res) => {
    try {
        const { name, email } = req.body;
        
        // Check if user already exists
        let user = await User.findOne({ email });

        if (!user) {
            const userCount = await User.countDocuments();
            const generatedPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(generatedPassword, 10);

            user = new User({
                name,
                email,
                password: hashedPassword,
                isAdmin: userCount === 0
            });
            await user.save();
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error("Google Login Error:", error);
        res.status(500).json({ message: "Google login failed" });
    }
});

module.exports = router;