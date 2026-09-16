const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { 
        type: String, 
        required: true, 
        unique: true, 
        uppercase: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    type: { 
        type: String, 
        enum: ['percentage', 'fixed'], 
        required: true 
    },
    value: { 
        type: Number, 
        required: true,
        min: 0,
        max: 10000000
    },
    minOrderAmount: { 
        type: Number, 
        default: 0,
        min: 0
    },
    maxDiscount: { 
        type: Number,
        default: null
    },
    usageLimit: { 
        type: Number, 
        default: null,
        min: 1
    },
    usedCount: { 
        type: Number, 
        default: 0,
        min: 0
    },
    userLimit: { 
        type: Number, 
        default: 1,
        min: 1
    },
    applicableCategories: [{ 
        type: String,
        trim: true
    }],
    applicableProducts: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product' 
    }],
    excludedProducts: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product' 
    }],
    validFrom: { 
        type: Date, 
        default: Date.now 
    },
    validUntil: { 
        type: Date, 
        required: true 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    usedBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        usedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Indexes (code already has unique index from schema `unique: true` — no duplicate)
couponSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
couponSchema.index({ 'usedBy.userId': 1 });

// Virtual for checking if coupon is currently valid
couponSchema.virtual('isCurrentlyValid').get(function() {
    const now = new Date();
    return this.isActive && 
           now >= this.validFrom && 
           now <= this.validUntil &&
           (this.usageLimit === null || this.usedCount < this.usageLimit);
});

// Method to check if user can use this coupon based on usage limits only.
// minOrderAmount is intentionally NOT checked here — it requires the live
// order total, so apply() validates it at application time instead.
// This method is suitable for checking user-specific usage limits (userLimit,
// per-use count) but NOT for checking minimum order amount.
couponSchema.methods.canUserUse = function(userId) {
    if (!this.isCurrentlyValid) return false;
    const userUsage = this.usedBy.filter(u => u.userId?.toString() === userId.toString()).length;
    return userUsage < this.userLimit;
};

// Method to apply coupon
couponSchema.methods.apply = function(userId, orderAmount, items = []) {
    if (!this.canUserUse(userId)) {
        return { valid: false, message: 'Coupon not valid for this user' };
    }
    if (orderAmount < this.minOrderAmount) {
        return { valid: false, message: `Minimum order amount of ₹${this.minOrderAmount} required` };
    }
    
    // Check category applicability
    if (this.applicableCategories.length > 0) {
        // This would need product category data passed in
        // For now, we'll handle this at the API level
    }
    
    // Check product applicability
    if (this.applicableProducts.length > 0) {
        const hasApplicableProduct = items.some(item => 
            this.applicableProducts.some(pId => pId.toString() === item.productId.toString())
        );
        if (!hasApplicableProduct) {
            return { valid: false, message: 'Coupon not applicable to items in cart' };
        }
    }
    
    // Check excluded products
    if (this.excludedProducts.length > 0) {
        const hasExcludedProduct = items.some(item => 
            this.excludedProducts.some(pId => pId.toString() === item.productId.toString())
        );
        if (hasExcludedProduct) {
            return { valid: false, message: 'Coupon not valid for some items in cart' };
        }
    }
    
    // Paise-integer discount — same formula as /validate preview and
    // payment create-order charge so all three never drift by 1p.
    const orderPaise = Math.round(orderAmount * 100);
    let discountPaise = 0;
    if (this.type === 'percentage') {
        discountPaise = Math.round(orderPaise * (this.value / 100));
        if (this.maxDiscount) {
            discountPaise = Math.min(discountPaise, Math.round(this.maxDiscount * 100));
        }
    } else {
        discountPaise = Math.min(Math.round(this.value * 100), orderPaise);
    }
    const discount = discountPaise / 100;
    
    return { 
        valid: true, 
        discount,
        finalAmount: Math.max(0, orderAmount - discount)
    };
};

// Method to record usage — atomic so concurrent Paid finalisations can never
// overshoot usageLimit (global) or userLimit (per-user). Both guards live in the
// DB filter; callers treat a null return as "limit hit concurrently".
couponSchema.methods.recordUsage = function(userId) {
    const mongoose = require('mongoose');
    const uid = new mongoose.Types.ObjectId(String(userId));
    return this.constructor.findOneAndUpdate(
        {
            _id: this._id,
            $expr: {
                $and: [
                    { $or: [{ $eq: ['$usageLimit', null] }, { $lt: ['$usedCount', '$usageLimit'] }] },
                    { $lt: [{ $size: { $ifNull: ['$usedBy', []] } }, 100000] },
                    {
                        $lt: [
                            {
                                $size: {
                                    $filter: {
                                        input: { $ifNull: ['$usedBy', []] },
                                        cond: { $eq: ['$$this.userId', uid] },
                                    },
                                },
                            },
                            '$userLimit',
                        ],
                    },
                ],
            },
        },
        {
            $inc: { usedCount: 1 },
            $push: { usedBy: { userId: uid, usedAt: new Date() } },
        },
        { returnDocument: 'after' }
    );
};

module.exports = mongoose.model('Coupon', couponSchema);