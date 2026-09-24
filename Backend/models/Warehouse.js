const mongoose = require('mongoose');

// Warehouse = a physical fulfilment location. InventoryItem rows reference a
// warehouse by _id; every product's sellable stock (Product.countInStock and
// variants[].stock) is the SUM across all warehouses — per-warehouse rows are
// the source of truth the admin edits, sellable numbers stay the derived view.
const warehouseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },
    // Short unique code used in transfer/ledger references (e.g. "DEL", "MUM").
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: 10
    },
    city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 60
    },
    state: {
        type: String,
        required: true,
        trim: true,
        maxlength: 60
    },
    addressLine: {
        type: String,
        default: '',
        maxlength: 300
    },
    // managerContact is a free-form phone number asked at creation; no delivery
    // logic reads it today, it exists for reachability of the handling team.
    managerName: {
        type: String,
        default: '',
        trim: true,
        maxlength: 80
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Active-first for admin pickers; uniqueness on name for human-friendly refs.
warehouseSchema.index({ isActive: 1, name: 1 });
warehouseSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Warehouse', warehouseSchema);