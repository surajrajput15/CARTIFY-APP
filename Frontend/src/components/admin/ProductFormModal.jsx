import { Loader2 } from 'lucide-react';
import { resolveImageUrl } from '../../utils/imageUrl';

const CATEGORIES = ['electronics', 'clothing', 'footwear', 'accessories', 'furniture', 'beauty'];

const ProductFormModal = ({ form, setForm, saving, isEditing, onImageUpload, onSubmit, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
    <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-xl font-bold text-gray-900 mb-6">{isEditing ? 'Edit Product' : 'Add New Product'}</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="text" placeholder="Product Title" required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500" />
        <input type="number" step="0.01" placeholder="Price (₹)" required value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500" />
        <textarea placeholder="Description" required value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500" />
        <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
          <input type="file" accept="image/*" onChange={onImageUpload} className="w-full px-4 py-3 rounded-xl border border-gray-200" />
          {form.image && <img src={resolveImageUrl(form.image)} alt="preview" className="mt-2 h-24 object-contain rounded-lg border" />}
        </div>
        <div className="flex gap-4">
          <input type="number" step="0.1" placeholder="Rating (0-5)" value={form.rating.rate} onChange={(e) => setForm({...form, rating: {...form.rating, rate: e.target.value}})} className="w-1/2 px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500" />
          <input type="number" placeholder="Review Count" value={form.rating.count} onChange={(e) => setForm({...form, rating: {...form.rating, count: e.target.value}})} className="w-1/2 px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={20} /> : null} {isEditing ? 'Update Product' : 'Save Product'}
          </button>
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
        </div>
      </form>
    </div>
  </div>
);

export default ProductFormModal;
