import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import {
  LayoutDashboard, Package, Tag, Warehouse, ShoppingBag, Ticket,
  Zap, Users, MessageSquare, Truck, BarChart3, ShieldCheck,
  Bell, Activity, FileText, Settings, Menu, X, ChevronDown
} from 'lucide-react';
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
import { isNetworkError } from '../utils/apiError';
import { usePageTitle } from '../hooks/usePageTitle';

const AdminOrdersTab = lazy(() => import('../components/admin/AdminOrdersTab'));
const AdminCouponsTab = lazy(() => import('../components/admin/AdminCouponsTab'));
const AdminDeliveryMap = lazy(() => import('../components/admin/AdminDeliveryMap'));
const AdminDeliveryAssign = lazy(() => import('../components/admin/AdminDeliveryAssign'));
const AdminCategoriesTab = lazy(() => import('../components/admin/AdminCategoriesTab'));
const AdminWarehousesTab = lazy(() => import('../components/admin/AdminWarehousesTab'));
const AdminCampaignsTab = lazy(() => import('../components/admin/AdminCampaignsTab'));
const AdminAuditLogsTab = lazy(() => import('../components/admin/AdminAuditLogsTab'));
const AdminUserActivityTab = lazy(() => import('../components/admin/AdminUserActivityTab'));
const AdminControlTab = lazy(() => import('../components/admin/AdminControlTab'));
const AdminUsersTab = lazy(() => import('../components/admin/AdminUsersTab'));
const AdminAnalyticsTab = lazy(() => import('../components/admin/AdminAnalyticsTab'));
const AdminReviewsTab = lazy(() => import('../components/admin/AdminReviewsTab'));
const AdminNotificationsTab = lazy(() => import('../components/admin/AdminNotificationsTab'));
const AdminSettingsTab = lazy(() => import('../components/admin/AdminSettingsTab'));
const AdminStaffTab = lazy(() => import('../components/admin/AdminStaffTab'));

const CLOSED_CONFIRM = { show: false, title: '', message: '', onConfirm: null, loading: false };

const ADMIN_NAV_GROUPS = [
  {
    group: 'Overview',
    items: [
      { id: 'control', label: 'Command Center', icon: LayoutDashboard },
    ],
  },
  {
    group: 'Catalog',
    items: [
      { id: 'products', label: 'Products', icon: Package },
      { id: 'categories', label: 'Categories', icon: Tag },
      { id: 'warehouses', label: 'Stock & Inventory', icon: Warehouse },
    ],
  },
  {
    group: 'Sales',
    items: [
      { id: 'orders', label: 'Orders', icon: ShoppingBag },
      { id: 'coupons', label: 'Coupons', icon: Ticket },
      { id: 'campaigns', label: 'Campaigns', icon: Zap },
    ],
  },
  {
    group: 'Customers',
    items: [
      { id: 'users', label: 'Customer Accounts', icon: Users },
      { id: 'reviews', label: 'Reviews Moderation', icon: MessageSquare },
    ],
  },
  {
    group: 'Operations',
    items: [
      { id: 'deliveries', label: 'Delivery Portal', icon: Truck },
    ],
  },
  {
    group: 'Insights',
    items: [
      { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'staff', label: 'Staff & Roles', icon: ShieldCheck },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'activity', label: 'User Activity', icon: Activity },
      { id: 'audit', label: 'Audit Logs', icon: FileText },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ADMIN_TABS = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((it) => it.id));

const AdminPage = () => {
  usePageTitle('Admin Dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { products, loading, fetchProducts, saveProduct, deleteProduct, seedProducts, clearAllProducts } = useAdminProducts();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [confirmModal, setConfirmModal] = useState(CLOSED_CONFIRM);
  const [form, setForm] = useState(EMPTY_PRODUCT_FORM);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const initialTab = searchParams.get('tab');
  const [adminTab, setAdminTab] = useState(
    initialTab && ADMIN_TABS.includes(initialTab) ? initialTab : 'products'
  );

  // URL-driven tab (?tab=users from the navbar admin menu).
  useEffect(() => {
    const tab = searchParams.get('tab');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot URL sync
    if (tab && tab !== adminTab) setAdminTab(ADMIN_TABS.includes(tab) ? tab : 'products');
  }, [searchParams, adminTab]);

  const handleAdminTabChange = (tab) => {
    setAdminTab(tab);
    setSearchParams({ tab });
    setMobileNavOpen(false);
  };

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
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      e.target.value = '';
      return;
    }
    const MAX_IMAGE_SIZE_MB = 5;
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_IMAGE_SIZE_MB}MB`);
      e.target.value = '';
      return;
    }
    e.target.value = '';
    try {
      const { data } = await uploadImage(file);
      setForm({ ...form, image: data.image });
    } catch (err) {
      if (isNetworkError(err)) {
        toast.error('Backend is unreachable. Please start the server and try again.');
      } else {
        toast.error(err?.response?.data?.message || 'Upload failed');
      }
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setForm(EMPTY_PRODUCT_FORM);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // JS guards mirror the HTML attrs — never trust the DOM alone.
    if (!form.title?.trim()) {
      toast.error('Product title is required');
      return;
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }
    const stock = Number(form.countInStock);
    if (!Number.isInteger(stock) || stock < 0) {
      toast.error('Stock must be a whole number 0 or above');
      return;
    }
    const rate = Number(form.rating?.rate ?? 0);
    if (rate < 0 || rate > 5) {
      toast.error('Rating must be between 0 and 5');
      return;
    }
    const reviewCount = Number(form.rating?.count ?? 0);
    if (!Number.isInteger(reviewCount) || reviewCount < 0) {
      toast.error('Review count must be a whole number 0 or above');
      return;
    }

    const variants = (form.variants || []).map((v) => ({
      size: (v.size || '').trim() || null,
      color: (v.color || '').trim() || null,
      sku: (v.sku || '').trim() || null,
      stock: Number(v.stock) || 0,
      priceAdjustment: Number(v.priceAdjustment) || 0
    }));
    for (const [i, v] of variants.entries()) {
      if (!v.size && !v.color) {
        toast.error(`Variant ${i + 1} needs a size or a color`);
        return;
      }
      if (!Number.isInteger(v.stock) || v.stock < 0) {
        toast.error(`Variant ${i + 1} stock must be a whole number 0 or above`);
        return;
      }
      if (!Number.isFinite(v.priceAdjustment)) {
        toast.error(`Variant ${i + 1} price adjustment must be a number`);
        return;
      }
    }

    const wasEditing = Boolean(editingProduct);
    setSaving(true);
    try {
      await saveProduct({ product: { ...form, variants }, editingProduct });
      resetForm();
      toast.success(wasEditing ? 'Product updated' : 'Product added');
    } catch (err) {
      if (isNetworkError(err)) {
        toast.error('Backend is unreachable. Please start the server and try again.');
      } else {
        toast.error(err?.message || err?.response?.data?.message || 'Failed to save product');
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
      rating: { rate: product.rating?.rate || 0, count: product.rating?.count || 0 },
      variants: (product.variants || []).map((v) => ({
        size: v.size || '',
        color: v.color || '',
        sku: v.sku || '',
        stock: v.stock ?? 0,
        priceAdjustment: v.priceAdjustment ?? 0
      }))
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
          toast.success('Product deleted');
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
      title: 'Seed Demo Products',
      message: 'Add 20 DEMO sample products? Their ratings and review counts are placeholder demo data, not real customer activity.',
      loading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          const data = await seedProducts();
          toast.success(data?.count ? `${data.count} products seeded` : 'Products seeded');
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
          toast.success('All products cleared');
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

  const currentTabMeta = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })))
    .find((it) => it.id === adminTab) || { id: adminTab, label: adminTab, group: 'System' };

  const emptyMessage = searchTerm && filterCategory
    ? `No products match "${searchTerm}" in ${filterCategory} category.`
    : searchTerm
      ? `No products match "${searchTerm}".`
      : filterCategory
        ? `No products in the ${filterCategory} category.`
        : 'No products yet. Add your first product to get started.';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Mobile Operations Navigation Bar */}
      <div className="lg:hidden mb-6 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-600 shrink-0">
            {currentTabMeta.icon && <currentTabMeta.icon size={20} aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block truncate">
              {currentTabMeta.group}
            </span>
            <span className="text-base font-bold text-gray-900 truncate block">
              {currentTabMeta.label}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileNavOpen((o) => !o)}
          className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center gap-1.5 transition-colors min-h-[44px]"
          aria-expanded={mobileNavOpen}
          aria-label="Toggle admin sections menu"
        >
          {mobileNavOpen ? <X size={16} /> : <Menu size={16} />}
          <span>Sections</span>
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-end p-3 animate-fade-in-up">
          <div className="bg-white rounded-3xl max-h-[85vh] overflow-y-auto p-5 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="font-extrabold text-gray-900 text-lg">Admin Operations</h3>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close sections menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {ADMIN_NAV_GROUPS.map((g) => (
                <div key={g.group}>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 px-2 mb-1.5">
                    {g.group}
                  </p>
                  <div className="space-y-1">
                    {g.items.map((it) => {
                      const Icon = it.icon;
                      const active = adminTab === it.id;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => handleAdminTabChange(it.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
                            active
                              ? 'bg-teal-600 text-white font-bold shadow-md'
                              : 'text-gray-700 hover:bg-teal-50 hover:text-teal-700'
                          }`}
                        >
                          <Icon size={18} className={active ? 'text-white' : 'text-gray-500'} />
                          <span className="truncate">{it.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Operations Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Desktop Sidebar Navigation */}
        <aside
          className="hidden lg:block w-64 shrink-0 sticky top-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 max-h-[calc(100vh-7rem)] overflow-y-auto"
          aria-label="Admin sidebar navigation"
        >
          <div className="px-3 py-2 border-b border-gray-100 mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operations Console</p>
            <p className="text-sm font-extrabold text-gray-900 mt-0.5">Control Center</p>
          </div>

          <nav className="space-y-4">
            {ADMIN_NAV_GROUPS.map((g) => (
              <div key={g.group}>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 px-3 mb-1">
                  {g.group}
                </p>
                <div className="space-y-0.5">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    const active = adminTab === it.id;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => handleAdminTabChange(it.id)}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[38px] ${
                          active
                            ? 'bg-teal-600 text-white font-bold shadow-xs'
                            : 'text-gray-600 hover:bg-teal-50/70 hover:text-teal-700'
                        }`}
                      >
                        <Icon size={15} className={active ? 'text-white shrink-0' : 'text-gray-500 shrink-0'} />
                        <span className="truncate">{it.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 min-w-0 w-full">
          {adminTab === 'products' ? (
            <>
              <AdminHeader onBack={() => navigate('/')} onSeed={handleSeed} onClearAll={handleClearAll} showDevActions={true} />

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

              {/* F-18: the catalogue fetch is capped at 100 rows — make the cap
                  visible instead of silently hiding older products. */}
              {products.length >= 100 && (
                <p
                  className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"
                  role="status"
                >
                  Showing the first 100 products — use the search box or category filter to narrow the catalogue.
                </p>
              )}

              {showForm && (
                <ProductFormModal
                  form={form}
                  setForm={setForm}
                  saving={saving}
                  isEditing={Boolean(editingProduct)}
                  onImageUpload={handleImageUpload}
                  onSubmit={handleSave}
                  onClose={resetForm}
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
          ) : (
            <Suspense fallback={<div className="py-12 flex justify-center"><Spinner /></div>}>
              {adminTab === 'control' && <AdminControlTab onNavigate={handleAdminTabChange} />}
              {adminTab === 'users' && <AdminUsersTab />}
              {adminTab === 'orders' && <AdminOrdersTab />}
              {adminTab === 'categories' && <AdminCategoriesTab />}
              {adminTab === 'warehouses' && <AdminWarehousesTab />}
              {adminTab === 'coupons' && <AdminCouponsTab />}
              {adminTab === 'campaigns' && <AdminCampaignsTab />}
              {adminTab === 'deliveries' && (
                <div className="space-y-4 sm:space-y-6">
                  <AdminDeliveryAssign />
                  <AdminDeliveryMap />
                </div>
              )}
              {adminTab === 'analytics' && <AdminAnalyticsTab />}
              {adminTab === 'reviews' && <AdminReviewsTab />}
              {adminTab === 'notifications' && <AdminNotificationsTab />}
              {adminTab === 'staff' && <AdminStaffTab />}
              {adminTab === 'audit' && <AdminAuditLogsTab />}
              {adminTab === 'activity' && <AdminUserActivityTab />}
              {adminTab === 'settings' && <AdminSettingsTab />}
            </Suspense>
          )}
        </main>
      </div>

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
