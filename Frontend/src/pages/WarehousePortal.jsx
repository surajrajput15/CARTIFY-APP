import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Warehouse, Package, AlertTriangle, ArrowLeftRight, History, RefreshCw, Search,
  MapPin, ChevronDown, ChevronRight, UserCircle2, CheckCircle2, XCircle,
} from 'lucide-react';
import { useAuth } from '../context/authContext';
import {
  fetchWarehouseDashboard,
  fetchWarehouseInventory,
  setWarehouseStock,
  fetchWarehouseAlerts,
  fetchWarehouseLedger,
  fetchTransferTargets,
  warehouseTransfer,
} from '../services/warehousePortalApi';
import { isNetworkError } from '../utils/apiError';
import { formatDate } from '../utils/format';
import { fetchWarehouses } from '../services/warehousesApi';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'ledger', label: 'Activity' },
];

const timeAgo = (d) => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return formatDate(d);
};

// Stock row + quick-edit quantity control.
function StockRow({ row, onSave, savingId }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(row.quantity);
  const [expanded, setExpanded] = useState(false);
  const low = row.quantity <= row.lowStockThreshold;

  return (
    <Fragment>
      <tr className="border-b hover:bg-gray-50">
        <td className="p-3">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 hover:bg-gray-100 rounded min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="p-3">
          <p className="font-semibold text-gray-800 truncate max-w-[260px]" title={row.productTitle}>{row.productTitle}</p>
          <p className="text-xs text-gray-400">{row.productCategory || ''}</p>
        </td>
        <td className="p-3">
          {row.variantKey
            ? <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{row.variantKey}</code>
            : <span className="text-xs text-gray-400">Base</span>}
        </td>
        <td className="p-3">
          {editing ? (
            <input
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm"
              autoFocus
            />
          ) : (
            <span className={`font-mono font-semibold ${low ? 'text-amber-600' : 'text-gray-800'}`}>{row.quantity}</span>
          )}
        </td>
        <td className="p-3 text-xs text-gray-500">{row.lowStockThreshold}</td>
        <td className="p-3">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onSave(row, Number(qty))}
                disabled={savingId === row._id || !Number.isFinite(Number(qty)) || Number(qty) < 0}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 min-h-[36px]"
              >
                {savingId === row._id ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setQty(row.quantity); }} className="px-2 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg min-h-[36px]">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setEditing(true); setQty(row.quantity); }}
              className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 rounded-lg min-h-[36px]"
            >
              Update
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50/60">
          <td />
          <td colSpan={5} className="p-3 text-xs text-gray-500">
            <p>Product ID: <span className="font-mono">{row.productId}</span></p>
            <p className="mt-1">
              {low
                ? <span className="inline-flex items-center gap-1 text-amber-700 font-semibold"><AlertTriangle size={13} /> At or below its low-stock threshold</span>
                : <span className="inline-flex items-center gap-1 text-green-700 font-semibold"><CheckCircle2 size={13} /> Healthy stock level</span>}
            </p>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function TransferForm({ onDone, onCancel, warehouseId }) {
  const [targets, setTargets] = useState([]);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ productId: '', toWarehouseId: '', quantity: '', variantKey: '', note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTransferTargets(warehouseId).then(({ data }) => setTargets(data.warehouses || [])).catch(() => toast.error('Failed to load warehouses'));
  }, [warehouseId]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchWarehouseInventory(search ? { search } : undefined, warehouseId)
        .then(({ data }) => setItems(data.items || []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [search, warehouseId]);

  const selected = items.find((i) => String(i.productId) === form.productId);

  const submit = async () => {
    if (!form.productId || !form.toWarehouseId) return toast.error('Pick a product and a destination warehouse');
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) <= 0) return toast.error('Quantity must be a positive whole number');
    setSaving(true);
    try {
      await warehouseTransfer({
        productId: form.productId,
        toWarehouseId: form.toWarehouseId,
        quantity: Number(form.quantity),
        variantKey: form.variantKey || undefined,
        note: form.note || undefined,
      });
      toast.success('Stock transferred');
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Transfer failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
      <h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowLeftRight size={18} className="text-teal-600" /> Transfer Stock Out</h3>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="wh-transfer-search">Find product</label>
        <input id="wh-transfer-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your stock…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="wh-transfer-product">Product</label>
          <select id="wh-transfer-product" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, variantKey: '' })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Select product</option>
            {items.map((i) => (
              <option key={i._id} value={String(i.productId)}>
                {i.productTitle}{i.variantKey ? ` (${i.variantKey})` : ''} — {i.quantity} in stock
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="wh-transfer-wh">Destination warehouse</label>
          <select id="wh-transfer-wh" value={form.toWarehouseId} onChange={(e) => setForm({ ...form, toWarehouseId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Select warehouse</option>
            {targets.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.code})</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="wh-transfer-qty">Quantity</label>
          <input id="wh-transfer-qty" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="wh-transfer-note">Note (optional)</label>
          <input id="wh-transfer-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. restock Mumbai" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
      </div>

      {selected && selected.variantKey && (
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="wh-transfer-variant">Variant</label>
          <p className="text-sm text-gray-600">This product has variants — transferring variant <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{selected.variantKey}</code>.</p>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={saving} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl min-h-[44px]">
          {saving ? 'Transferring…' : 'Transfer Stock'}
        </button>
        <button onClick={onCancel} className="px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl min-h-[44px]">Cancel</button>
      </div>
    </div>
  );
}

function WarehousePortal() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);
  const [tab, setTab] = useState('dashboard');
  const [dash, setDash] = useState(null);
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [search, setSearch] = useState('');
  // Admins have no assignedWarehouseId, so they pick a warehouse to scope to.
  const [warehouseList, setWarehouseList] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const needsPicker = isAdmin && !warehouseId;
  const [loading, setLoading] = useState(() => !user?.isAdmin);
  const [savingId, setSavingId] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetchWarehouses()
      .then(({ data }) => setWarehouseList(data.warehouses || []))
      .catch(() => toast.error('Failed to load warehouses'));
  }, [isAdmin]);

  const loadAll = useCallback(async () => {
    if (isAdmin && !warehouseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const scope = warehouseId || undefined;
      const [d, inv, al, lg] = await Promise.all([
        fetchWarehouseDashboard(scope),
        fetchWarehouseInventory(undefined, scope),
        fetchWarehouseAlerts(scope),
        fetchWarehouseLedger(scope),
      ]);
      setDash(d.data);
      setItems(inv.data.items || []);
      setAlerts(al.data.alerts || []);
      setLedger(lg.data.transactions || []);
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error(err?.response?.data?.message || 'No warehouse assigned — contact an admin.');
      } else if (!isNetworkError(err)) {
        toast.error('Failed to load warehouse data');
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin, warehouseId]);

  // Initial + warehouse-scope load. Refetches whenever the admin picks a warehouse.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on scope change
  useEffect(() => { loadAll(); }, [loadAll]);

  const reloadTab = useCallback((which = tab) => {
    const scope = warehouseId || undefined;
    if (which === 'inventory') {
      fetchWarehouseInventory(search ? { search } : undefined, scope).then(({ data }) => setItems(data.items || [])).catch(() => {});
    } else if (which === 'alerts') {
      fetchWarehouseAlerts(scope).then(({ data }) => setAlerts(data.alerts || [])).catch(() => {});
    } else if (which === 'ledger') {
      fetchWarehouseLedger(scope).then(({ data }) => setLedger(data.transactions || [])).catch(() => {});
    } else {
      fetchWarehouseDashboard(scope).then(({ data }) => setDash(data)).catch(() => {});
    }
  }, [tab, search, warehouseId]);

  const handleSaveStock = async (row, qty) => {
    setSavingId(row._id);
    try {
      await setWarehouseStock(row.productId, { quantity: qty, variantKey: row.variantKey || undefined }, warehouseId || undefined);
      toast.success('Stock updated');
      reloadTab('inventory');
      fetchWarehouseDashboard(warehouseId || undefined).then(({ data }) => setDash(data)).catch(() => {});
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update stock');
    } finally {
      setSavingId(null);
    }
  };

  const saveSearch = () => reloadTab('inventory');

  const statCards = useMemo(() => dash ? [
    { label: 'SKUs stored', value: dash.skus, icon: Package, color: 'text-teal-600 bg-teal-50' },
    { label: 'Total units', value: dash.units, icon: Package, color: 'text-blue-600 bg-blue-50' },
    { label: 'Low-stock alerts', value: dash.alerts, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Critical (out)', value: dash.critical, icon: XCircle, color: 'text-red-600 bg-red-50' },
  ] : [], [dash]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse size={26} className="text-teal-600" aria-hidden="true" /> Warehouse Portal
          </h1>
          {dash && (
            <p className="text-sm text-gray-500 mt-1">
              {dash.warehouse.name} · <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden="true" />{dash.warehouse.city}, {dash.warehouse.state}</span>
              <span className="mx-2">·</span>
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{dash.warehouse.code}</code>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <label htmlFor="wh-scope-picker" className="text-xs font-bold text-gray-500 uppercase">Viewing</label>
              <select
                id="wh-scope-picker"
                value={warehouseId}
                onChange={(e) => { setWarehouseId(e.target.value); setTab('dashboard'); }}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white font-semibold text-gray-700"
              >
                <option value="">Select warehouse…</option>
                {warehouseList.map((w) => (
                  <option key={w._id} value={w._id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
          )}
          <Link to="/profile" className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-semibold text-gray-600 transition-colors">
            <UserCircle2 size={16} aria-hidden="true" /> Profile
          </Link>
          <button onClick={() => loadAll()} className="px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-semibold text-gray-600 transition-colors inline-flex items-center gap-1.5">
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      {needsPicker && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Warehouse size={30} className="text-teal-600 mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-lg font-bold text-gray-800">Pick a warehouse to continue</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            As the owner you can operate any warehouse. Choose one from the picker above to view its
            dashboard, inventory, alerts and activity.
          </p>
        </div>
      )}

      {!needsPicker && (
      <>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${tab === t.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map((c) => (
              <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.color}`} aria-hidden="true"><c.icon size={20} /></div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-gray-900 leading-none">{c.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{c.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent alerts */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500" /> Low-Stock Alerts</h3>
                <button onClick={() => setTab('alerts')} className="text-xs font-bold text-teal-600 hover:text-teal-700">View all</button>
              </div>
              <div className="divide-y divide-gray-50">
                {alerts.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">No low-stock alerts 🎉</p>}
                {alerts.slice(0, 5).map((a) => (
                  <div key={a._id} className={`px-4 py-3 flex items-center justify-between gap-3 ${a.critical ? 'bg-red-50/50' : 'bg-amber-50/40'}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{a.productTitle}</p>
                      <p className="text-xs text-gray-500">{a.variantKey ? <code className="font-mono">{a.variantKey}</code> : 'Base'} · qty {a.quantity} / threshold {a.lowStockThreshold}</p>
                    </div>
                    {a.critical
                      ? <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">Critical</span>
                      : <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">Low</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent ledger activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><History size={18} className="text-teal-600" /> Recent Movements</h3>
                <button onClick={() => setTab('ledger')} className="text-xs font-bold text-teal-600 hover:text-teal-700">View all</button>
              </div>
              <div className="divide-y divide-gray-50">
                {ledger.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">No movements yet.</p>}
                {ledger.slice(0, 6).map((t) => (
                  <div key={t._id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700 truncate">{t.productTitle}</p>
                      <p className="text-xs text-gray-400">
                        {t.type === 'transfer_in' ? `In from ${t.oppositeWarehouseName || 'other'}` : t.type === 'transfer_out' ? `Out to ${t.oppositeWarehouseName || 'other'}` : 'Adjustment'} · {timeAgo(t.createdAt)}
                      </p>
                    </div>
                    <span className={`shrink-0 font-mono text-sm font-semibold ${t.quantityDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {t.quantityDelta > 0 ? '+' : ''}{t.quantityDelta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveSearch()}
                placeholder="Search your stock…" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm" />
            </div>
            <button onClick={() => setShowTransfer(true)} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl min-h-[44px] inline-flex items-center gap-2">
              <ArrowLeftRight size={16} aria-hidden="true" /> Transfer Stock
            </button>
          </div>

          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 p-3" aria-label="Expand" />
                  <th className="text-left p-3">Product</th>
                  <th className="text-left p-3">Variant</th>
                  <th className="text-left p-3">Qty</th>
                  <th className="text-left p-3">Threshold</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={6} className="p-10 text-center text-sm text-gray-400">No stock rows match.</td></tr>
                )}
                {items.map((row) => <StockRow key={row._id} row={row} onSave={handleSaveStock} savingId={savingId} />)}
              </tbody>
            </table>
          </div>

          {showTransfer && <TransferForm warehouseId={warehouseId || undefined} onCancel={() => setShowTransfer(false)} onDone={() => { setShowTransfer(false); loadAll(); }} />}
        </div>
      )}

      {/* ALERTS */}
      {tab === 'alerts' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{alerts.length} low-stock alert{alerts.length !== 1 ? 's' : ''} in {dash?.warehouse.name}.</p>
          {alerts.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
              <CheckCircle2 size={40} className="mx-auto text-green-300 mb-3" aria-hidden="true" />
              <p className="font-semibold text-gray-600">All stock is healthy</p>
              <p className="text-sm text-gray-400 mt-1">No rows at or below their low-stock threshold.</p>
            </div>
          )}
          {alerts.map((a) => (
            <div key={a._id} className={`bg-white rounded-xl border overflow-hidden ${a.critical ? 'border-red-200' : 'border-amber-200'}`}>
              <button onClick={() => setExpandedAlert((e) => (e === a._id ? null : a._id))}
                className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50 text-left" aria-expanded={expandedAlert === a._id}>
                <div className="flex items-center gap-3 min-w-0">
                  {a.critical ? <XCircle size={20} className="text-red-500 shrink-0" /> : <AlertTriangle size={20} className="text-amber-500 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{a.productTitle}</p>
                    <p className="text-xs text-gray-500">{a.variantKey ? <code className="font-mono">{a.variantKey}</code> : 'Base'} · {a.productCategory}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${a.critical ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {a.critical ? 'Critical' : 'Low'}
                  </span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${expandedAlert === a._id ? 'rotate-180' : ''}`} aria-hidden="true" />
                </div>
              </button>
              {expandedAlert === a._id && (
                <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-600 flex flex-wrap items-center gap-4">
                  <span>Quantity: <strong className={a.critical ? 'text-red-600' : 'text-amber-600'}>{a.quantity}</strong></span>
                  <span>Threshold: <strong>{a.lowStockThreshold}</strong></span>
                  <button
                    onClick={() => { setTab('inventory'); setSearch(a.productTitle); }}
                    className="ml-auto text-xs font-bold text-teal-600 hover:text-teal-700">Update stock</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* LEDGER */}
      {tab === 'ledger' && (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Delta</th>
                <th className="text-left p-3">Balance</th>
                <th className="text-left p-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-sm text-gray-400">No stock movements yet.</td></tr>}
              {ledger.map((t) => (
                <tr key={t._id} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-gray-500 whitespace-nowrap">{timeAgo(t.createdAt)}</td>
                  <td className="p-3 font-semibold text-gray-800 truncate max-w-[260px]">{t.productTitle}
                    {t.variantKey && <code className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{t.variantKey}</code>}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                      t.type === 'transfer_in' ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : t.type === 'transfer_out' ? 'bg-violet-50 text-violet-700 border-violet-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {t.type === 'transfer_in' ? `In · ${t.oppositeWarehouseName || '?'}` : t.type === 'transfer_out' ? `Out · ${t.oppositeWarehouseName || '?'}` : 'Adjust'}
                    </span>
                  </td>
                  <td className={`p-3 font-mono font-semibold ${t.quantityDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {t.quantityDelta > 0 ? '+' : ''}{t.quantityDelta}
                  </td>
                  <td className="p-3 font-mono text-gray-600">{t.balanceAfter}</td>
                  <td className="p-3 text-xs text-gray-400 truncate max-w-[200px]" title={t.note}>{t.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}
    </div>
  );
}

export default WarehousePortal;