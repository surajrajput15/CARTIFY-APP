import { useState } from 'react';
import { Loader2, Plus, Trash2, Shirt } from 'lucide-react';
import { resolveImageUrl, PLACEHOLDER_IMG } from '../../utils/imageUrl';
import { PRODUCT_CATEGORIES } from '../../utils/constants';
import { EMPTY_VARIANT } from '../../utils/products';
import Modal from '../Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';

const sumStock = (variants) => variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

const ProductFormModal = ({ form, setForm, saving, isEditing, onImageUpload, onSubmit, onClose }) => {
  // Track image preview error state to safely handle broken URLs
  const [imageError, setImageError] = useState(false);

  const imageSrc = form.image && !imageError ? resolveImageUrl(form.image) : PLACEHOLDER_IMG;
  const variants = form.variants || [];
  const hasVariants = variants.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const updateVariant = (index, patch) => {
    setForm((prev) => {
      const next = (prev.variants || []).map((v, i) => (i === index ? { ...v, ...patch } : v));
      return { ...prev, variants: next, countInStock: sumStock(next) };
    });
  };

  const addVariant = () => {
    setForm((prev) => {
      const next = [...(prev.variants || []), { ...EMPTY_VARIANT }];
      return { ...prev, variants: next, countInStock: sumStock(next) };
    });
  };

  const removeVariant = (index) => {
    setForm((prev) => {
      const next = (prev.variants || []).filter((_, i) => i !== index);
      return { ...prev, variants: next, countInStock: next.length ? sumStock(next) : prev.countInStock };
    });
  };

  return (
    <Modal
      title={isEditing ? 'Edit Product' : 'Add New Product'}
      labelledBy="product-form-modal-title"
      onClose={onClose}
      className="max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-8"
    >
      <h2 id="product-form-modal-title" className="text-xl font-bold text-gray-900 mb-6">
        {isEditing ? 'Edit Product' : 'Add New Product'}
      </h2>
      <form onSubmit={handleSubmit} aria-busy={saving} className="space-y-4">
        <div>
          <label htmlFor="product-title" className="sr-only">Product title</label>
          <Input
            id="product-title"
            type="text"
            placeholder="Product Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-gray-200 min-h-[44px]"
            aria-label="Product Title"
          />
        </div>
        <div>
          <label htmlFor="product-price" className="sr-only">Price in INR</label>
          <Input
            id="product-price"
            type="number"
            step="0.01"
            placeholder="Price (₹)"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-gray-200 min-h-[44px]"
            aria-label="Price"
          />
        </div>
        <div>
          <label htmlFor="product-stock" className="sr-only">Stock quantity</label>
          <Input
            id="product-stock"
            type="number"
            min="0"
            step="1"
            placeholder="Stock Quantity"
            required
            disabled={hasVariants}
            value={hasVariants ? sumStock(variants) : form.countInStock}
            onChange={(e) => setForm({ ...form, countInStock: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-gray-200 min-h-[44px] disabled:bg-gray-100 disabled:text-gray-500"
            aria-label="Stock Quantity"
          />
          {hasVariants && (
            <p className="text-xs text-gray-500 mt-1">Total stock is the sum of variant stock.</p>
          )}
        </div>
        <div>
          <label htmlFor="product-description" className="sr-only">Product description</label>
          <textarea
            id="product-description"
            placeholder="Description"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500"
            aria-label="Description"
          />
        </div>
        <div>
          <label htmlFor="product-category" className="sr-only">Product category</label>
          <select
            id="product-category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
            aria-label="Category"
          >
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setImageError(false);
              onImageUpload(e);
            }}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 min-h-[44px]"
            aria-label="Upload product image"
          />
          <img
            src={imageSrc}
            alt="Product preview"
            onError={() => setImageError(true)}
            className="mt-2 h-24 object-contain rounded-lg border bg-gray-50"
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shirt size={16} className="text-teal-600" aria-hidden="true" />
              <span className="text-sm font-bold text-gray-700">Clothing variants</span>
              {hasVariants && (
                <Badge variant="info" className="text-xs font-semibold px-2 py-0.5 rounded-full">
                  {variants.length}
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center gap-1 text-sm font-bold text-teal-600 hover:text-teal-800 min-h-[44px] px-2"
            >
              <Plus size={15} aria-hidden="true" /> Add variant
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Optional. Each row is one sellable SKU (e.g. Black / M). Stock is tracked per variant.
          </p>

          {hasVariants && (
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1.2fr_0.8fr_0.9fr_auto] gap-2 px-1 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                <span>Size</span><span>Color</span><span>SKU (auto)</span><span>Stock</span><span>Price ±</span><span />
              </div>
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1.2fr_0.8fr_0.9fr_auto] gap-2 items-center bg-gray-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <Input
                    type="text"
                    value={v.size}
                    onChange={(e) => updateVariant(i, { size: e.target.value })}
                    placeholder="Size"
                    maxLength={20}
                    aria-label={`Variant ${i + 1} size`}
                    className="px-3 py-2 rounded-lg border-gray-200 text-sm min-h-[44px]"
                  />
                  <Input
                    type="text"
                    value={v.color}
                    onChange={(e) => updateVariant(i, { color: e.target.value })}
                    placeholder="Color"
                    maxLength={40}
                    aria-label={`Variant ${i + 1} color`}
                    className="px-3 py-2 rounded-lg border-gray-200 text-sm min-h-[44px]"
                  />
                  <Input
                    type="text"
                    value={v.sku}
                    onChange={(e) => updateVariant(i, { sku: e.target.value })}
                    placeholder="Auto"
                    maxLength={80}
                    aria-label={`Variant ${i + 1} SKU`}
                    className="px-3 py-2 rounded-lg border-gray-200 text-sm min-h-[44px]"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={v.stock}
                    onChange={(e) => updateVariant(i, { stock: e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))) })}
                    aria-label={`Variant ${i + 1} stock`}
                    className="px-3 py-2 rounded-lg border-gray-200 text-sm min-h-[44px]"
                  />
                  <Input
                    type="number"
                    step="1"
                    value={v.priceAdjustment}
                    onChange={(e) => updateVariant(i, { priceAdjustment: e.target.value === '' ? '' : Number(e.target.value) })}
                    aria-label={`Variant ${i + 1} price adjustment`}
                    className="px-3 py-2 rounded-lg border-gray-200 text-sm min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    aria-label={`Remove variant ${i + 1}`}
                    className="justify-self-end p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="product-rating" className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Rating (from reviews)</label>
            <Input
              id="product-rating"
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={form.rating.rate}
              readOnly
              className="w-full px-4 py-3 rounded-xl border-gray-200 min-h-[44px] bg-gray-50 text-gray-600 cursor-not-allowed"
              aria-label="Rating (set by customer reviews)"
              title="Set by customer reviews — not editable here"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="product-review-count" className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Review count</label>
            <Input
              id="product-review-count"
              type="number"
              min="0"
              step="1"
              value={form.rating.count}
              readOnly
              className="w-full px-4 py-3 rounded-xl border-gray-200 min-h-[44px] bg-gray-50 text-gray-600 cursor-not-allowed"
              aria-label="Review count (set by customer reviews)"
              title="Set by customer reviews — not editable here"
            />
          </div>
        </div>
        {/* F-53: rating/review-count are admin-only metadata synced from real
            reviews — free-text entry here was fabricated social proof. */}
        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px]"
          >
            {saving ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : null}
            {isEditing ? 'Update Product' : 'Save Product'}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ProductFormModal;