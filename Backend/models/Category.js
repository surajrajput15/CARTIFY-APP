const mongoose = require('mongoose');

// Category = product taxonomy. Products reference a category by its canonical
// `name` (products.category stays a plain String for backward compatibility),
// so categories are metadata/management layer — never a second source of truth
// for product data.
const categorySchema = new mongoose.Schema({
    // Canonical display name. Products match on this exact string (case-sensitive trim).
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 60
    },
    // URL-friendly identifier for future routing/filtering.
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 80
    },
    description: {
        type: String,
        default: '',
        maxlength: 500
    },
    // Optional category tile/banner image URL (Cloudinary or local /uploads path).
    image: {
        type: String,
        default: null,
        maxlength: 500
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Display ordering for storefront/category pickers.
    sortOrder: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Admin listing is alphabetical with active-first filtering.
categorySchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Category', categorySchema);