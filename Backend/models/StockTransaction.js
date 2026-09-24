const mongoose = require('mongoose');

// StockTransaction = immutable audit trail of every inventory movement.
// One document per movement (adjust / transfer-in / transfer-out / restock-out).
// It's write-only by design: nothing in the app edits these rows, they exist so
// admin can see WHERE stock went and answer "did we lose units?".
const stockTransactionSchema = new mongoose.Schema({
    // Direction of the movement. 'adjustment' = direct admin edit at one hub
    // (positive for restock-up, negative for reduction). 'transfer_out' /
    // 'transfer_in' pair a StockTransfer: out decrements the source warehouse,
    // in increments the destination — both get their own row sharing transferId.
    type: {
        type: String,
        enum: ['adjustment', 'transfer_in', 'transfer_out'],
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    variantKey: {
        type: String,
        default: null,
        trim: true
    },
    warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: true,
        index: true
    },
    // Signed delta in units: +restock, -reduction, -outbound, +inbound.
    quantityDelta: {
        type: Number,
        required: true
    },
    // Balance at this warehouse AFTER the movement (snapshot, not recomputed)
    // so the ledger stays correct even if a warehouse row is later deleted/merged.
    balanceAfter: {
        type: Number,
        default: 0,
        min: 0
    },
    // For transfer rows: the paired warehouse (source for _in, destination for _out)
    // and the shared transferId that groups a transfer_in + transfer_out pair.
    transferId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    oppositeWarehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    note: {
        type: String,
        default: '',
        maxlength: 300
    },
    // Who made the change (admin userid). Kept so disputes can be resolved.
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

// Ledger queries: per-product history, per-warehouse history, transfer grouping.
stockTransactionSchema.index({ productId: 1, createdAt: -1 });
stockTransactionSchema.index({ warehouseId: 1, createdAt: -1 });
stockTransactionSchema.index({ transferId: 1 });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);