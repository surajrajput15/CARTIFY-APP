const mongoose = require('mongoose');

// Festival / Seasonal campaign — a server-authoritative discount engine that
// auto-applies to eligible products during a date window. Distinct from coupons:
// a coupon is opt-in (user types a code), a campaign is on by default (storefront
// shows the sale price automatically). Both are validated by their own engine and
// can't stack — checkout picks the better of coupon vs campaign.
const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 80,
    },
    description: { type: String, default: '', maxlength: 500 },
    // Storefront banner text / image (Cloudinary URL or a colour hex).
    bannerText: { type: String, default: '', maxlength: 120 },
    bannerImage: { type: String, default: null },
    bannerColor: {
      type: String,
      default: '#0f766e',
      match: /^#[0-9a-fA-F]{6}$/,
    },

    // Discount definition. percentage: value in % off; fixed: flat rupees off.
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0.01,
    },
    // Cap for percentage campaigns (best of discountValue% and maxDiscount).
    maxDiscount: { type: Number, default: null, min: 0 },
    // Minimum order total (INR) for the campaign to apply at all.
    minOrderAmount: { type: Number, default: 0, min: 0 },

    // Eligibility scope. Empty categories + empty products = entire catalogue.
    // Otherwise a product qualifies if its category is listed OR its _id is listed.
    eligibleCategories: {
      type: [String],
      default: [],
      validate: {
        validator: (cats) => cats.every((c) => typeof c === 'string' && c.trim()),
        message: 'Category names must be non-empty strings',
      },
    },
    eligibleProductIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Product',
      default: [],
    },

    // Active window. A campaign only applies when enabled AND inside [start, end].
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Sparse unique slug so a campaign can exist without one.
campaignSchema.index({ slug: 1 }, { unique: true, sparse: true });
// Storefront fetch: enabled + on-going campaigns.
campaignSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);