import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { Plus, Trash2, Loader2, Package, ArrowLeft } from 'lucide-react';

const AdminPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', price: '', description: '', category: 'electronics', image: '', rating: { rate: 0, count: 0 } });

  useEffect(() => {
    if (!user || !user.isAdmin) {
      navigate('/');
      return;
    }
    fetchProducts();
  }, [user, navigate]);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/api/products', { params: { limit: 100 } });
      setProducts(Array.isArray(data) ? data : data.products);
    } catch (err) {
      console.error('Failed to fetch products', err);
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const { data } = await api.post('/api/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm({ ...form, image: data.image });
    } catch (err) {
      alert('Upload failed');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/products/add', {
        ...form,
        price: Number(form.price),
        rating: { rate: Number(form.rating.rate), count: Number(form.rating.count) }
      });
      setShowForm(false);
      setForm({ title: '', price: '', description: '', category: 'electronics', image: '', rating: { rate: 0, count: 0 } });
      fetchProducts();
    } catch (err) {
      alert('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product permanently?')) return;
    try {
      await api.delete(`/api/products/${id}`);
      fetchProducts();
    } catch (err) {
      alert('Failed to delete product');
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('Add 20 sample products to the database?')) return;
    try {
      const productsData = [
        { title: "MacBook Pro 14\" M3", price: 199999, description: "Apple M3 chip, 18GB RAM, 512GB SSD", category: "electronics", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500", rating: { rate: 4.8, count: 342 } },
        { title: "iPhone 15 Pro Max", price: 159999, description: "A17 Pro chip, 256GB, Titanium", category: "electronics", image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500", rating: { rate: 4.7, count: 891 } },
        { title: "Sony WH-1000XM5", price: 29999, description: "Wireless Noise Cancelling Headphones", category: "electronics", image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=500", rating: { rate: 4.6, count: 2341 } },
        { title: "Samsung Galaxy S24 Ultra", price: 134999, description: "Snapdragon 8 Gen 3, 256GB, S Pen", category: "electronics", image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500", rating: { rate: 4.5, count: 567 } },
        { title: "Apple AirPods Pro 2", price: 24999, description: "Active Noise Cancellation, USB-C", category: "electronics", image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=500", rating: { rate: 4.8, count: 3201 } },
        { title: "Nike Air Force 1", price: 11995, description: "Classic white sneakers for men", category: "footwear", image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500", rating: { rate: 4.4, count: 1892 } },
        { title: "Adidas Ultraboost Light", price: 15999, description: "Ultra-lightweight running shoes", category: "footwear", image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500", rating: { rate: 4.5, count: 982 } },
        { title: "Levi's 501 Original Jeans", price: 5499, description: "Regular fit straight leg jeans", category: "clothing", image: "https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=500", rating: { rate: 4.3, count: 4501 } },
        { title: "Puma Hoodie", price: 3999, description: "Cotton-blend fleece hoodie", category: "clothing", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500", rating: { rate: 4.2, count: 672 } },
        { title: "Ray-Ban Aviator Sunglasses", price: 8999, description: "Gold frame, green classic lens", category: "accessories", image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500", rating: { rate: 4.6, count: 2783 } },
        { title: "Titan Smart Watch", price: 14995, description: "AMOLED display, 100+ sport modes", category: "accessories", image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=500", rating: { rate: 4.3, count: 1245 } },
        { title: "Wooden Study Table", price: 12999, description: "Premium engineered wood, 120x60cm", category: "furniture", image: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=500", rating: { rate: 4.1, count: 234 } },
        { title: "Ergonomic Office Chair", price: 18999, description: "Mesh back, lumbar support, adjustable", category: "furniture", image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=500", rating: { rate: 4.4, count: 876 } },
        { title: "Maybelline Fit Me Foundation", price: 799, description: "Natural finish liquid foundation", category: "beauty", image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500", rating: { rate: 4.2, count: 4321 } },
        { title: "Lakme Absolute Lipstick", price: 949, description: "Matte finish, long-lasting", category: "beauty", image: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500", rating: { rate: 4.1, count: 2987 } },
        { title: "Sony PlayStation 5", price: 54999, description: "Slim disk edition, DualSense controller", category: "electronics", image: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=500", rating: { rate: 4.9, count: 4502 } },
        { title: "Dell UltraSharp 27\" 4K", price: 44999, description: "IPS panel, USB-C hub, HDR400", category: "electronics", image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500", rating: { rate: 4.7, count: 543 } },
        { title: "JBL Flip 6 Speaker", price: 12999, description: "Portable Bluetooth speaker, IP67", category: "electronics", image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500", rating: { rate: 4.5, count: 1876 } },
        { title: "Zara Formal Blazer", price: 7999, description: "Slim fit, single-breasted blazer", category: "clothing", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500", rating: { rate: 4.0, count: 432 } },
        { title: "Noise Cancelling Earbuds", price: 3999, description: "BT 5.3, 40hr battery, ENC", category: "electronics", image: "https://images.unsplash.com/photo-1590658268037-6bf12f032f5e?w=500", rating: { rate: 4.3, count: 1543 } }
      ];
      const { data } = await api.post('/api/products/seed', productsData);
      alert(`${data.count} products seeded successfully!`);
      fetchProducts();
    } catch (err) {
      alert('Failed to seed products');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete ALL products? This cannot be undone!')) return;
    try {
      await api.delete('/api/products/clear');
      fetchProducts();
    } catch (err) {
      alert('Failed to clear products');
    }
  };

  if (!user || !user.isAdmin) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => navigate('/')} className="flex items-center text-sm font-bold text-teal-600 hover:text-teal-700 mb-2">
            <ArrowLeft size={16} className="mr-1" /> Back to Store
          </button>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Package className="text-teal-600" size={32} /> Admin Dashboard
          </h1>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSeed} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors">
            Seed 20 Products
          </button>
          <button onClick={handleClearAll} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors">
            Clear All
          </button>
        </div>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <p className="text-gray-600 font-medium">{products.length} products in database</p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-sm">
          <Plus size={18} /> Add Product
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Add New Product</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <input type="text" placeholder="Product Title" required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500" />
              <input type="number" step="0.01" placeholder="Price (₹)" required value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500" />
              <textarea placeholder="Description" required value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500" />
              <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500">
                {['electronics', 'clothing', 'footwear', 'accessories', 'furniture', 'beauty'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full px-4 py-3 rounded-xl border border-gray-200" />
                {form.image && <img src={form.image.startsWith('/uploads') ? `https://cartify-api-10g3.onrender.com${form.image}` : form.image} alt="preview" className="mt-2 h-24 object-contain rounded-lg border" />}
              </div>
              <div className="flex gap-4">
                <input type="number" step="0.1" placeholder="Rating (0-5)" value={form.rating.rate} onChange={(e) => setForm({...form, rating: {...form.rating, rate: e.target.value}})} className="w-1/2 px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500" />
                <input type="number" placeholder="Review Count" value={form.rating.count} onChange={(e) => setForm({...form, rating: {...form.rating, count: e.target.value}})} className="w-1/2 px-4 py-3 rounded-xl border border-gray-200 focus:ring-teal-500 focus:border-teal-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="animate-spin" size={20} /> : null} Save Product
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="animate-spin mx-auto text-teal-600" size={40} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left p-4 font-bold text-gray-600">Image</th>
                  <th className="text-left p-4 font-bold text-gray-600">Title</th>
                  <th className="text-left p-4 font-bold text-gray-600">Category</th>
                  <th className="text-left p-4 font-bold text-gray-600">Price</th>
                  <th className="text-left p-4 font-bold text-gray-600">Rating</th>
                  <th className="text-center p-4 font-bold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <img src={p.image} alt={p.title} className="h-12 w-12 object-contain rounded-lg bg-gray-50" />
                    </td>
                    <td className="p-4 font-medium text-gray-800 max-w-xs truncate">{p.title}</td>
                    <td className="p-4 capitalize text-gray-600">{p.category}</td>
                    <td className="p-4 font-bold text-gray-900">₹{p.price}</td>
                    <td className="p-4 text-gray-600">{p.rating?.rate} ({p.rating?.count})</td>
                    <td className="p-4 text-center">
                      <button onClick={() => handleDelete(p._id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
