const mongoose = require('mongoose');

// Product blueprint (Schema)
const productSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    price: { 
        type: Number, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    category: { 
        type: String, 
        required: true 
    },
    image: { 
        type: String, 
        required: true 
    },
    countInStock: {
        type: Number,
        default: 20,
        min: 0
    },
    // Clothing-style variants. Only clothing/apparel products carry these; every
    // other product keeps the flat countInStock behaviour untouched.
    // Each variant = one sellable SKU (e.g. "Puma Hoodie / Black / M").
    // Stock is variant-aware: effective stock = sum(variant.stock) when variants
    // exist, else countInStock (legacy behaviour preserved).
    variants: [
        {
            size: {
                type: String,
                trim: true,
                maxlength: 20,
                default: null
            },
            color: {
                type: String,
                trim: true,
                maxlength: 40,
                default: null
            },
            // Server-generated barcode-style SKU when omitted
            // ({productId}-{SIZE}-{COLOR}), unique per variant row.
            sku: {
                type: String,
                trim: true,
                maxlength: 80,
                default: null
            },
            stock: {
                type: Number,
                default: 0,
                min: 0
            },
            // Optional price delta on top of the base product price
            // (e.g. +200 for XXL). Negative allowed for cheaper variants.
            priceAdjustment: {
                type: Number,
                default: 0
            }
        }
    ],
    rating: {
        rate: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    }
}, { timestamps: true }); // timestamps adds 'createdAt' and 'updatedAt' automatically

// Hot read paths: category filtering and title-prefix searches benefit from these.
productSchema.index({ category: 1 });
productSchema.index({ title: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ category: 1, createdAt: -1 });

// Text index for full-text search (alternative to regex)
productSchema.index({ title: 'text', description: 'text' });

// Export this schema so it can be used in other files
module.exports = mongoose.model('Product', productSchema);