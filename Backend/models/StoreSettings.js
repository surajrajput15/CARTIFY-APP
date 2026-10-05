const mongoose = require('mongoose');

const storeSettingsSchema = new mongoose.Schema({
  storeName: {
    type: String,
    default: 'Cartify',
    trim: true,
    maxlength: 100
  },
  supportEmail: {
    type: String,
    default: 'support@cartify.com',
    trim: true,
    lowercase: true,
    maxlength: 100
  },
  supportPhone: {
    type: String,
    default: '+91 98765 43210',
    trim: true,
    maxlength: 30
  },
  currency: {
    type: String,
    default: 'INR',
    trim: true,
    uppercase: true,
    maxlength: 10
  },
  currencySymbol: {
    type: String,
    default: '₹',
    trim: true,
    maxlength: 5
  },
  shippingFee: {
    type: Number,
    default: 40,
    min: 0
  },
  freeShippingThreshold: {
    type: Number,
    default: 500,
    min: 0
  },
  defaultLowStockThreshold: {
    type: Number,
    default: 5,
    min: 0
  },
  orderAutoCancelMinutes: {
    type: Number,
    default: 1440, // 24 hours
    min: 15
  },
  systemNotificationsEnabled: {
    type: Boolean,
    default: true
  },
  emailNotificationsEnabled: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Ensure single configuration document
storeSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({});
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);
