import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { resolveImageUrl } from '../../utils/imageUrl';
import { PRODUCT_CATEGORIES } from '../../utils/constants';
import Modal from '../Modal';

const PLACEHOLDER_IMG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cmVjdCB3aWR0aDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

const ProductFormModal = ({ form, setForm, saving, isEditing, onImageUpload, onSubmit, onClose }) => {
  // Track image preview error state to safely handle broken URLs
  const [imageError, setImageError] = useState(false);

  const imageSrc = form.image && !imageError ? resolveImageUrl(form.image) : PLACEHOLDER_IMG;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="product-title" className="sr-only">Product title</label>
          <input
            id="product-title"
            type="text"
            placeholder="Product Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
            aria-label="Product Title"
          />
        </div>
        <div>
          <label htmlFor="product-price" className="sr-only">Price in INR</label>
          <input
            id="product-price"
            type="number"
            step="0.01"
            placeholder="Price (₹)"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
            aria-label="Price"
          />
        </div>
        <div>
          <label htmlFor="product-stock" className="sr-only">Stock quantity</label>
          <input
            id="product-stock"
            type="number"
            min="0"
            step="1"
            placeholder="Stock Quantity"
            required
            value={form.countInStock}
            onChange={(e) => setForm({ ...form, countInStock: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
            aria-label="Stock Quantity"
          />
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
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="product-rating" className="sr-only">Rating (0 to 5)</label>
            <input
              id="product-rating"
              type="number"
              step="0.1"
              min="0"
              max="5"
              placeholder="Rating (0-5)"
              value={form.rating.rate}
              onChange={(e) => setForm({ ...form, rating: { ...form.rating, rate: e.target.value } })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
              aria-label="Rating"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="product-review-count" className="sr-only">Review count</label>
            <input
              id="product-review-count"
              type="number"
              min="0"
              step="1"
              placeholder="Review Count"
              value={form.rating.count}
              onChange={(e) => setForm({ ...form, rating: { ...form.rating, count: e.target.value } })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
              aria-label="Review Count"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px]"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : null}
            {isEditing ? 'Update Product' : 'Save Product'}
          </button>
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