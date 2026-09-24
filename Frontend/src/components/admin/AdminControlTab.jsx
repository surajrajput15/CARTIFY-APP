import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, RefreshCw, AlertTriangle, ShieldCheck, Users, Package, Truck, Warehouse,
  ChevronRight, Loader2, Activity, ClipboardList, CircleDollarSign, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { loadControlSnapshot } from '../../services/controlApi';
import { formatPrice, formatDate } from '../../utils/format';
import { isNetworkError } from '../../utils/apiError';

const CARD = 'bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden';

// Admin Command Center — one read-only surface that mirrors the admin panels.
// Every fetch is an EXISTING admin/warehouse GET; this tab never calls
// adminMutateGuard-guarded routes. So the C1 adminMutateRateGuard 429 paths
// and the admin + partner mutation limits are never triggered from here.
const AdminControlTab = ({ onNavigate, onNavigateTab }) => {
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadControlSnapshot();
      setSnap(res);
    } catch (err) {
      if (!isNetworkError(err)) toast.error('Failed to load command center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = snap?.stats || {};
  const charts = snap?.charts || {};
  const delivery = snap?.delivery || {};
  const partners = (snap?.partners || []).slice(0, 5);
  const inventory = Array.isArray(snap?.inventory) ? snap.inventory : [];
  const staff = (snap?.staff || []).slice(0, 4);
  const warehouses = (snap?.warehouses || []).slice(0, 4);
  const alerts = Array.isArray(snap?.alerts) ? snap.alerts : [];

  const statItem = (label, value, tint, icon) => (
    <button
      key={label}
      type="button"
      onClick={() => onNavigate?.(tabForStat(label))}
      className="bg-white rounded-2xl border border-gray-100 border-b-2 p-4 flex flex-col gap-1.5 text-left hover:shadow-md transition-shadow min-h-[92px]"
    >
      <span className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
        {icon}
      </span>
      <span className={`text-2xl font-extrabold ${tint}`}>{value}</span>
    </button>
  );

  const tabForStat = (label) => {
    const map = { Revenue: 'products', Orders: 'orders', Customers: 'coupons', Products: 'products', 'Low stock': 'warehouses', Deliveries: 'deliveries' };
    return map[label] || onNavigate?.('products');
  };

  const cards = {
    staff: { title: 'Staff Control', hint: 'Delivery + warehouse people', to: 'staff' },
    deliveries: { title: 'Delivery Command', hint: 'Partners + pending load', to: 'deliveries' },
    warehouses: { title: 'Stock Health', hint: 'Warehouses + alerts', to: 'warehouses' }
  };

  const block = (b) => (
    <section key={b.key} className={CARD}>
      <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
        <b.icon size={16} className="text-teal-600" aria-label={b.title} />
        <span className="font-bold text-sm">{b.title}</span>
        <span className="hidden lg:inline text-xs text-gray-400">{b.hint}</span>
        <button type="button" onClick={() => onNavigate?.(b.to)} className="ml-auto inline-flex items-center gap-0.5 text-xs font-bold text-teal-600 hover:text-teal-700 min-h-[36px] px-2">
          Open <ChevronRight size={13} aria-hidden="true" />
        </button>
      </header>
      <ul className="divide-y divide-gray-50">
        {b.items.length === 0 && <li className="px-4 py-5 text-sm text-gray-400">Nothing here yet.</li>}
        {b.items.map((it) => (
          <li key={it._id} className="px-4 py-2.5 flex items-center gap-2">
            <span className="truncate flex-1 text-sm font-semibold text-gray-800">{it.title}</span>
            <span className="shrink-0 text-[11px] text-gray-400">{it.sub}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  if (loading) {
    return (
      <div className="py-16 flex justify-center" role="status" aria-label="Loading command center">
        <Loader2 size={26} className="animate-spin text-teal-600" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-teal-600" aria-hidden="true" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Command Center</h2>
            <p className="text-sm text-gray-500">One glance — jump straight to any panel.</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:text-teal-700 min-h-[36px] px-2">
          <RefreshCw size={13} aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statItem('Revenue', formatPrice(stats.revenue?.latest ?? stats.revenue ?? 0), 'text-teal-600', <CircleDollarSign size={15} className="text-teal-500" aria-hidden="true" />)}
        {statItem('Orders', stats.totalOrders ?? 0, 'text-blue-600', <ClipboardList size={15} className="text-blue-500" aria-hidden="true" />)}
        {statItem('Customers', stats.totalUsers ?? 0, 'text-purple-600', <Users size={15} className="text-purple-500" aria-hidden="true" />)}
        {statItem('Products', stats.totalProducts ?? 0, 'text-indigo-600', <Package size={15} className="text-indigo-500" aria-hidden="true" />)}
        {statItem('Low stock', stats.lowStockCount ?? 0, 'text-amber-600', <AlertTriangle size={15} className="text-amber-500" aria-hidden="true" />)}
        {statItem('Deliveries', stats.activeDeliveries ?? 0, 'text-rose-600', <Truck size={15} className="text-rose-500" aria-hidden="true" />)}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {block({
          key: 'staff',
          icon: Users,
          title: cards.staff.title,
          hint: cards.staff.hint,
          to: cards.staff.to,
          items: staff.map((p) => ({ _id: p._id, title: p.name, sub: `${p.role} · ${p.email || ''}` }))
        })}
        {block({
          key: 'deliveries',
          icon: Truck,
          title: cards.deliveries.title,
          hint: cards.deliveries.hint,
          to: cards.deliveries.to,
          items: partners.map((p) => ({ _id: p._id, title: p.name, sub: `${p.role || 'partner'}` }))
        })}
        {block({
          key: 'warehouses',
          icon: Warehouse,
          title: cards.warehouses.title,
          hint: cards.warehouses.hint,
          to: cards.warehouses.to,
          items: warehouses.map((w) => ({ _id: w._id, title: w.name, sub: `${w.city || ''} · ${w.code || ''}` }))
        })}
      </div>

      {alerts.length > 0 && (
        <section className={CARD}>
          <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
            <AlertTriangle size={15} className="text-amber-500" aria-label="Stock alerts" />
            <span className="font-bold text-sm">Stock alerts</span>
            <button type="button" onClick={() => onNavigate?.('warehouses')} className="ml-auto inline-flex items-center gap-0.5 text-xs font-bold text-teal-600 hover:text-teal-700 min-h-[36px] px-2">
              Open <ChevronRight size={13} aria-hidden="true" />
            </button>
          </header>
          <ul className="divide-y divide-gray-50">
            {alerts.slice(0, 6).map((a) => (
              <li key={a._id} className="px-4 py-2.5 flex items-center gap-2">
                <span className="truncate flex-1 text-sm font-semibold text-gray-800">{a.productName || a.title || 'Product'}</span>
                <span className="shrink-0 text-[11px] text-gray-400">{a.type || 'low stock'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
        <ShieldCheck size={12} aria-hidden="true" />
        Read-only command surface — uses existing admin reads only, no writes.
      </div>
    </div>
  );
};

export default AdminControlTab;
