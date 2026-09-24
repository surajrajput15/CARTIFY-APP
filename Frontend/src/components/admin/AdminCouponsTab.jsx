import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Power, TrendingUp, ShoppingBag, BadgePercent } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchCoupons, fetchCouponAnalytics, deleteCoupon, toggleCoupon } from '../../services/couponsApi';
import { formatPrice, formatDate } from '../../utils/format';
import CouponFormModal from './CouponFormModal';
import ConfirmModal from '../ConfirmModal';
import Spinner from '../Spinner';

const CLOSED_CONFIRM = { show: false };

const AdminCouponsTab = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({ overview: { orders: 0, discountGiven: 0 }, byCode: [] });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(CLOSED_CONFIRM);

  const loadAnalytics = async () => {
    try {
      const { data } = await fetchCouponAnalytics();
      setAnalytics(data || { overview: { orders: 0, discountGiven: 0 }, byCode: [] });
    } catch { /* non-blocking: usage stats are supplementary */ }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await fetchCoupons({ limit: 100 });
      setCoupons(data.coupons || []);
    } catch {
      toast.error('Failed to load coupons');
    } finally { setLoading(false); }
  };
  // Mount fetch — the standard data-loading pattern; the rule can't trace the
  // conditional inside `load`, but state changes happen only after the await.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch
    load();
    loadAnalytics();
  }, []);

  const handleDelete = (id) => setConfirm({
    show: true, title: 'Delete Coupon', message: 'Delete this coupon permanently?', onConfirm: async () => {
      try { await deleteCoupon(id); toast.success('Coupon deleted'); load(); } catch { toast.error('Delete failed'); }
      setConfirm(CLOSED_CONFIRM);
    }
  });
  const handleToggle = async (id) => {
    try { await toggleCoupon(id); toast.success('Coupon toggled'); load(); } catch { toast.error('Toggle failed'); }
  };
  const openAdd = () => { setEditing(null); setShowForm(true); };
  const openEdit = (c) => { setEditing(c); setShowForm(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Coupons</h2>
        <button onClick={openAdd} className="inline-flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-700 min-h-[44px]">
          <Plus size={18} /> Add Coupon
        </button>
      </div>

      {/* Usage analytics: real money spent on Paid orders only */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <span className="p-2.5 rounded-lg bg-amber-50 text-amber-600"><BadgePercent size={20} aria-hidden="true" /></span>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase">Coupons Used (Paid)</p>
            <p className="text-xl font-bold">{analytics.overview.orders}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <span className="p-2.5 rounded-lg bg-red-50 text-red-600"><ShoppingBag size={20} aria-hidden="true" /></span>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase">Discount Given</p>
            <p className="text-xl font-bold">{formatPrice(analytics.overview.discountGiven)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <span className="p-2.5 rounded-lg bg-teal-50 text-teal-600"><TrendingUp size={20} aria-hidden="true" /></span>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase">Top Code</p>
            <p className="text-xl font-bold truncate">{analytics.byCode[0]?._id || '—'}</p>
          </div>
        </div>
      </div>

      {analytics.byCode.length > 1 && (
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm font-bold text-gray-700 mb-2">Top performing coupons</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {analytics.byCode.slice(0, 6).map(c => (
              <div key={c._id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span className="font-bold tracking-wider">{c._id}</span>
                <span className="text-gray-500">{c.orders} orders · {formatPrice(c.discountGiven)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <CouponFormModal editing={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={() => { setShowForm(false); setEditing(null); load(); }} />
      )}

      {loading ? <Spinner /> : coupons.length === 0 ? (
        <p className="text-gray-500 text-center py-12 bg-gray-50 rounded-xl border">No coupons yet. Create your first coupon.</p>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Value</th>
                <th className="text-left p-3">Min Order</th>
                <th className="text-left p-3">Usage</th>
                <th className="text-left p-3">Valid Until</th>
                <th className="text-left p-3">Active</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c._id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-bold tracking-wider">{c.code}</td>
                  <td className="p-3 capitalize">{c.type}</td>
                  <td className="p-3">{c.type === 'percentage' ? `${c.value}%` : formatPrice(c.value)}{c.maxDiscount ? ` (max ${formatPrice(c.maxDiscount)})` : ''}</td>
                  <td className="p-3">{formatPrice(c.minOrderAmount)}</td>
                  <td className="p-3">{c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ''} (per-user {c.userLimit})</td>
                  <td className="p-3">{formatDate(c.validUntil)}</td>
                  <td className="p-3">{c.isActive ? '✅' : '⛔'}</td>
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

export default AdminCouponsTab;
