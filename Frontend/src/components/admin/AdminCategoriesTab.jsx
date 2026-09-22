import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Loader2, X, Tag } from 'lucide-react';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '../../services/categoriesApi';
import { isNetworkError } from '../../utils/apiError';
import ConfirmModal from '../ConfirmModal';

const EMPTY_FORM = { name: '', description: '', image: '', sortOrder: 0, isActive: true };

function AdminCategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmModal, setConfirmModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCategories(true);
      setCategories(res.data.categories || []);
    } catch (err) {
      if (!isNetworkError(err)) toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (cat) => {
    setEditingId(cat._id);
    setForm({ name: cat.name, description: cat.description || '', image: cat.image || '', sortOrder: cat.sortOrder || 0, isActive: cat.isActive });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      toast.error('Category name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateCategory(editingId, form);
        toast.success('Category updated');
      } else {
        await createCategory(form);
        toast.success('Category created');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cat) => {
    setConfirmModal({
      show: true,
      title: 'Delete Category',
      message: `Delete "${cat.name}"? Products in this category are not deleted.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        try {
          await deleteCategory(cat._id);
          toast.success('Category deleted');
          await load();
          setConfirmModal(null);
        } catch (err) {
          toast.error(err?.response?.data?.message || 'Failed to delete category');
        }
      },
    });
  };

  const toggleActive = async (cat) => {
    try {
      await updateCategory(cat._id, { isActive: !cat.isActive });
      setCategories((prev) => prev.map((c) => (c._id === cat._id ? { ...c, isActive: !cat.isActive } : c)));
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-600">
            <Tag size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold text-gray-800">Categories</h2>
            <p className="text-sm text-gray-500">{categories.length} total</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition-colors"
        >
          <Plus size={16} aria-hidden="true" /> Add category
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-teal-600" size={30} aria-hidden="true" /></div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <Tag size={36} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
          <p className="font-semibold text-gray-600">No categories yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first category to organise products.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Products</th>
                  <th className="p-3">Sort</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((cat) => (
                  <tr key={cat._id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {cat.image ? (
                          <img src={cat.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <span className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                            <Tag size={16} aria-hidden="true" />
                          </span>
                        )}
                        <div>
                          <p className="font-bold text-gray-800">{cat.name}</p>
                          {cat.description && <p className="text-xs text-gray-400 truncate max-w-[260px]">{cat.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">{cat.productCount ?? 0}</td>
                    <td className="p-3 text-gray-600">{cat.sortOrder ?? 0}</td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleActive(cat)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          cat.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}
                      >
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(cat)} className="p-2 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-teal-50" aria-label="Edit">
                          <Edit size={16} aria-hidden="true" />
                        </button>
                        <button onClick={() => handleDelete(cat)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" aria-label="Delete">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-label="Category form">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">{editingId ? 'Edit category' : 'Add category'}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Close">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="cat-name" className="block text-sm font-medium text-gray-600 mb-1">Name *</label>
                <input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Men&#39;s Clothing"
                  maxLength={100}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                />
              </div>
              <div>
                <label htmlFor="cat-desc" className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  id="cat-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                />
              </div>
              <div>
                <label htmlFor="cat-img" className="block text-sm font-medium text-gray-600 mb-1">Image URL</label>
                <input
                  id="cat-img"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  type="url"
                  maxLength={500}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cat-sort" className="block text-sm font-medium text-gray-600 mb-1">Sort order</label>
                  <input
                    id="cat-sort"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                    type="number"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          show={confirmModal.show}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          cancelLabel={confirmModal.cancelLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

export default AdminCategoriesTab;