const mongoose = require('mongoose');

// Live GPS position of a delivery partner while they are actively delivering.
// ONE document per delivery partner (keyed by unique deliveryPartnerId) — the
// latest position only, never a location history track (privacy + storage).
//
// Writes are allowed ONLY while the partner has an active delivery
// (assigned/accepted/picked_up/out_for_delivery) and are throttled server-side.
// Readers: the assigned partner (self), the customer who owns the order being
// delivered, and admins. There is deliberately no public/unauthenticated read.
const deliveryLocationSchema = new mongoose.Schema({
    deliveryPartnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    // The order the partner is currently delivering (denormalised for reader
    // authorization checks: customer-of-order can read partner location).
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
    },
    longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
    },
    // Cleaned when the delivery completes/fails so stale positions are never
    // served after the run ends (map shows "live location unavailable").
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true }); // createdAt/updatedAt — updatedAt = last fix time

// Admin delivery map: fresh locations first.
deliveryLocationSchema.index({ updatedAt: -1 });
// Reader lookup by the order being delivered (customer tracking page).
deliveryLocationSchema.index({ orderId: 1 });

module.exports = mongoose.model('DeliveryLocation', deliveryLocationSchema);