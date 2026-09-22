const mongoose = require('mongoose');

// Wishlist blueprint (Schema)
const wishlistItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// One entry per user+product — duplicates are rejected at the database level.
wishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Fast lookups of a user's entire wishlist.
wishlistItemSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Wishlist', wishlistItemSchema);
