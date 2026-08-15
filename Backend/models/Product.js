const mongoose = require('mongoose');

// Product ka Blueprint (Schema)
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
}, { timestamps: true }); // timestamps true karne se 'createdAt' aur 'updatedAt' apne aap add ho jayega

// Hot read paths: category filtering and title-prefix searches benefit from these.
productSchema.index({ category: 1 });
productSchema.index({ title: 1 });

// Is schema ko export karna taaki hum isko doosri files mein use kar sakein
module.exports = mongoose.model('Product', productSchema);