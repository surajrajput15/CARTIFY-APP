import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Power, Megaphone, Calendar, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchCampaigns, createCampaign, updateCampaign, toggleCampaign, deleteCampaign } from '../../services/campaignsApi';
import { fetchProducts } from '../../services/productsApi';
import { formatDate } from '../../utils/format';
import ConfirmModal from '../ConfirmModal';
import Spinner from '../Spinner';

const CLOSED_CONFIRM = { show: false };
const EMPTY_FORM = {
  name: '', slug: '', description: '', bannerText: '', bannerColor: '#0f766e', bannerImage: '',
  discountType: 'percentage', discountValue: '', maxDiscount: '', minOrderAmount: '',
  eligibleCategories: [], eligibleProductIds: [], startDate: '', endDate: '', isActive: true,
};

const DATE_INPUT = (d) => (d ? new Date(d).toISOString().slice(0, 16) : '');

export const computeCampaignStatus = (c) => {
  const now = Date.now();
  const start = new Date(c.startDate).getTime();
  const end = new Date(c.endDate).getTime();
  if (!c.isActive) return 'Inactive';
  if (now < start) return 'Scheduled';
  if (now > end) return 'Ended';
  return 'Live';
};

const AdminCampaignsTab = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(CLOSED_CONFIRM);
  const [allCategories, setAllCategories] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await fetchCampaigns();
      setCampaigns(data.campaigns || []);
    } catch {
      toast.error('Failed to load campaigns');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch
    load();
    fetchProducts({ limit: 1 })
      .catch(() => null)
      .then(() => {});
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, startDate: DATE_INPUT(new Date()), endDate: DATE_INPUT(new Date(Date.now() + 30 * 86400000)) });
    setShowForm(true);
    fetchProducts({ limit: 200 }).then(({ data }) => {
      const products = data.products || data.productsList || [];
      setAllCategories([...new Set(products.map((p) => (p.category || '').toLowerCase()).filter(Boolean))]);
    }).catch(() => {});
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name, slug: c.slug || '', description: c.description || '',
      bannerText: c.bannerText || '', bannerColor: c.bannerColor || '#0f766e', bannerImage: c.bannerImage || '',
      discountType: c.discountType, discountValue: String(c.discountValue),
      maxDiscount: c.maxDiscount == null ? '' : String(c.maxDiscount),
      minOrderAmount: c.minOrderAmount ? String(c.minOrderAmount) : '',
      eligibleCategories: c.eligibleCategories || [], eligibleProductIds: c.eligibleProductIds || [],
      startDate: DATE_INPUT(c.startDate), endDate: DATE_INPUT(c.endDate), isActive: c.isActive,
    });
    setShowForm(true);
  };

  const toggleCategory = (cat) => {
    setForm((f) => ({
      ...f,
      eligibleCategories: f.eligibleCategories.includes(cat)
        ? f.eligibleCategories.filter((x) => x !== cat)
        : [...f.eligibleCategories, cat],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(form.discountValue);
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!Number.isFinite(value) || value <= 0) { toast.error('Discount value must be a positive number'); return; }
    if (!form.startDate || !form.endDate) { toast.error('Start and end date are required'); return; }
    if (new Date(form.startDate) > new Date(form.endDate)) { toast.error('Start date must be before end date'); return; }

    const payload = {
      name: form.name.trim(),
      slug: form.slug?.trim() || undefined,
      description: form.description?.trim() || '',
      bannerText: form.bannerText?.trim() || '',
      bannerColor: form.bannerColor || '#0f766e',
      bannerImage: form.bannerImage?.trim() || null,
      discountType: form.discountType,
      discountValue: value,
      maxDiscount: form.maxDiscount === '' ? null : Number(form.maxDiscount),
      minOrderAmount: form.minOrderAmount === '' ? 0 : Number(form.minOrderAmount),
      eligibleCategories: form.eligibleCategories,
      eligibleProductIds: form.eligibleProductIds,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      isActive: form.isActive,
    };
    if (payload.maxDiscount !== null && (!Number.isFinite(payload.maxDiscount) || payload.maxDiscount <= 0)) {
      toast.error('Max discount must be a positive number'); return;
    }
    if (payload.minOrderAmount < 0) { toast.error('Min order amount cannot be negative'); return; }

    setSaving(true);
    try {
      if (editing) {
        await updateCampaign(editing._id, payload);
        toast.success('Campaign updated');
      } else {
        await createCampaign(payload);
        toast.success('Campaign created');
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save campaign');
    } finally { setSaving(false); }
  };

  const handleDelete = (id) => setConfirm({
    show: true, title: 'Delete Campaign', message: 'Delete this campaign permanently? Past discounts are still visible on existing orders.', onConfirm: async () => {
      try { await deleteCampaign(id); toast.success('Campaign deleted'); load(); } catch { toast.error('Delete failed'); }
      setConfirm(CLOSED_CONFIRM);
    }
  });

  const handleToggle = async (id) => {
    try { await toggleCampaign(id); toast.success('Campaign toggled'); load(); } catch { toast.error('Toggle failed'); }
  };

  const statusBadge = (c) => {
    const s = computeCampaignStatus(c);
    const cls = s === 'Live' ? 'bg-green-50 text-green-700 border-green-200' : s === 'Scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200';
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>{s}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Megaphone size={20} className="text-teal-600" aria-hidden="true" /> Festival Campaigns</h2>
          <p className="text-sm text-gray-500">Seasonal discounts auto-apply to eligible products during the campaign window — no code needed.</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-700 min-h-[44px]">
          <Plus size={18} /> Add Campaign
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-label="Campaign form">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">{editing ? 'Edit campaign' : 'Add campaign'}</h3>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Close">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Slug</label>
                  <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} maxLength={80} placeholder="diwali-sale" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Discount type</label>
                  <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (₹ off)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{form.discountType === 'percentage' ? 'Discount % *' : 'Amount ₹ *'}</label>
                  <input type="number" min={0.01} step="any" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} required className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Max discount ₹</label>
                  <input type="number" min={0} value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} placeholder="Optional cap" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Min order ₹</label>
                  <input type="number" min={0} value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} placeholder="0" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Starts *</label>
                  <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Ends *</label>
                  <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Eligible categories <span className="text-gray-400">(empty = all)</span></label>
                <div className="flex flex-wrap gap-2">
                  {allCategories.length === 0 ? (
                    <p className="text-xs text-gray-400">Loading categories…</p>
                  ) : (
                    allCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                          form.eligibleCategories.includes(cat) ? 'bg-teal-600 text-white border-teal-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-teal-300'
                        }`}
                      >
                        {cat}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Banner text</label>
                <input value={form.bannerText} onChange={(e) => setForm({ ...form, bannerText: e.target.value })} maxLength={120} placeholder="Diwali Mubarak! Up to 10% off" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Banner colour</label>
                  <input type="color" value={form.bannerColor} onChange={(e) => setForm({ ...form, bannerColor: e.target.value })} className="w-16 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Banner image URL</label>
                  <input value={form.bannerImage} onChange={(e) => setForm({ ...form, bannerImage: e.target.value })} placeholder="https://…" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 text-teal-600 rounded border-gray-300" />
                Enabled
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 min-h-[44px]">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <Spinner /> : campaigns.length === 0 ? (
        <p className="text-gray-500 text-center py-12 bg-gray-50 rounded-xl border">No campaigns yet. Create your first festival campaign.</p>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Campaign</th>
                <th className="text-left p-3">Discount</th>
                <th className="text-left p-3">Window</th>
                <th className="text-left p-3">Scope</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c._id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <p className="font-bold">{c.name}</p>
                    {c.bannerText && <p className="text-xs text-gray-400 truncate max-w-[200px]">{c.bannerText}</p>}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-teal-700 font-bold"><Tag size={13} aria-hidden="true" />
                      {c.discountType === 'percentage' ? `${c.discountValue}%` : `₹${c.discountValue}`}
                    </span>
                    {c.maxDiscount ? <span className="text-xs text-gray-400 block">max ₹{c.maxDiscount}</span> : null}
                  </td>
                  <td className="p-3">
                    <p className="flex items-center gap-1 text-gray-600"><Calendar size={13} aria-hidden="true" /> {formatDate(c.startDate)} → {formatDate(c.endDate)}</p>
                  </td>
                  <td className="p-3">
                    {c.eligibleCategories?.length ? (
                      <div className="flex flex-wrap gap-1">{c.eligibleCategories.slice(0, 3).map((x) => <span key={x} className="px-1.5 py-0.5 rounded bg-gray-100 text-xs font-semibold capitalize">{x}</span>)}{c.eligibleCategories.length > 3 ? `+${c.eligibleCategories.length - 3}` : ''}</div>
                    ) : (
                      <span className="text-gray-400">All products</span>
                    )}
                  </td>
                  <td className="p-3">{statusBadge(c)}</td>
                  <td className="p-3 flex justify-end gap-1">
                    <button onClick={() => handleToggle(c._id)} className="p-2 hover:bg-gray-100 rounded min-w-[40px] min-h-[40px]" aria-label="Toggle"><Power size={16} /></button>
                    <button onClick={() => openEdit(c)} className="p-2 hover:bg-gray-100 rounded min-w-[40px] min-h-[40px]" aria-label="Edit"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(c._id)} className="p-2 hover:bg-red-50 text-red-600 rounded min-w-[40px] min-h-[40px]" aria-label="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm.show && (
        <ConfirmModal title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(CLOSED_CONFIRM)} />
      )}
    </div>
  );
};

export default AdminCampaignsTab;