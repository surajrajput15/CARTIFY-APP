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