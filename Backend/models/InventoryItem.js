const mongoose = require('mongoose');

// InventoryItem = a single product's stock at a single warehouse.
//   - One row per (productId, warehouseId) pair — quantity is that shelf's count.
//   - Product.countInStock / variants[].stock are the DERIVED sellable numbers
//     (sum across warehouses); maintenance of the derived view happens through
//     the inventory service (utils/inventory.js) so it can never drift.
//   - variantKey distinguishes size/colour rows: a product with variants keeps a
//     row per (productId, variantKey, warehouseId); a product without variants
//     keeps exactly one row per warehouse with variantKey: null.
const inventoryItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: true,
        index: true
    },
    // Which Product.variants[].key this row represents. null = base product.
    variantKey: {
        type: String,
        default: null,
        trim: true,
        maxlength: 80
    },
    quantity: {
        type: Number,
        default: 0,
        min: 0,
        required: true
    },
    // Soft threshold for Inventory Alerts (#7). Defaults to 0 (alert at empty);
    // the admin can raise it product-wide or per-row.
    lowStockThreshold: {
        type: Number,
        default: 0,
        min: 0
    }
}, { timestamps: true });

// Uniqueness: one row per (product, warehouse, variant). This is what turns a
// product's stock into a clean rectangle the admin can edit cell by cell.
inventoryItemSchema.index({ productId: 1, warehouseId: 1, variantKey: 1 }, { unique: true });
// Admin: "what's in this warehouse?" / "where is this product?" fast lookups.
inventoryItemSchema.index({ warehouseId: 1, createdAt: -1 });
inventoryItemSchema.index({ productId: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);