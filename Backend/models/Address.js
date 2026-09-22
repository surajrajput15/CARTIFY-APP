const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pinCode: { type: String, required: true },
    // Optional GPS pin captured on the address map. Coordinates NEVER replace
    // the human-readable fields above — they only enrich them for delivery
    // navigation/tracking. Both or neither (validated at the route layer).
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
    isDefault: { type: Boolean, default: false },
}, { timestamps: true });

// Addresses are always read/written per user.
addressSchema.index({ userId: 1 });
// Unique partial index: only one default address per user
addressSchema.index(
    { userId: 1, isDefault: 1 },
    { unique: true, partialFilterExpression: { isDefault: true } }
);

module.exports = mongoose.model('Address', addressSchema);