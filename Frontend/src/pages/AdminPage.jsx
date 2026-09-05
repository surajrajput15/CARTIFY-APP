import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import toast from 'react-hot-toast';
import { uploadImage } from '../services/productsApi';
import { useAdminProducts } from '../hooks/useAdminProducts';
import { filterProducts, getProductCategories, EMPTY_PRODUCT_FORM } from '../utils/products';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import AdminHeader from '../components/admin/AdminHeader';
import AdminFilterBar from '../components/admin/AdminFilterBar';
import ProductTable from '../components/admin/ProductTable';
import ProductFormModal from '../components/admin/ProductFormModal';
import AdminOrdersTab from '../components/admin/AdminOrdersTab';
import { isNetworkError } from '../utils/apiError';

const CLOSED_CONFIRM = { show: false, title: '', message: '', onConfirm: null, loading: false };

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { products, loading, fetchProducts, saveProduct, deleteProduct, seedProducts, clearAllProducts } = useAdminProducts();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [confirmModal, setConfirmModal] = useState(CLOSED_CONFIRM);
  const [form, setForm] = useState(EMPTY_PRODUCT_FORM);
  const [adminTab, setAdminTab] = useState('products');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    if (!user || !user.isAdmin) {
      navigate('/');
      return;
    }
    fetchProducts()
      .catch((err) => {
        if (!isNetworkError(err)) {
          toast.error('Failed to load products');
        }
      });
  }, [user, navigate, fetchProducts]);

  const filteredProducts = useMemo(
    () => filterProducts(products, { searchTerm, filterCategory }),
    [products, searchTerm, filterCategory]
  );

  const categories = useMemo(() => getProductCategories(products), [products]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { data } = await uploadImage(file);
      setForm({ ...form, image: data.image });
    } catch (err) {
      if (isNetworkError(err)) {
        toast.error('Backend is unreachable. Please start the server and try again.');
      } else {
        toast.error('Upload failed');
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveProduct({ product: form, editingProduct });
      setShowForm(false);
      setEditingProduct(null);
      setForm(EMPTY_PRODUCT_FORM);
    } catch (err) {
      if (isNetworkError(err)) {
        toast.error('Backend is unreachable. Please start the server and try again.');
      } else {
        toast.error('Failed to save product');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setForm({
      title: product.title || '',
      price: product.price?.toString() || '',
      description: product.description || '',
      category: product.category || 'electronics',
      image: product.image || '',
      countInStock: product.countInStock ?? 20,
      rating: { rate: product.rating?.rate || 0, count: product.rating?.count || 0 }
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Delete Product',
      message: 'Delete this product permanently?',
      loading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await deleteProduct(id);
        } catch (err) {
          if (isNetworkError(err)) {
            toast.error('Backend is unreachable. Please start the server and try again.');
          } else {
            toast.error('Failed to delete product');
          }
        } finally {
          setConfirmModal(CLOSED_CONFIRM);
        }
      }
    });
  };

  const handleSeed = () => {
    setConfirmModal({
      show: true,
      title: 'Seed Products',
      message: 'Add 20 sample products to the database?',
      loading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await seedProducts();
        } catch (err) {
          if (isNetworkError(err)) {
            toast.error('Backend is unreachable. Please start the server and try again.');
          } else {
            toast.error('Failed to seed products');
          }
        } finally {
          setConfirmModal(CLOSED_CONFIRM);
        }
      }
    });
  };

  const handleClearAll = () => {
    setConfirmModal({
      show: true,
      title: 'Clear All Products',
      message: 'Delete ALL products? This cannot be undone!',
      loading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await clearAllProducts();
        } catch (err) {
          if (isNetworkError(err)) {
            toast.error('Backend is unreachable. Please start the server and try again.');
          } else {
            toast.error('Failed to clear products');
          }
        } finally {
          setConfirmModal(CLOSED_CONFIRM);
        }
      }
    });
  };

  if (!user || !user.isAdmin) return null;

  const emptyMessage = searchTerm && filterCategory
    ? `No products match "${searchTerm}" in ${filterCategory} category.`
    : searchTerm
      ? `No products match "${searchTerm}".`
      : filterCategory
        ? `No products in the ${filterCategory} category.`
        : 'No products yet. Add your first product to get started.';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <nav className="flex gap-2 mb-6" role="tablist" aria-label="Admin sections">
        {['products', 'orders'].map((tab) => (
          <button
            key={tab}
            onClick={() => setAdminTab(tab)}
            aria-selected={adminTab === tab}
            role="tab"
            className={`px-4 sm:px-5 py-2 rounded-full text-sm font-bold capitalize transition-colors min-h-[44px] ${
              adminTab === tab
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {adminTab === 'products' && (
        <>
          <AdminHeader onBack={() => navigate('/')} onSeed={handleSeed} onClearAll={handleClearAll} />

          <AdminFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterCategory={filterCategory}
            onCategoryChange={setFilterCategory}
            categories={categories}
            productsCount={products.length}
            filteredCount={filteredProducts.length}
            hasFilters={Boolean(searchTerm || filterCategory)}
            onAddProduct={() => {
              setShowForm(true);
              setEditingProduct(null);
              setForm(EMPTY_PRODUCT_FORM);
            }}
          />

          {showForm && (
            <ProductFormModal
              form={form}
              setForm={setForm}
              saving={saving}
              isEditing={Boolean(editingProduct)}
              onImageUpload={handleImageUpload}
              onSubmit={handleSave}
              onClose={() => setShowForm(false)}
            />
          )}

          {loading ? (
            <Spinner />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              message={emptyMessage}
              onClearFilters={() => { setSearchTerm(''); setFilterCategory(''); }}
            />
          ) : (
            <ProductTable products={filteredProducts} onEdit={handleEdit} onDelete={handleDelete} />
          )}
        </>
      )}

      {adminTab === 'orders' && <AdminOrdersTab />}

      {confirmModal.show && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          loading={confirmModal.loading}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(CLOSED_CONFIRM)}
        />
      )}
    </div>
  );
};

export default AdminPage;
