const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // Cart item format (server-calculated, price is authoritative from Product).
    // variantKey is optional — legacy orders (V1) and non-clothing products have
    // no variant; variant purchases store the resolved variant snapshot so the
    // courier/admin always sees exactly which size/colour was sold.
    orderItems: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            title: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, default: 1 },
            variantKey: { type: String, default: null },
            variantSize: { type: String, default: null },
            variantColor: { type: String, default: null }
        }
    ],
    // Shipping address format
    // latitude/longitude are optional geo-coordinates captured at checkout so the
    // assigned delivery partner can navigate to the drop-off point.
    shippingAddress: {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pinCode: { type: String, required: true },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null }
    },
    // Razorpay Payment Details (server-authoritative, never accepted from the client)
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String },
    refundId: { type: String },
    // Payment lifecycle: Pending -> Paid -> Refunded (only ever transitioned server-side)
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Refunded'], default: 'Pending' },
    paidAt: { type: Date },
    // Set to true when payment was captured but stock reservation failed at verify-time.
    // Flags the order for fulfilment/refund so it is never silently treated as a clean sale.
    stockShortfall: { type: Boolean, default: false },
    // Final Amount — always recomputed server-side on creation, never accepted from client
    totalPrice: { 
        type: Number, 
        required: true 
    },
    // Coupon applied at checkout (code as typed + discount granted). Discount is
    // recomputed and validated server-side; usage is debited on Paid only.
    couponCode: {
        type: String,
        default: null,
        uppercase: true,
        trim: true,
    },
    discountAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Snapshot so history survives coupon deletion/rename and can show
    // strikethrough savings. Always set (equals totalPrice when no coupon).
    // Not strictly required for backward compat (old orders/tests lack it) —
    // auto-filled to totalPrice on save when missing.
    originalTotal: {
        type: Number,
        min: 0,
    },
    couponSnapshot: {
        code: { type: String },
        type: { type: String, enum: ['percentage', 'fixed'] },
        value: { type: Number },
        maxDiscount: { type: Number, default: null },
        minOrderAmount: { type: Number, default: 0 },
    },
    // Campaign applied at checkout (auto, not user-entered). Best-of rule:
    // exactly one of couponCode / campaignCode may be set — whichever discounts
    // more. Snapshot survives campaign edits so order history is stable.
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        default: null,
    },
    campaignCode: {
        type: String,
        default: null,
        trim: true,
    },
    campaignDiscountAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    campaignSnapshot: {
        _id: { type: mongoose.Schema.Types.ObjectId },
        name: { type: String },
        slug: { type: String, default: null },
        discountType: { type: String, enum: ['percentage', 'fixed'] },
        discountValue: { type: Number },
        maxDiscount: { type: Number, default: null },
        minOrderAmount: { type: Number, default: 0 },
        bannerText: { type: String, default: '' },
        bannerColor: { type: String, default: null },
    },
    // Order lifecycle status (orderStatus): 
    // Pending -> Confirmed -> Processing -> Packed -> Shipped -> Out for Delivery -> Delivered
    // Also: Cancelled, Failed, Returned, Refunded
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Failed', 'Returned', 'Refunded'],
        default: 'Pending'
    },
    // Delivery partner assignment
    deliveryPartnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    // Delivery workflow status (separate from order status for granular tracking)
    // not_assigned -> assigned -> accepted -> picked_up -> out_for_delivery -> delivered
    // Also: failed, cancelled
    deliveryStatus: {
        type: String,
        enum: ['not_assigned', 'assigned', 'accepted', 'picked_up', 'out_for_delivery', 'delivered', 'failed', 'cancelled'],
        default: 'not_assigned'
    },
    // Delivery timestamp milestones
    assignedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    outForDeliveryAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    // TTL expiry — set only on Pending (never-paid) orders so abandoned checkouts
    // are purged automatically and cannot grow the orders collection unbounded.
    expireAt: { type: Date, default: undefined }
}, { timestamps: true });

// Backfill originalTotal for legacy orders / tests that omit it.
orderSchema.pre('validate', function () {
  if (this.originalTotal == null && this.totalPrice != null) {
    this.originalTotal = this.totalPrice;
  }
});

// Auto-purge Pending orders one day after they were created (never applies to Paid orders).
orderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

// Hot read path: a user's order history is fetched by userId, newest first.
orderSchema.index({ userId: 1, createdAt: -1 });

// Admin: paginated order listing with status filter
orderSchema.index({ status: 1, createdAt: -1 });

// Admin: lookup by Razorpay payment ID
orderSchema.index({ razorpayPaymentId: 1 });

// Compound index for admin dashboard queries
orderSchema.index({ status: 1, paymentStatus: 1, createdAt: -1 });

// Delivery partner: find orders assigned to a delivery partner
orderSchema.index({ deliveryPartnerId: 1, createdAt: -1 });

// Delivery workflow queries: find orders by deliveryStatus
orderSchema.index({ deliveryStatus: 1, createdAt: -1 });

// Compound index for delivery partner active orders (pending/running deliveries)
orderSchema.index({ deliveryPartnerId: 1, deliveryStatus: 1 });

module.exports = mongoose.model('Order', orderSchema);