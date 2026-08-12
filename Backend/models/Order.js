const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // Cart Items ka format (server-calculated, price is authoritative from Product)
    orderItems: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            title: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, default: 1 }
        }
    ],
    // Address ka format
    shippingAddress: {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pinCode: { type: String, required: true }
    },
    // Razorpay Payment Details (server-authoritative, never accepted from the client)
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String },
    // Payment lifecycle: Pending -> Paid (only ever transitioned server-side)
    paymentStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
    paidAt: { type: Date },
    // Set to true when payment was captured but stock reservation failed at verify-time.
    // Flags the order for fulfilment/refund so it is never silently treated as a clean sale.
    stockShortfall: { type: Boolean, default: false },
    // Final Amount — always recomputed server-side on creation, never accepted from client
    totalPrice: { 
        type: Number, 
        required: true 
    },
    // Order lifecycle status (orderStatus): Pending -> Processing (Paid) -> Delivered
    status: { 
        type: String, 
        default: 'Pending' 
    },
    // TTL expiry — set only on Pending (never-paid) orders so abandoned checkouts
    // are purged automatically and cannot grow the orders collection unbounded.
    expireAt: { type: Date, default: undefined }
}, { timestamps: true });

// Auto-purge Pending orders one day after they were created (never applies to Paid orders).
orderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Order', orderSchema);